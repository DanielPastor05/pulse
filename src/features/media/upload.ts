import type { AttachmentKind } from '@prisma/client';

import { api } from '@/lib/api-client';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  publicUrl: string;
};

export type UploadedFile = {
  kind: AttachmentKind;
  url: string;
  path: string;
  name: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  waveform: number[];
};

export function kindFor(mimeType: string, isVoiceNote = false): AttachmentKind {
  if (isVoiceNote) return 'VOICE';
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

/** Reads intrinsic dimensions so image bubbles can reserve space before load. */
async function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return null;

  const url = URL.createObjectURL(file);
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type UploadOptions = {
  bucket?: 'attachments' | 'avatars';
  isVoiceNote?: boolean;
  duration?: number;
  waveform?: number[];
  onProgress?: (fraction: number) => void;
};

/**
 * Uploads straight from the browser to Supabase Storage using a short-lived
 * signed URL minted by our API — the app server never handles the bytes.
 */
export async function uploadFile(file: File, options: UploadOptions = {}): Promise<UploadedFile> {
  const signed = await api<SignedUpload>('/uploads', {
    method: 'POST',
    body: {
      bucket: options.bucket ?? 'attachments',
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    },
  });

  options.onProgress?.(0.1);

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.storage
    .from(signed.bucket)
    .uploadToSignedUrl(signed.path, signed.token, file, {
      contentType: file.type || 'application/octet-stream',
    });

  if (error) throw new Error(error.message);
  options.onProgress?.(1);

  const dimensions = await measureImage(file);

  return {
    kind: kindFor(file.type, options.isVoiceNote),
    url: signed.publicUrl,
    path: signed.path,
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    duration: options.duration ?? null,
    waveform: options.waveform ?? [],
  };
}
