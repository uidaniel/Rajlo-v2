"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";

/**
 * State for a single uploaded document.
 *  - while uploading:   { name, size, uploading: true }
 *  - on success:        { name, size, path }       <- path is the storage key
 *  - on failure:        { name, size, error }
 *  - when no file picked: undefined
 *
 * `approved` is set when restoring an admin-approved doc on resubmission —
 * the original File is gone (we only kept the storage path), so the UI
 * renders an "Approved" badge instead of a misleading "0 KB" line.
 */
export type UploadedFile = {
  name: string;
  size: number;
  path?: string;
  uploading?: boolean;
  error?: string;
  approved?: boolean;
};

export type FileState = Record<string, UploadedFile | undefined>;

export type FileUploadField = {
  id: string;
  label: string;
  hint?: string;
  required?: boolean;
};

export function FileUpload({
  field,
  files,
  onPick,
  onRemove,
}: {
  field: FileUploadField;
  files: FileState;
  onPick: (id: string, file: File) => void;
  onRemove: (id: string) => void;
}) {
  const file = files[field.id];
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onPick(field.id, dropped);
  };

  const stateClass = file?.error
    ? "border-rajlo-red bg-primary-soft/60"
    : file?.uploading
      ? "border-rajlo-red/40 bg-primary-soft/40"
      : file?.path
        ? "border-emerald-300 bg-emerald-50/60"
        : dragOver
          ? "scale-[1.01] border-rajlo-red bg-primary-soft"
          : "border-line bg-surface-soft hover:border-rajlo-red/30 hover:bg-primary-soft/30";

  const iconBg = file?.error
    ? "bg-rajlo-red text-white"
    : file?.uploading
      ? "bg-rajlo-red/15 text-rajlo-red"
      : file?.path
        ? "bg-emerald-500 text-white"
        : "bg-white text-muted group-hover:text-rajlo-red";

  const iconName: IconName = file?.error
    ? "alert-triangle"
    : file?.uploading
      ? "upload"
      : file?.path
        ? "check-circle"
        : "upload";

  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold">
        {field.label}
        {field.required && <span className="ml-0.5 text-rajlo-red">*</span>}
      </p>
      {field.hint && <p className="mb-2 text-xs text-muted">{field.hint}</p>}
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`group flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-4 transition-all ${stateClass}`}
      >
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-colors ${iconBg}`}
        >
          {file?.uploading ? (
            <span className="h-5 w-5 animate-spin rounded-full border-[2.5px] border-current border-t-transparent" />
          ) : (
            <Icon name={iconName} className="h-5 w-5" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          {file?.error ? (
            <>
              <p className="text-sm font-semibold text-rajlo-red">Upload failed</p>
              <p className="truncate text-xs text-muted">{file.error} · click to retry</p>
            </>
          ) : file?.uploading ? (
            <>
              <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
              <p className="text-xs text-muted">Uploading…</p>
            </>
          ) : file?.path ? (
            <>
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                {file.approved && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    <Icon name="check-circle" className="h-2.5 w-2.5" />
                    Approved
                  </span>
                )}
              </div>
              <p className="text-xs font-medium text-emerald-700">
                {file.approved
                  ? "Already verified by admin · click to replace"
                  : `Uploaded · ${(file.size / 1024).toFixed(0)} KB · click to replace`}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Click or drop file here</p>
              <p className="text-xs text-muted">PDF, JPG or PNG up to 10MB</p>
            </>
          )}
        </div>
        {file?.path && !file.uploading && !file.approved && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onRemove(field.id);
            }}
            aria-label="Remove file"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-white hover:text-rajlo-red"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        )}
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          disabled={file?.uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(field.id, f);
          }}
        />
      </label>
    </div>
  );
}
