'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { ImageIcon, Loader2, X, AlertCircle } from 'lucide-react';
import { attachments as attachmentsApi, type ApiAttachment } from './api';

// ---- Client-side validation rules (mirror the server) ----------------------
// Images only for now; the foundation is generic but the UI gates to images.
const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB

export function isAllowedImage(file: File): boolean {
  return ALLOWED_IMAGE_MIME.includes(file.type);
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Read an image's natural pixel dimensions in the browser, so we can pass them
// to the presign call (used for layout / future thumbnails). Best-effort: on
// any failure we resolve with nulls rather than blocking the upload.
function readImageDimensions(
  file: File,
): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      resolve({ width: null, height: null });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const dims = { width: img.naturalWidth, height: img.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(dims);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: null, height: null });
    };
    img.src = url;
  });
}

// ---- Pending-upload state machine ------------------------------------------
// A file the user picked that is uploading / uploaded / errored, BEFORE the
// message is sent. Once the message is sent the server-confirmed attachmentIds
// are harvested via collectReadyIds().
export type PendingStatus = 'uploading' | 'ready' | 'error';

export interface PendingAttachment {
  // Stable client id for list keys + remove.
  localId: string;
  file: File;
  // Local object URL for the inline preview thumbnail while composing.
  previewUrl: string;
  status: PendingStatus;
  progress: number; // 0..100
  // Server attachment id, set once presign returns (the row exists immediately,
  // pending, even before the PUT finishes).
  attachmentId: string | null;
  error: string | null;
  // The in-flight XHR, so a remove/cancel can abort it.
  xhr: XMLHttpRequest | null;
}

let pendingSeq = 0;
function nextLocalId() {
  pendingSeq += 1;
  return `att-${Date.now()}-${pendingSeq}`;
}

// PUT the file bytes straight to R2 using the presigned URL. We use XHR (not
// fetch) so we get upload progress events. Content-Type MUST match what was
// signed, and we must NOT add extra headers (R2 presign is strict).
function putToR2(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
): { promise: Promise<void>; xhr: XMLHttpRequest } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(
          new Error(
            `Upload failed (${xhr.status}). Please try again.`,
          ),
        );
      }
    };
    xhr.onerror = () =>
      reject(new Error('Network error during upload. Please try again.'));
    xhr.onabort = () => reject(new Error('aborted'));
    xhr.send(file);
  });
  return { promise, xhr };
}

// ---- Hook: composer attachment state ---------------------------------------
// Owns the list of pending attachments for ONE message being composed. Reused
// by every chat surface (DM / channel / project) — they only differ in which
// addMessage they call with collectReadyIds().
export interface UseAttachments {
  pending: PendingAttachment[];
  hasPending: boolean;
  // True while any file is still uploading (send button should wait).
  uploading: boolean;
  // True if every picked file finished uploading (ready to send).
  allReady: boolean;
  addFiles: (files: FileList | File[]) => void;
  remove: (localId: string) => void;
  // Server attachment ids of the READY uploads, in pick order. Call right
  // before sending the message.
  collectReadyIds: () => string[];
  // Clear everything (call after a successful send).
  reset: () => void;
}

