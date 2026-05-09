"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "./icons";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

/**
 * Real-time driver ↔ rider chat panel. Slides in from the right on
 * desktop, full-screen on mobile.
 *
 * - Loads message history on open
 * - Subscribes to Realtime postgres_changes on `ride_messages` for the
 *   given ride and re-fetches the list on every push (re-fetch beats
 *   parsing the raw row payload because the API signs media URLs that
 *   the realtime payload doesn't carry)
 * - Composer supports text, image attachments (camera or gallery),
 *   and voice notes recorded via the MediaRecorder API
 * - "Call" button is just a `tel:` link — no in-app calling per the
 *   product spec; the OS dialer opens
 *
 * After the ride flips to a closed status (completed/cancelled),
 * server-side RLS stops returning messages to participants. The sheet
 * detects the flip via the `rideActive` prop and renders a "chat
 * archived" notice instead of the composer.
 */

type ChatMessage = {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: "rider" | "driver";
  kind: "text" | "image" | "voice";
  body: string;
  durationMs: number | null;
  readAt: string | null;
  createdAt: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  rideId: string;
  myRole: "rider" | "driver";
  peerName: string;
  peerAvatarUrl?: string | null;
  /** When provided, the call icon turns into a real `tel:` link. */
  peerPhone?: string | null;
  /** False when the ride is in a terminal status. The composer is
   *  swapped for an "archived" banner and Realtime is disconnected. */
  rideActive: boolean;
};

const RIDE_CHAT_BUCKET = "ride-chat";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const MAX_VOICE_BYTES = 16 * 1024 * 1024; // 16 MB

