'use client';

import * as React from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { uploadFile } from '@/features/media/upload';
import { Avatar } from '@/components/ui/avatar';
import { useT } from '@/i18n/provider';

type AvatarPickerProps = {
  value: string | null;
  name: string;
  onChange: (url: string | null) => void;
  size?: 'lg' | 'xl';
};

export function AvatarPicker({ value, name, onChange, size = 'xl' }: AvatarPickerProps) {
  const t = useT();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t.settings.pickImage);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadFile(file, { bucket: 'avatars' });
      onChange(uploaded.url);
    } catch (error) {
      toast.error(t.settings.uploadFailed, {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className={cn(
          'group relative rounded-full outline-none transition-transform',
          'hover:scale-[1.03] active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        )}
        aria-label={t.settings.uploadPicture}
      >
        <Avatar src={value} name={name || t.common.you} size={size} />
        <span
          className={cn(
            'absolute inset-0 grid place-items-center rounded-full bg-black/55 text-white',
            'opacity-0 transition-opacity duration-200 group-hover:opacity-100',
            // Sin ratón no hay hover: en un móvil, cambiar la foto era
            // un botón invisible encima del avatar.
            '[@media(hover:none)]:opacity-100',
            uploading && 'opacity-100',
          )}
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
        </span>
      </button>

      <div className="space-y-1">
        <p className="text-[13px] font-medium">{t.settings.profilePicture}</p>
        <p className="text-[12px] text-[var(--text-2)]">{t.settings.pictureHint}</p>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--danger)] hover:underline"
          >
            <Trash2 className="size-3" />
            {t.settings.removePicture}
          </button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
    </div>
  );
}