export function useAttachments(): UseAttachments {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  // Keep a ref in sync so async upload callbacks update the latest list.
  const pendingRef = useRef<PendingAttachment[]>([]);
  pendingRef.current = pending;

  const patch = useCallback(
    (localId: string, changes: Partial<PendingAttachment>) => {
      setPending((list) =>
        list.map((p) => (p.localId === localId ? { ...p, ...changes } : p)),
      );
    },
    [],
  );

  const startUpload = useCallback(
    async (item: PendingAttachment) => {
      try {
        const dims = await readImageDimensions(item.file);
        const presign = await attachmentsApi.presignUpload({
          kind: 'image',
          mime: item.file.type,
          sizeBytes: item.file.size,
          fileName: item.file.name,
          width: dims.width ?? undefined,
          height: dims.height ?? undefined,
        });
        patch(item.localId, { attachmentId: presign.attachmentId });

        const { promise, xhr } = putToR2(
          presign.uploadUrl,
          item.file,
          (pct) => patch(item.localId, { progress: pct }),
        );
        patch(item.localId, { xhr });
        await promise;
        patch(item.localId, {
          status: 'ready',
          progress: 100,
          xhr: null,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        if (message === 'aborted') return; // removed by user; nothing to show
        patch(item.localId, { status: 'error', error: message, xhr: null });
      }
    },
    [patch],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      const accepted: PendingAttachment[] = [];
      for (const file of arr) {
        if (!isAllowedImage(file)) {
          // Surface a rejected entry so the user sees why it didn't attach.
          accepted.push({
            localId: nextLocalId(),
            file,
            previewUrl: '',
            status: 'error',
            progress: 0,
            attachmentId: null,
            error: 'Only JPG, PNG, GIF, or WebP images are supported.',
            xhr: null,
          });
          continue;
        }
        if (file.size > MAX_IMAGE_BYTES) {
          accepted.push({
            localId: nextLocalId(),
            file,
            previewUrl: '',
            status: 'error',
            progress: 0,
            attachmentId: null,
            error: `Image is too large (max ${humanSize(MAX_IMAGE_BYTES)}).`,
            xhr: null,
          });
          continue;
        }
        accepted.push({
          localId: nextLocalId(),
          file,
          previewUrl: URL.createObjectURL(file),
          status: 'uploading',
          progress: 0,
          attachmentId: null,
          error: null,
          xhr: null,
        });
      }
      if (accepted.length === 0) return;
      setPending((list) => [...list, ...accepted]);
      // Kick off uploads for the valid ones.
      for (const item of accepted) {
        if (item.status === 'uploading') void startUpload(item);
      }
    },
    [startUpload],
  );

  const remove = useCallback((localId: string) => {
    setPending((list) => {
      const item = list.find((p) => p.localId === localId);
      if (item) {
        if (item.xhr) item.xhr.abort();
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
      return list.filter((p) => p.localId !== localId);
    });
  }, []);

  const collectReadyIds = useCallback(() => {
    return pendingRef.current
      .filter((p) => p.status === 'ready' && p.attachmentId)
      .map((p) => p.attachmentId as string);
  }, []);

  const reset = useCallback(() => {
    for (const p of pendingRef.current) {
      if (p.xhr) p.xhr.abort();
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
    }
    setPending([]);
  }, []);

  // Revoke any leftover object URLs on unmount.
  useEffect(() => {
    return () => {
      for (const p of pendingRef.current) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, []);

  const uploading = pending.some((p) => p.status === 'uploading');
  const readyCount = pending.filter((p) => p.status === 'ready').length;

  return {
    pending,
    hasPending: pending.length > 0,
    uploading,
    allReady: pending.length > 0 && readyCount === pending.length,
    addFiles,
    remove,
    collectReadyIds,
    reset,
  };
}

// ---- Composer: pick button + drag-drop zone + pending previews -------------
// Mobile-safe: previews use a wrapping flex row (min-w-0, max-w-full) so they
// never force horizontal scroll.

export function AttachmentPickerButton({
  onPick,
  disabled,
}: {
  onPick: (files: FileList) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        aria-label="Attach images"
        className="flex-shrink-0 p-2 text-gray-400 hover:text-amber-600 disabled:opacity-50"
      >
        <ImageIcon size={18} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onPick(e.target.files);
          }
          // Reset so picking the same file again re-fires onChange.
          e.target.value = '';
        }}
      />
    </>
  );
}

// A pending-uploads strip rendered just above the message input.
export function PendingAttachments({
  attachments,
}: {
  attachments: UseAttachments;
}) {
  const { pending, remove } = attachments;
  if (pending.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2 min-w-0 max-w-full">
      {pending.map((p) => (
        <div
          key={p.localId}
          className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex-shrink-0"
        >
          {p.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.previewUrl}
              alt={p.file.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              <ImageIcon size={20} />
            </div>
          )}

          {/* uploading overlay */}
          {p.status === 'uploading' && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[10px] mt-0.5">{p.progress}%</span>
            </div>
          )}

          {/* error overlay */}
          {p.status === 'error' && (
            <div
              className="absolute inset-0 bg-red-600/70 flex items-center justify-center text-white p-1 text-center"
              title={p.error ?? 'Upload failed'}
            >
              <AlertCircle size={16} />
            </div>
          )}

          <button
            type="button"
            onClick={() => remove(p.localId)}
            aria-label="Remove attachment"
            className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---- Drop zone wrapper -----------------------------------------------------
// Wrap a composer region to accept dragged image files. Renders children and a
// subtle highlight while a drag is over it.
export function AttachmentDropZone({
  attachments,
  disabled,
  className,
  children,
}: {
  attachments: UseAttachments;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      attachments.addFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`${className ?? ''} ${
        over ? 'ring-2 ring-amber-400 ring-inset rounded-lg' : ''
      }`}
    >
      {children}
    </div>
  );
}

// ---- Display: a sent message's image attachments ---------------------------
// Lazily fetches a short-lived signed URL per attachment, with click-to-zoom
// lightbox. If a URL expires (e.g. lightbox opened much later), the fetch is
// re-run on demand. Mobile-safe sizing via max-w-full.

function useSignedUrl(attachmentId: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await attachmentsApi.getUrl(attachmentId);
      setUrl(res.url);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [attachmentId]);

  return { url, loading, failed, load };
}

function AttachmentImage({ attachment }: { attachment: ApiAttachment }) {
  const { url, loading, failed, load } = useSignedUrl(attachment.id);
  const [zoom, setZoom] = useState(false);

  // Fetch the signed URL once the thumbnail mounts.
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id]);

  if (failed) {
    return (
      <button
        type="button"
        onClick={() => void load()}
        className="w-32 h-32 flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 text-[11px]"
      >
        <AlertCircle size={16} />
        Tap to retry
      </button>
    );
  }

  if (loading || !url) {
    return (
      <div className="w-32 h-32 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="block rounded-lg overflow-hidden border border-gray-200 max-w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="attachment"
          className="max-w-[12rem] max-h-48 object-cover w-auto h-auto"
          loading="lazy"
        />
      </button>

      {zoom && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoom(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="attachment"
            className="max-w-full max-h-full object-contain"
            onError={() => {
              // URL may have expired between open and render — re-fetch once.
              void load();
            }}
          />
          <button
            type="button"
            aria-label="Close"
            onClick={() => setZoom(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
          >
            <X size={28} />
          </button>
        </div>
      )}
    </>
  );
}

export function MessageAttachments({
  attachments,
}: {
  attachments: ApiAttachment[] | undefined;
}) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-1.5 min-w-0 max-w-full">
      {attachments.map((a) =>
        a.kind === 'image' ? (
          <AttachmentImage key={a.id} attachment={a} />
        ) : null,
      )}
    </div>
  );
}