export function ChatSheet({
  open,
  onClose,
  rideId,
  myRole,
  peerName,
  peerAvatarUrl,
  peerPhone,
  rideActive,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ─── Voice recording state ─── */
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ─── Body scroll lock when open on mobile ─── */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* ─── Load + subscribe ─── */
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/rides/${rideId}/messages`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { messages: ChatMessage[] };
      setMessages(json.messages);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't load messages.",
      );
    } finally {
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void refresh();

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`ride-chat-${rideId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ride_messages",
          filter: `ride_id=eq.${rideId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, rideId, refresh]);

  /* ─── Auto-scroll to bottom on new messages ─── */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  /* ─── Send text ─── */
  const sendText = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/rides/${rideId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "text", body: text }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setDraft("");
      // Realtime will refresh, but optimistically append for snappier UX.
      const json = (await res.json()) as { message: ChatMessage };
      setMessages((m) => [...m, json.message]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send message.");
    } finally {
      setSending(false);
    }
  };

  /* ─── Send image ─── */
  const sendImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image too large — keep it under 8 MB.");
      return;
    }
    await uploadAndPost(file, "image");
  };

  /* ─── Voice recording ─── */
  const startRecording = async () => {
    if (recording) return;
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStreamRef.current = stream;
      // We try Opus/WebM first (best size/quality on Chrome/Firefox/
      // Edge/Android Chrome), fall back to whatever the browser picks
      // (Safari uses MP4/AAC). The mime-type lands in the file
      // extension via the fallback to "audio/webm".
      const mimeCandidate = MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus",
      )
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mimeCandidate
        ? new MediaRecorder(stream, { mimeType: mimeCandidate })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.addEventListener("dataavailable", (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      });
      recorder.start();
      recordStartRef.current = Date.now();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds(
          Math.floor((Date.now() - recordStartRef.current) / 1000),
        );
      }, 250);
    } catch (e) {
      setRecordError(
        e instanceof Error
          ? "Microphone permission was blocked. Allow it in browser settings."
          : "Couldn't access microphone.",
      );
    }
  };

  const stopRecording = async (commit: boolean) => {
    const recorder = mediaRecorderRef.current;
    const stream = mediaStreamRef.current;
    if (!recorder) return;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    setRecording(false);

    // We need to wait for the final dataavailable + stop events so
    // chunksRef has the complete recording before we assemble.
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    // Tear down the media stream so the OS-level recording indicator
    // disappears and we don't keep the mic warm.
    stream?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;

    if (!commit) {
      chunksRef.current = [];
      setRecordSeconds(0);
      return;
    }
    if (chunksRef.current.length === 0) return;

    const durationMs = Date.now() - recordStartRef.current;
    if (durationMs < 800) {
      setRecordError("Recording too short — hold longer.");
      chunksRef.current = [];
      setRecordSeconds(0);
      return;
    }
    const mimeType = recorder.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    setRecordSeconds(0);

    if (blob.size > MAX_VOICE_BYTES) {
      setRecordError("Voice note too large — keep it under 16 MB.");
      return;
    }
    const ext = mimeType.includes("mp4")
      ? "m4a"
      : mimeType.includes("ogg")
        ? "ogg"
        : "webm";
    const file = new File([blob], `voice-${Date.now()}.${ext}`, {
      type: mimeType,
    });
    await uploadAndPost(file, "voice", durationMs);
  };

  /* ─── Shared upload + send for media kinds ─── */
  const uploadAndPost = async (
    file: File,
    kind: "image" | "voice",
    durationMs?: number,
  ) => {
    setSending(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      // Path inside the bucket — lead with the ride_id folder so the
      // storage RLS policy can scope by foldername.
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const random = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const path = `${rideId}/${kind}-${random}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(RIDE_CHAT_BUCKET)
        .upload(path, file, {
          contentType: file.type,
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const res = await fetch(`/api/rides/${rideId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          body: path,
          durationMs: durationMs ?? null,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as { message: ChatMessage };
      setMessages((m) => [...m, json.message]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : `Couldn't send ${kind}.`,
      );
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex">
      {/* Backdrop — dim layer behind the panel. Fades in. */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel — full-screen on mobile, right-edge sheet on desktop. */}
      <div className="relative ml-auto flex h-full w-full flex-col bg-surface shadow-2xl md:max-w-md">
        {/* Header */}
        <header className="flex items-center gap-3 border-b border-line bg-rajlo-black px-4 py-3 text-white">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
          <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-white/15 text-sm font-bold">
            {peerAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={peerAvatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              peerName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold tracking-tight">
              {peerName}
            </p>
            <p className="truncate text-[11px] text-white/70">
              {rideActive
                ? "Active trip · End-to-end private to this ride"
                : "Trip ended · Chat archived"}
            </p>
          </div>
          {peerPhone && (
            <a
              href={`tel:${peerPhone}`}
              aria-label={`Call ${peerName}`}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-md transition-transform hover:-translate-y-0.5 active:translate-y-0"
              title="Opens your phone app — calls aren't placed in-browser"
            >
              <Icon name="phone" className="h-4 w-4" />
            </a>
          )}
        </header>

        {/* Message stream */}
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-y-auto bg-surface-soft px-4 py-4"
        >
          {loading ? (
            <div className="grid h-full place-items-center">
              <p className="text-xs font-semibold text-muted">
                Loading messages…
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <span
                  aria-hidden
                  className="mx-auto block text-3xl leading-none"
                >
                  💬
                </span>
                <p className="mt-3 text-sm font-bold">
                  Send the first message
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted">
                  Coordinate pickup details, share a landmark, or ping
                  with a voice note. Stays private to this ride.
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  m={m}
                  mine={m.senderRole === myRole}
                />
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="border-t border-rajlo-red/20 bg-primary-soft px-4 py-2 text-xs font-semibold text-rajlo-red">
            {error}
          </div>
        )}

        {/* Composer / archived banner */}
        {rideActive ? (
          <footer className="border-t border-line bg-surface px-3 py-2.5">
            {recording ? (
              <RecordingBar
                seconds={recordSeconds}
                onCancel={() => stopRecording(false)}
                onSend={() => stopRecording(true)}
              />
            ) : (
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  aria-label="Send a photo"
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground hover:bg-surface-soft disabled:opacity-50"
                >
                  <Icon name="upload" className="h-5 w-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void sendImage(f);
                  }}
                />
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void sendText();
                    }
                  }}
                  rows={1}
                  placeholder="Message…"
                  disabled={sending}
                  className="min-h-[40px] max-h-32 flex-1 resize-none rounded-2xl border border-line bg-surface-soft px-3 py-2 text-base outline-none focus:border-rajlo-red disabled:opacity-50"
                  style={{ fontSize: "16px" }}
                />
                {draft.trim() ? (
                  <button
                    type="button"
                    onClick={sendText}
                    disabled={sending || !draft.trim()}
                    aria-label="Send message"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rajlo-red text-white shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-50 active:translate-y-0"
                  >
                    {sending ? (
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Icon name="arrow-right" className="h-4 w-4" />
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={sending}
                    aria-label="Record a voice note"
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rajlo-red text-white shadow-md transition-transform hover:-translate-y-0.5 disabled:opacity-50 active:translate-y-0"
                  >
                    <MicIcon />
                  </button>
                )}
              </div>
            )}
            {recordError && !recording && (
              <p className="mt-1.5 text-[11px] font-semibold text-rajlo-red">
                {recordError}
              </p>
            )}
            <p className="mt-1.5 text-[10px] text-muted">
              Messages stay visible only while the trip is active. After
              completion or cancellation, only Rajlo support can review
              this chat.
            </p>
          </footer>
        ) : (
          <footer className="border-t border-line bg-surface-soft px-4 py-4 text-center">
            <p className="text-sm font-bold">Chat archived</p>
            <p className="mt-1 text-xs text-muted">
              The trip has ended. For your safety, the conversation is
              now read-only and accessible only to Rajlo support.
            </p>
          </footer>
        )}
      </div>
    </div>
  );
}

/* ─── Message bubble ─── */

function MessageBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  const time = new Date(m.createdAt).toLocaleTimeString("en-JM", {
    hour: "numeric",
    minute: "2-digit",
  });

  const align = mine ? "items-end self-end" : "items-start self-start";
  // Their-side bubble: themable surface (`bg-surface`) so it darkens
  // in dark mode instead of glaring bright white. My-side stays
  // brand-red — that's the brand colour and reads on both themes.
  const bubbleColor = mine
    ? "bg-rajlo-red text-white"
    : "bg-surface text-foreground border border-line";

  return (
    <li className={`flex max-w-[85%] flex-col ${align}`}>
      {m.kind === "text" && (
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${bubbleColor}`}
        >
          {m.body}
        </div>
      )}
      {m.kind === "image" && m.body && (
        <a
          href={m.body}
          target="_blank"
          rel="noopener noreferrer"
          className={`block overflow-hidden rounded-2xl ${
            mine ? "ring-2 ring-rajlo-red/30" : "border border-line"
          }`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={m.body}
            alt="Photo"
            className="block max-h-72 w-full max-w-xs object-cover"
          />
        </a>
      )}
      {m.kind === "voice" && m.body && (
        <div
          className={`flex items-center gap-2 rounded-2xl px-3 py-2 ${bubbleColor}`}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-white/15">
            <MicIcon className="h-3.5 w-3.5" />
          </span>
          <audio
            controls
            src={m.body}
            className="h-9 max-w-[180px]"
            preload="metadata"
          />
          {m.durationMs !== null && (
            <span className="shrink-0 text-[11px] font-semibold opacity-80">
              {Math.max(1, Math.round(m.durationMs / 1000))}s
            </span>
          )}
        </div>
      )}
      <p className="mt-1 px-1 text-[10px] text-muted">
        {time}
        {mine && m.readAt && " · Read"}
      </p>
    </li>
  );
}

/* ─── Recording bar (replaces composer while a voice note is being captured) ─── */

function RecordingBar({
  seconds,
  onCancel,
  onSend,
}: {
  seconds: number;
  onCancel: () => void;
  onSend: () => void;
}) {
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <div className="flex items-center gap-2 rounded-full border border-rajlo-red/30 bg-primary-soft px-3 py-1.5">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-rajlo-red">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
      </span>
      <span className="flex-1 font-mono text-sm font-bold text-rajlo-red">
        {mm}:{ss}
      </span>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel recording"
        className="grid h-9 w-9 place-items-center rounded-full text-foreground hover:bg-surface"
      >
        <Icon name="x" className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSend}
        aria-label="Send voice note"
        className="grid h-9 w-9 place-items-center rounded-full bg-rajlo-red text-white shadow-md transition-transform hover:-translate-y-0.5"
      >
        <Icon name="arrow-right" className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ─── Mic icon — inline so we don't need to extend the icon set just for this ─── */

function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}
