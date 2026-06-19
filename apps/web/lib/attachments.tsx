'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import {
  ImageIcon,
  Loader2,
  X,
  AlertCircle,
  Paperclip,
  Download,
  Video as VideoIcon,
  Mic,
  Square,
  Trash2,
  Type as TypeIcon,
  Send as SendIcon,
  RotateCcw,
} from 'lucide-react';
import { attachments as attachmentsApi, type ApiAttachment } from './api';

// ---- Client-side validation rules (mirror the server) ----------------------
// The foundation is generic; the UI gates to images + videos. Caps are
// per-kind (images 25MB, video 100MB) to match the server.
const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];
const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm', 'video/quicktime'];
// Lenient set of audio mimes mirroring the server. MediaRecorder + mobile
// browsers report several spellings for the same container.
const ALLOWED_AUDIO_MIME = [
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
];
const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25MB

type UploadKind = 'image' | 'video' | 'audio';

export function isAllowedImage(file: File): boolean {
  return ALLOWED_IMAGE_MIME.includes(file.type);
}

export function isAllowedVideo(file: File): boolean {
  return ALLOWED_VIDEO_MIME.includes(file.type);
}

export function isAllowedAudio(file: File): boolean {
  // Match on the base mime (strip any ;codecs=… suffix MediaRecorder appends).
  const base = file.type.split(';')[0].trim().toLowerCase();
  return ALLOWED_AUDIO_MIME.includes(base);
}

// Classify a picked file into an upload kind, or null if unsupported.
function classifyFile(file: File): UploadKind | null {
  if (isAllowedImage(file)) return 'image';
  if (isAllowedVideo(file)) return 'video';
  if (isAllowedAudio(file)) return 'audio';
  return null;
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

// Read a video's duration (ms) and pixel dimensions in the browser, so we can
// pass them to the presign call. Best-effort: on any failure we resolve with
// nulls rather than blocking the upload.
function readVideoMetadata(file: File): Promise<{
  durationMs: number | null;
  width: number | null;
  height: number | null;
}> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve({ durationMs: null, width: null, height: null });
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const done = (
      result: {
        durationMs: number | null;
        width: number | null;
        height: number | null;
      },
    ) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(result);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const durSec = video.duration;
      done({
        durationMs:
          Number.isFinite(durSec) && durSec > 0
            ? Math.round(durSec * 1000)
            : null,
        width: video.videoWidth || null,
        height: video.videoHeight || null,
      });
    };
    video.onerror = () => done({ durationMs: null, width: null, height: null });
    // Guard against metadata never loading (resolve after a short timeout).
    setTimeout(
      () => done({ durationMs: null, width: null, height: null }),
      5000,
    );
    video.src = url;
  });
}

