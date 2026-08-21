'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Mic, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn, formatDuration } from '@/lib/utils';
import { useT } from '@/i18n/provider';

export type VoiceRecording = { blob: Blob; duration: number; waveform: number[] };

const WAVEFORM_BARS = 48;

/**
 * Records a voice note and samples the input level while recording, so the
 * bubble can show a real waveform instead of a generic bar.
 */
export function VoiceRecorder({
  onComplete,
  onCancel,
}: {
  onComplete: (recording: VoiceRecording) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const levelsRef = React.useRef<number[]>([]);
  const rafRef = React.useRef<number | null>(null);
  const startedAt = React.useRef(Date.now());
  const cancelledRef = React.useRef(false);

  const [elapsed, setElapsed] = React.useState(0);
  const [levels, setLevels] = React.useState<number[]>([]);

  const stopEverything = React.useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  React.useEffect(() => {
    let disposed = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          stopEverything();
          if (cancelledRef.current) return;

          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          const duration = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));

          // Down-sample the captured levels to a fixed-width waveform.
          const captured = levelsRef.current;
          const step = Math.max(1, Math.floor(captured.length / WAVEFORM_BARS));
          const waveform = Array.from({ length: WAVEFORM_BARS }, (_, index) => {
            const slice = captured.slice(index * step, (index + 1) * step);
            if (slice.length === 0) return 0.2;
            return Number((slice.reduce((sum, value) => sum + value, 0) / slice.length).toFixed(3));
          });

          onComplete({ blob, duration, waveform });
        };

        const context = new AudioContext();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);
        const buffer = new Uint8Array(analyser.frequencyBinCount);

        const sample = () => {
          analyser.getByteTimeDomainData(buffer);
          let peak = 0;
          for (const value of buffer) peak = Math.max(peak, Math.abs(value - 128) / 128);
          levelsRef.current.push(peak);
          setLevels((current) => [...current.slice(-(WAVEFORM_BARS - 1)), peak]);
          setElapsed(Math.round((Date.now() - startedAt.current) / 1000));
          rafRef.current = requestAnimationFrame(sample);
        };

        startedAt.current = Date.now();
        recorder.start(200);
        sample();
      } catch {
        toast.error(t.message.micUnavailable, {
          description: t.message.micUnavailableHint,
        });
        onCancel();
      }
    };

    void start();

    return () => {
      disposed = true;
      cancelledRef.current = true;
      stopEverything();
    };
  }, [onComplete, onCancel, stopEverything, t.message]);

  const finish = () => {
    cancelledRef.current = false;
    recorderRef.current?.stop();
  };

  const discard = () => {
    cancelledRef.current = true;
    recorderRef.current?.stop();
    stopEverything();
    onCancel();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full items-center gap-3 rounded-[var(--radius-card)] bg-[var(--surface-sunken)] px-3 py-2"
    >
      <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--danger)] text-white">
        <Mic className="size-4" />
        <span className="absolute inset-0 animate-[pulse-ring_2s_ease-out_infinite] rounded-full" />
      </span>

      <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden">
        {levels.map((level, index) => (
          <span
            key={index}
            className="w-[3px] shrink-0 rounded-full bg-[var(--accent)]"
            style={{ height: `${Math.max(0.12, level) * 100}%` }}
          />
        ))}
      </div>

      <span className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--text-2)]">
        {formatDuration(elapsed)}
      </span>

      <button
        type="button"
        onClick={discard}
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-[var(--text-3)]',
          'transition-colors hover:bg-[var(--hairline)] hover:text-[var(--danger)]',
        )}
        aria-label={t.message.discardRecording}
      >
        <Trash2 className="size-4" />
      </button>

      <button
        type="button"
        onClick={finish}
        className="bg-[var(--accent)] grid size-9 shrink-0 place-items-center rounded-full text-white transition-transform active:scale-90"
        aria-label={t.message.sendVoice}
      >
        <Send className="size-4" />
      </button>
    </motion.div>
  );
}
