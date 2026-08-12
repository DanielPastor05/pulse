'use client';

import * as React from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { hasTurn } from '@/features/calls/ice';
import { useCall } from '@/features/calls/use-call';
import { useCallStore } from '@/stores/call-store';
import { useSession } from '@/components/providers/session-provider';

/** Attaches a stream without re-rendering the video element on every change. */
function StreamVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function IncomingCall() {
  const { from, mode, conversationName } = useCallStore();
  const { acceptCall, rejectCall } = useCall(useSession().id);

  if (!from) return null;

  return (
    <div className="fixed inset-x-0 top-4 z-50 mx-auto w-[min(24rem,92vw)]">
      <div className="panel flex items-center gap-3 rounded-[var(--radius-card)] p-3 shadow-lg">
        <Avatar src={from.avatarUrl} name={from.displayName} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{from.displayName}</p>
          <p className="truncate text-[12px] text-[var(--text-3)]">
            {mode === 'video' ? 'Video call' : 'Voice call'}
            {conversationName ? ` · ${conversationName}` : ''}
          </p>
        </div>
        <Button size="icon" variant="ghost" aria-label="Decline" onClick={rejectCall}>
          <PhoneOff className="text-[var(--danger)]" />
        </Button>
        <Button size="icon" aria-label="Answer" onClick={() => void acceptCall()}>
          <Phone />
        </Button>
      </div>
    </div>
  );
}

function ActiveCall() {
  const me = useSession();
  const { localStream, remotes, micOn, cameraOn, mode, status } = useCallStore();
  const { leaveCall, toggleMic, toggleCamera } = useCall(me.id);

  const participants = Object.values(remotes);
  // One remote sits large; more than one goes to a grid.
  const columns = participants.length <= 1 ? 1 : participants.length <= 4 ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between p-4 text-white">
        <p className="text-[13px] opacity-80">
          {status === 'joining' ? 'Calling…' : `${participants.length + 1} in call`}
        </p>
        {!hasTurn() ? (
          // Worth saying out loud: without a relay this fails on most mobile
          // networks, and the failure looks like "it just never connects".
          <p className="text-[11px] text-[var(--warning)]">No TURN relay configured</p>
        ) : null}
      </div>

      <div
        className="grid flex-1 gap-2 p-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {participants.map((participant) => (
          <div
            key={participant.userId}
            className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-sunken)]"
          >
            <StreamVideo stream={participant.stream} className="size-full object-cover" />
            {participant.state !== 'connected' ? (
              <p className="absolute inset-0 grid place-items-center text-[13px] text-white/70">
                Connecting…
              </p>
            ) : null}
          </div>
        ))}
        {participants.length === 0 ? (
          <p className="grid place-items-center text-[13px] text-white/60">Waiting for an answer…</p>
        ) : null}
      </div>

      {mode === 'video' ? (
        <StreamVideo
          stream={localStream}
          muted
          className="absolute bottom-24 right-4 h-32 w-24 rounded-[var(--radius-field)] object-cover shadow-lg"
        />
      ) : null}

      <div className="flex items-center justify-center gap-3 p-6">
        <Button
          size="icon"
          className="size-12"
          variant={micOn ? 'secondary' : 'ghost'}
          aria-label={micOn ? 'Mute' : 'Unmute'}
          onClick={toggleMic}
        >
          {micOn ? <Mic /> : <MicOff />}
        </Button>
        {mode === 'video' ? (
          <Button
            size="icon"
            className="size-12"
            variant={cameraOn ? 'secondary' : 'ghost'}
            aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
            onClick={toggleCamera}
          >
            {cameraOn ? <Video /> : <VideoOff />}
          </Button>
        ) : null}
        <Button
          size="icon"
          aria-label="Leave call"
          onClick={leaveCall}
          className={cn('size-12 bg-[var(--danger)] text-white hover:bg-[var(--danger)]')}
        >
          <PhoneOff />
        </Button>
      </div>
    </div>
  );
}

/** Mounted once in the shell so a call outlives navigating between chats. */
export function CallOverlay() {
  const status = useCallStore((state) => state.status);

  if (status === 'idle') return null;
  if (status === 'ringing') return <IncomingCall />;
  return <ActiveCall />;
}
