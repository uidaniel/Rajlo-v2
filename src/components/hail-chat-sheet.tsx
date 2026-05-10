"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { useBackgroundRefresh } from "@/lib/use-background-refresh";

/**
 * Slide-up chat sheet for a route taxi hail. Shared by the rider's
 * live page and the driver's session monitor — same component, same
 * endpoint; the server figures out which side you are.
 *
 * Polls /api/route-taxi/hails/[id]/messages every 5s while open, and
 * fires a single fetch on send to round-trip the new message. Marks
 * the counterpart's messages as read on every poll (the GET endpoint
 * does it server-side).
 *
 * Text-only for MVP — image / voice can land later by mirroring the
 * `kind` shape from the existing ride-chat code.
 */

type Message = {
  id: string;
  hailId: string;
  senderId: string;
  senderRole: "rider" | "driver";
  body: string;
  readAt: string | null;
  createdAt: string;
};

export function HailChatSheet({
  hailId,
  open,
  onClose,
  counterpartName,
  counterpartAvatarUrl,
}: {
  hailId: string;
  open: boolean;
  onClose: () => void;
  counterpartName?: string | null;
  counterpartAvatarUrl?: string | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [myRole, setMyRole] = useState<"rider" | "driver" | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    if (!open || !hailId) return;
    try {
      const res = await fetch(`/api/route-taxi/hails/${hailId}/messages`);
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Couldn't load messages");
        return;
      }
      const json = (await res.json()) as {
        messages: Message[];
        role: "rider" | "driver";
      };
      setMessages(json.messages);
      setMyRole(json.role);
      setError(null);
    } catch {
      /* polling — next tick will catch up */
    } finally {
      setLoading(false);
    }
  }, [open, hailId]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    void refresh();
    // Auto-focus the composer when the sheet opens — tap-to-type
    // without an extra tap.
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, refresh]);

  useBackgroundRefresh(refresh, 5000, { enabled: open });

  // Auto-scroll to bottom when messages change so the latest is in
  // view. Only when the user is already near the bottom, so we don't
  // yank them away if they're scrolling up to read history.
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const isNearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/route-taxi/hails/${hailId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: Message;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.message) {
        throw new Error(json.error ?? "Send failed");
      }
      // Optimistic-ish: append the server's authoritative copy. We
      // skip dedup logic since the next poll will reconcile if needed.
      setMessages((prev) => [...prev, json.message!]);
      setDraft("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  // Group consecutive messages from the same sender for tighter
  // reading rhythm — only show the avatar/name on the first of a run.
  const grouped = useMemo(() => {
    const out: { role: "rider" | "driver"; msgs: Message[] }[] = [];
    for (const m of messages) {
      const last = out[out.length - 1];
      if (last && last.role === m.senderRole) last.msgs.push(m);
      else out.push({ role: m.senderRole, msgs: [m] });
    }
    return out;
  }, [messages]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trip chat"
      className="fixed inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Close chat"
        onClick={onClose}
        className="flex-1 cursor-default"
      />
      <div className="flex h-[85vh] flex-col overflow-hidden rounded-t-3xl border-t border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-line bg-surface-soft px-5 py-4">
          {counterpartAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={counterpartAvatarUrl}
              alt={counterpartName ?? "Trip chat"}
              className="h-10 w-10 shrink-0 rounded-xl object-cover ring-2 ring-rajlo-red/30"
            />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-rajlo-red via-rajlo-red to-[#7a0000] text-base font-extrabold text-white">
              {(counterpartName?.[0] ?? "C").toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-secondary text-[10px] font-bold uppercase tracking-wider text-rajlo-red">
              Trip chat
            </p>
            <p className="truncate text-sm font-extrabold tracking-tight">
              {counterpartName ?? "Conversation"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-surface hover:text-foreground"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollAreaRef}
          className="flex-1 overflow-y-auto bg-surface-soft px-4 py-5"
        >
          {loading && messages.length === 0 ? (
            <div className="grid h-full place-items-center text-center text-xs text-muted">
              Loading messages…
            </div>
          ) : messages.length === 0 ? (
            <div className="grid h-full place-items-center px-6 text-center">
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white text-rajlo-red shadow-sm">
                  <Icon name="mail" className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-bold">No messages yet</p>
                <p className="mt-1 text-xs text-muted">
                  Coordinate the pickup spot, send arrival landmarks, or just
                  say hi.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map((g, idx) => {
                const isMine = g.role === myRole;
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}
                  >
                    {g.msgs.map((m, i) => (
                      <div
                        key={m.id}
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                          isMine
                            ? "bg-rajlo-red text-white"
                            : "bg-white text-foreground"
                        } ${i > 0 ? "mt-1" : ""}`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                      </div>
                    ))}
                    <p
                      className={`mt-1 text-[10px] ${
                        isMine ? "text-rajlo-red/70" : "text-muted"
                      }`}
                    >
                      {timeOf(g.msgs[g.msgs.length - 1].createdAt)}
                      {isMine && g.msgs[g.msgs.length - 1].readAt
                        ? " · read"
                        : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t border-line bg-surface px-3 py-3">
          {error && (
            <p className="mb-2 rounded-lg bg-primary-soft px-3 py-1.5 text-[11px] text-rajlo-red">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              maxLength={2000}
              className="flex-1 rounded-full border border-line bg-surface-soft px-4 py-2.5 text-sm font-medium outline-none placeholder:text-muted/70 focus:border-rajlo-red focus:ring-2 focus:ring-rajlo-red/15"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-rajlo-red text-white shadow-md shadow-rajlo-red/25 transition-transform hover:-translate-y-0.5 hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {sending ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Icon name="arrow-right" className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-JM", {
    hour: "numeric",
    minute: "2-digit",
  });
}
