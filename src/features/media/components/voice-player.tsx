'use client';

import * as React from 'react';
import { Pause, Play } from 'lucide-react';

import { cn, formatDuration } from '@/lib/utils';
import type { AttachmentDTO } from '@/types/dto';

/**
 * Voice note player. The waveform captured at record time is replayed as bars
 * that fill as playback advances; clicking a bar seeks there.
 */
export function VoicePlayer({ attachment, mine }: { attachment: AttachmentDTO; mine: boolean }) {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [duration, setDuration] = React.useState(attachment.duration ?? 0);

  const bars = React.useMemo(() => {
    if (attachment.waveform.length > 0) return attachment.waveform;
    // Fall back to a stable pseudo-waveform so the bubble never looks broken.
    return Array.from({ length: 32 }, (_, index) => 0.25 + Math.abs(Math.sin(index * 1.7)) * 0.6);
  }, [attachment.waveform]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  };

  const seekTo = (fraction: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = audio.duration * fraction;
    setProgress(fraction);
  };

  return (
    <div className="flex min-w-[13rem] items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full transition-transform active:scale-90',
          mine ? 'bg-white/20 text-white' : 'bg-[var(--accent)] text-[var(--on-accent)]',
        )}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
      >
        {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
      </button>

      <div
        className="flex h-8 flex-1 items-center gap-[2px]"
        role="slider"
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight') seekTo(Math.min(1, progress + 0.05));
          if (event.key === 'ArrowLeft') seekTo(Math.max(0, progress - 0.05));
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          seekTo((event.clientX - rect.left) / rect.width);
        }}
      >
        {bars.map((value, index) => {
          const filled = index / bars.length <= progress;
          return (
            <span
              key={index}
              className={cn(
                'w-[3px] shrink-0 rounded-full transition-colors duration-100',
                mine
                  ? filled
                    ? 'bg-white'
                    : 'bg-white/35'
                  : filled
                    ? 'bg-[var(--accent)]'
                    : 'bg-[var(--hairline-strong)]',
              )}
              style={{ height: `${Math.max(0.15, Math.min(1, value)) * 100}%` }}
            />
          );
        })}
      </div>

      <span
        className={cn(
          'shrink-0 text-[11px] tabular-nums',
          mine ? 'text-white/80' : 'text-[var(--text-3)]',
        )}
      >
        {formatDuration(progress > 0 ? progress * duration : duration)}
      </span>

      <audio
        ref={audioRef}
        src={attachment.url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) setDuration(value);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (Number.isFinite(audio.duration) && audio.duration > 0) {
            setProgress(audio.currentTime / audio.duration);
          }
        }}
      />
    </div>
  );
}