// Read an audio file's duration (ms) in the browser. Best-effort: resolves null
// on any failure rather than blocking the upload. Note that webm/opus blobs from
// MediaRecorder often report Infinity here — the recorder tracks its own elapsed
// time and passes that instead, so this is only used for picked audio files.
function readAudioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      resolve(null);
      return;
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const done = (ms: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const durSec = audio.duration;
      done(
        Number.isFinite(durSec) && durSec > 0
          ? Math.round(durSec * 1000)
          : null,
      );
    };
    audio.onerror = () => done(null);
    setTimeout(() => done(null), 5000);
    audio.src = url;
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
  // Upload kind once classified ('image' | 'video'). Rejected files keep the
  // best guess (or 'image') purely for the preview icon.
  kind: UploadKind;
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
  // Pre-known duration (ms), supplied for in-browser recordings whose blob
  // metadata is unreliable. Null means "read it from the file".
  knownDurationMs?: number | null;
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
  // Add a recorded audio blob (known mime + elapsed duration) and start its
  // upload. Returns the localId so a caller (e.g. STT mode) can track it.
  addRecording: (blob: Blob, mime: string, durationMs: number) => string;
  remove: (localId: string) => void;
  // Look up a pending item (e.g. to read its attachmentId after upload).
  get: (localId: string) => PendingAttachment | undefined;
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
        let width: number | null = null;
        let height: number | null = null;
        let durationMs: number | null = null;
        if (item.kind === 'video') {
          const meta = await readVideoMetadata(item.file);
          width = meta.width;
          height = meta.height;
          durationMs = meta.durationMs;
        } else if (item.kind === 'audio') {
          durationMs =
            item.knownDurationMs != null
              ? item.knownDurationMs
              : await readAudioDuration(item.file);
        } else {
          const dims = await readImageDimensions(item.file);
          width = dims.width;
          height = dims.height;
        }
        const presign = await attachmentsApi.presignUpload({
          kind: item.kind,
          mime: item.file.type,
          sizeBytes: item.file.size,
          fileName: item.file.name,
          width: width ?? undefined,
          height: height ?? undefined,
          durationMs: durationMs ?? undefined,
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
        const kind = classifyFile(file);
        if (!kind) {
          // Surface a rejected entry so the user sees why it didn't attach.
          accepted.push({
            localId: nextLocalId(),
            file,
            kind: 'image',
            previewUrl: '',
            status: 'error',
            progress: 0,
            attachmentId: null,
            error:
              'Unsupported file. Allowed: JPG, PNG, GIF, WebP images, MP4, WebM, MOV videos, or common audio (mp3, m4a, wav, ogg, webm).',
            xhr: null,
          });
          continue;
        }
        const maxBytes =
          kind === 'video'
            ? MAX_VIDEO_BYTES
            : kind === 'audio'
              ? MAX_AUDIO_BYTES
              : MAX_IMAGE_BYTES;
        if (file.size > maxBytes) {
          const label =
            kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : 'Image';
          accepted.push({
            localId: nextLocalId(),
            file,
            kind,
            previewUrl: '',
            status: 'error',
            progress: 0,
            attachmentId: null,
            error: `${label} is too large (max ${humanSize(maxBytes)}).`,
            xhr: null,
          });
          continue;
        }
        accepted.push({
          localId: nextLocalId(),
          file,
          kind,
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

  const addRecording = useCallback(
    (blob: Blob, mime: string, durationMs: number) => {
      const base = mime.split(';')[0].trim().toLowerCase();
      const ext = base.includes('mp4') || base.includes('m4a')
        ? 'm4a'
        : base.includes('mpeg') || base.includes('mp3')
          ? 'mp3'
          : base.includes('wav')
            ? 'wav'
            : base.includes('ogg')
              ? 'ogg'
              : 'webm';
      const file = new File([blob], `voice-memo.${ext}`, { type: base });
      const item: PendingAttachment = {
        localId: nextLocalId(),
        file,
        kind: 'audio',
        previewUrl: '',
        status: 'uploading',
        progress: 0,
        attachmentId: null,
        error: null,
        xhr: null,
        knownDurationMs: durationMs > 0 ? durationMs : null,
      };
      setPending((list) => [...list, item]);
      void startUpload(item);
      return item.localId;
    },
    [startUpload],
  );

  const get = useCallback(
    (localId: string) => pendingRef.current.find((p) => p.localId === localId),
    [],
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
    addRecording,
    get,
    remove,
    collectReadyIds,
    reset,
  };
}

// ---- Standalone audio upload (used by STT mode) ----------------------------
// Presigns + PUTs a recorded blob to R2 WITHOUT adding it to the composer's
// pending strip, then returns the pending attachmentId so the caller can
// transcribe it. STT recordings are not shown as message attachments.
export async function uploadAudioBlob(
  blob: Blob,
  mime: string,
  durationMs: number,
): Promise<{ attachmentId: string }> {
  const base = mime.split(';')[0].trim().toLowerCase();
  const ext = base.includes('mp4') || base.includes('m4a')
    ? 'm4a'
    : base.includes('mpeg') || base.includes('mp3')
      ? 'mp3'
      : base.includes('wav')
        ? 'wav'
        : base.includes('ogg')
          ? 'ogg'
          : 'webm';
  const presign = await attachmentsApi.presignUpload({
    kind: 'audio',
    mime: base,
    sizeBytes: blob.size,
    fileName: `recording.${ext}`,
    durationMs: durationMs > 0 ? durationMs : undefined,
  });
  const file = new File([blob], `recording.${ext}`, { type: base });
  const { promise } = putToR2(presign.uploadUrl, file, () => {});
  await promise;
  return { attachmentId: presign.attachmentId };
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
        aria-label="Attach images, videos, or audio"
        className="flex-shrink-0 p-2 text-gray-400 hover:text-amber-600 disabled:opacity-50"
      >
        <Paperclip size={18} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,video/quicktime,audio/webm,audio/mp4,audio/m4a,audio/x-m4a,audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg"
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
          {p.previewUrl && p.kind === 'video' ? (
            <video
              src={p.previewUrl}
              className="w-full h-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : p.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.previewUrl}
              alt={p.file.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300">
              {p.kind === 'video' ? (
                <VideoIcon size={20} />
              ) : p.kind === 'audio' ? (
                <Mic size={20} />
              ) : (
                <ImageIcon size={20} />
              )}
            </div>
          )}

          {/* video badge so the kind is obvious in the composer strip */}
          {p.kind === 'video' && p.status !== 'error' && (
            <div className="absolute bottom-0.5 left-0.5 bg-black/60 text-white rounded px-1 py-px flex items-center gap-0.5 pointer-events-none">
              <VideoIcon size={10} />
            </div>
          )}

          {/* audio badge + label */}
          {p.kind === 'audio' && p.status !== 'error' && (
            <div className="absolute bottom-0.5 left-0.5 bg-black/60 text-white rounded px-1 py-px flex items-center gap-0.5 pointer-events-none">
              <Mic size={10} />
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

function formatDuration(ms: number | null): string | null {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// A sent video attachment: native <video controls> with a short-lived signed
// URL. On playback error (codec the browser can't decode) we fall back to a
// download link. If the URL expires we re-fetch on demand, same as images.
function AttachmentVideo({ attachment }: { attachment: ApiAttachment }) {
  const { url, loading, failed, load } = useSignedUrl(attachment.id);
  const [playbackError, setPlaybackError] = useState(false);
  // Allow one silent re-fetch (covers an expired URL) before falling back to a
  // download link (covers a codec the browser genuinely can't decode).
  const retriedRef = useRef(false);
  const dur = formatDuration(attachment.durationMs);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id]);

  if (failed) {
    return (
      <button
        type="button"
        onClick={() => void load()}
        className="w-48 h-32 flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 text-[11px]"
      >
        <AlertCircle size={16} />
        Tap to retry
      </button>
    );
  }

  if (loading || !url) {
    return (
      <div className="w-48 h-32 flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-300">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (playbackError) {
    return (
      <a
        href={url}
        download
        className="w-48 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-500 text-xs hover:bg-gray-100"
      >
        <Download size={18} />
        <span className="text-center">
          This video can&apos;t play here. Download
          {dur ? ` (${dur})` : ''}.
        </span>
      </a>
    );
  }

  return (
    <div className="relative min-w-0 max-w-full">
      <video
        src={url}
        controls
        playsInline
        preload="metadata"
        className="rounded-lg border border-gray-200 max-w-[18rem] max-h-72 w-auto h-auto min-w-0"
        onError={() => {
          // URL may have expired between fetch and play — re-fetch once before
          // declaring the codec unplayable.
          if (!retriedRef.current) {
            retriedRef.current = true;
            void load();
            return;
          }
          setPlaybackError(true);
        }}
      />
      {dur && (
        <span className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] rounded px-1 py-px pointer-events-none">
          {dur}
        </span>
      )}
    </div>
  );
}

// A sent voice memo: native <audio controls> with a short-lived signed URL.
// Mobile-safe (max-w-full, no horizontal overflow). On an expired URL we
// re-fetch once; on a genuine playback/codec error we fall back to a download
// link. Mirrors AttachmentVideo's recovery flow.
function AttachmentAudio({ attachment }: { attachment: ApiAttachment }) {
  const { url, loading, failed, load } = useSignedUrl(attachment.id);
  const [playbackError, setPlaybackError] = useState(false);
  const retriedRef = useRef(false);
  const dur = formatDuration(attachment.durationMs);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachment.id]);

  if (failed) {
    return (
      <button
        type="button"
        onClick={() => void load()}
        className="w-56 max-w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-400 text-[11px]"
      >
        <AlertCircle size={16} />
        Tap to retry
      </button>
    );
  }

  if (loading || !url) {
    return (
      <div className="w-56 max-w-full flex items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-300">
        <Loader2 size={18} className="animate-spin" />
      </div>
    );
  }

  if (playbackError) {
    return (
      <a
        href={url}
        download
        className="w-56 max-w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-gray-500 text-xs hover:bg-gray-100"
      >
        <Download size={16} />
        <span>Download voice memo{dur ? ` (${dur})` : ''}</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-2 min-w-0 max-w-full">
      <Mic size={16} className="text-amber-600 flex-shrink-0" />
      <audio
        src={url}
        controls
        preload="metadata"
        className="max-w-full min-w-0"
        onError={() => {
          if (!retriedRef.current) {
            retriedRef.current = true;
            void load();
            return;
          }
          setPlaybackError(true);
        }}
      />
      {dur && (
        <span className="text-[11px] text-gray-400 flex-shrink-0">{dur}</span>
      )}
    </div>
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
      {attachments.map((a) => {
        if (a.kind === 'image') {
          return <AttachmentImage key={a.id} attachment={a} />;
        }
        if (a.kind === 'video') {
          return <AttachmentVideo key={a.id} attachment={a} />;
        }
        if (a.kind === 'audio') {
          return <AttachmentAudio key={a.id} attachment={a} />;
        }
        return null;
      })}
    </div>
  );
}

// ---- Voice recorder: mic button + mode toggle ------------------------------
// One mic control with a small toggle: "Send as voice" (default) records a
// voice memo and stages it as a message attachment; "Transcribe to text" uploads
// the recording, runs Whisper server-side, and drops the transcript into the
// composer for the user to edit. Recordings auto-stop at 5:00.

const MAX_RECORDING_MS = 5 * 60 * 1000; // 5 minutes
const RECORDING_WARN_MS = MAX_RECORDING_MS - 30 * 1000; // warn in last 30s

type RecordMode = 'voice' | 'text';

// Pick a MediaRecorder mime the browser actually supports, preferring
// webm/opus, then mp4, then whatever default the recorder chooses.
function pickRecorderMime(): string | undefined {
  if (
    typeof MediaRecorder === 'undefined' ||
    typeof MediaRecorder.isTypeSupported !== 'function'
  ) {
    return undefined;
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return undefined;
}

function fmtElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type RecorderPhase =
  | 'idle'
  | 'recording'
  | 'processing' // uploading / transcribing
  | 'recovery'; // STT failed, holding the recording

export function MicRecorderControl({
  attachments,
  onTranscribed,
  disabled,
}: {
  attachments: UseAttachments;
  // Called in STT mode with the transcript; the composer appends it to its input.
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<RecordMode>('voice');
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The blob produced on stop, used by STT recovery (retry / send as memo).
  const lastBlobRef = useRef<{ blob: Blob; mime: string; durationMs: number } | null>(
    null,
  );
  // When true, a stop was a user cancel — discard the result instead of using it.
  const cancelledRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const releaseStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearTimer();
      releaseStream();
    };
  }, []);

  // Handle the recorded blob once recording stops (not on cancel).
  const handleStopped = useCallback(
    async (mime: string, durationMs: number) => {
      const blob = new Blob(chunksRef.current, { type: mime });
      chunksRef.current = [];
      if (blob.size === 0) {
        setPhase('idle');
        setError('Recording was empty. Please try again.');
        return;
      }
      lastBlobRef.current = { blob, mime, durationMs };

      if (mode === 'voice') {
        // Stage as a message attachment.
        attachments.addRecording(blob, mime, durationMs);
        setPhase('idle');
        return;
      }

      // STT mode: upload + transcribe.
      await runTranscription(blob, mime, durationMs);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, attachments],
  );

  const runTranscription = useCallback(
    async (blob: Blob, mime: string, durationMs: number) => {
      setPhase('processing');
      setError(null);
      try {
        const { attachmentId } = await uploadAudioBlob(blob, mime, durationMs);
        const { text } = await attachmentsApi.transcribe(attachmentId);
        if (!text) {
          setPhase('recovery');
          setError('No speech detected. Retry, or send it as a voice memo.');
          return;
        }
        onTranscribed(text);
        lastBlobRef.current = null;
        setPhase('idle');
      } catch (err) {
        // Keep the recording; offer recovery options. Surface the real error.
        const message =
          err instanceof Error ? err.message : 'Transcription failed.';
        setPhase('recovery');
        setError(message);
      }
    },
    [onTranscribed],
  );

  const start = useCallback(async () => {
    setError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setError(
        'Recording is not supported in this browser. Use the attach button to upload an audio file instead.',
      );
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      // Permission denied or no mic — fall back to file upload.
      setError(
        'Microphone access was blocked. Allow it in your browser, or use the attach button to upload an audio file.',
      );
      return;
    }
    streamRef.current = stream;
    chunksRef.current = [];
    cancelledRef.current = false;
    const mime = pickRecorderMime();
    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
    } catch {
      recorder = new MediaRecorder(stream);
    }
    recorderRef.current = recorder;
    const actualMime = recorder.mimeType || mime || 'audio/webm';

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      clearTimer();
      releaseStream();
      const durationMs = Date.now() - startedAtRef.current;
      if (cancelledRef.current) {
        chunksRef.current = [];
        setPhase('idle');
        setElapsed(0);
        return;
      }
      void handleStopped(actualMime, durationMs);
      setElapsed(0);
    };

    startedAtRef.current = Date.now();
    recorder.start();
    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      if (ms >= MAX_RECORDING_MS) {
        // Auto-stop at the cap.
        if (recorderRef.current && recorderRef.current.state !== 'inactive') {
          recorderRef.current.stop();
        }
      }
    }, 250);
  }, [handleStopped]);

  const stop = useCallback(() => {
    cancelledRef.current = false;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    } else {
      clearTimer();
      releaseStream();
      chunksRef.current = [];
      setPhase('idle');
      setElapsed(0);
    }
  }, []);

  // STT recovery actions.
  const retryTranscription = useCallback(() => {
    const last = lastBlobRef.current;
    if (!last) {
      setPhase('idle');
      return;
    }
    void runTranscription(last.blob, last.mime, last.durationMs);
  }, [runTranscription]);

  const sendAsVoiceMemo = useCallback(() => {
    const last = lastBlobRef.current;
    if (last) {
      attachments.addRecording(last.blob, last.mime, last.durationMs);
    }
    lastBlobRef.current = null;
    setError(null);
    setPhase('idle');
  }, [attachments]);

  const dismissRecovery = useCallback(() => {
    lastBlobRef.current = null;
    setError(null);
    setPhase('idle');
  }, []);

  // ---- Render ----
  const near = elapsed >= RECORDING_WARN_MS;

  if (phase === 'recording') {
    return (
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={cancel}
          aria-label="Cancel recording"
          className="p-2 text-gray-400 hover:text-red-600"
        >
          <Trash2 size={18} />
        </button>
        <span
          className={`text-xs tabular-nums font-medium ${
            near ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5 animate-pulse align-middle" />
          {fmtElapsed(elapsed)}
          {near && ' / 5:00'}
        </span>
        <button
          type="button"
          onClick={stop}
          aria-label="Stop recording"
          className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600"
        >
          <Square size={16} />
        </button>
      </div>
    );
  }

  if (phase === 'processing') {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs text-gray-500 px-2">
        <Loader2 size={16} className="animate-spin" />
        {mode === 'text' ? 'Transcribing…' : 'Uploading…'}
      </div>
    );
  }

  if (phase === 'recovery') {
    return (
      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs">
        <span className="text-red-600 max-w-[10rem] truncate" title={error ?? ''}>
          Transcription failed
        </span>
        <button
          type="button"
          onClick={retryTranscription}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <RotateCcw size={12} /> Retry
        </button>
        <button
          type="button"
          onClick={sendAsVoiceMemo}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600"
        >
          <SendIcon size={12} /> Send as voice
        </button>
        <button
          type="button"
          onClick={dismissRecovery}
          aria-label="Discard recording"
          className="p-1 text-gray-400 hover:text-gray-600"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => void start()}
        aria-label={
          mode === 'text' ? 'Record and transcribe to text' : 'Record a voice memo'
        }
        title={
          mode === 'text' ? 'Record and transcribe to text' : 'Record a voice memo'
        }
        className="p-2 text-gray-400 hover:text-amber-600 disabled:opacity-50"
      >
        <Mic size={18} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setMode((m) => (m === 'voice' ? 'text' : 'voice'))}
        title={
          mode === 'voice'
            ? 'Mode: send as voice memo (tap to switch to transcribe)'
            : 'Mode: transcribe to text (tap to switch to voice memo)'
        }
        className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md border disabled:opacity-50 ${
          mode === 'text'
            ? 'border-amber-300 bg-amber-50 text-amber-700'
            : 'border-gray-200 bg-white text-gray-500'
        }`}
      >
        {mode === 'text' ? <TypeIcon size={11} /> : <Mic size={11} />}
        {mode === 'text' ? 'Text' : 'Voice'}
      </button>
      {error && (
        <span
          className="text-[10px] text-red-600 max-w-[12rem] leading-tight"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
