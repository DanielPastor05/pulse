'use client';

import * as React from 'react';
import {
  Check,
  Mic,
  MicOff,
  MonitorUp,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Menu, MenuContent, MenuItem, MenuLabel, MenuTrigger } from '@/components/ui/menu';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useCallApi } from '@/features/calls/call-provider';
import { useCallStore, type RemoteParticipant } from '@/stores/call-store';
import { useConversation } from '@/features/conversations/hooks';
import { useSession } from '@/components/providers/session-provider';

/**
 * Attaches a stream without re-rendering the video element on every change.
 *
 * `sinkId` es la salida de audio elegida. Sólo Chromium la implementa, así que
 * se aplica cuando existe y se ignora en el resto en vez de esconder el
 * selector: quien no lo tenga no lo echa en falta, y quien sí, lo agradece.
 */
function StreamVideo({
  stream,
  muted,
  sinkId,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  sinkId?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  React.useEffect(() => {
    const element = ref.current as (HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (!element?.setSinkId || !sinkId) return;
    void element.setSinkId(sinkId).catch(() => {});
  }, [sinkId]);

  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function IncomingCall() {
  const { from, mode, conversationName } = useCallStore();
  const { acceptCall, rejectCall } = useCallApi();

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

type TileProps = {
  name: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  /** Uno mismo se silencia siempre: si no, se oye con retardo. */
  muted?: boolean;
  sinkId?: string;
  micOn: boolean;
  cameraOn: boolean;
  sharing: boolean;
  speaking: boolean;
  connecting?: boolean;
  label?: string;
};

/**
 * Un participante.
 *
 * Cuando no hay vídeo se enseña el avatar en grande en vez de un rectángulo
 * negro: la mitad de las llamadas son de voz, y sin esto la pantalla no dice
 * quién está dentro.
 */
function Tile({
  name,
  avatarUrl,
  stream,
  muted,
  sinkId,
  micOn,
  cameraOn,
  sharing,
  speaking,
  connecting,
  label,
}: TileProps) {
  const hasVideo = Boolean(stream?.getVideoTracks().length) && (cameraOn || sharing);

  return (
    <div
      className={cn(
        'relative flex min-h-0 items-center justify-center overflow-hidden rounded-[var(--radius-card)]',
        'bg-[var(--surface-sunken)] ring-2 transition-colors duration-150',
        speaking && micOn ? 'ring-[var(--accent)]' : 'ring-transparent',
      )}
    >
      {hasVideo ? (
        <StreamVideo
          stream={stream}
          muted={muted}
          sinkId={sinkId}
          className={cn('size-full', sharing ? 'object-contain' : 'object-cover')}
        />
      ) : (
        <>
          {/* El audio sigue haciendo falta aunque no haya imagen. */}
          <StreamVideo stream={stream} muted={muted} sinkId={sinkId} className="hidden" />
          <Avatar src={avatarUrl} name={name} size="xl" />
        </>
      )}

      {connecting ? (
        <p className="absolute inset-0 grid place-items-center bg-black/40 text-[13px] text-white/80">
          Connecting…
        </p>
      ) : null}

      <div className="absolute inset-x-2 bottom-2 flex items-center gap-1.5">
        <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[12px] text-white backdrop-blur">
          {micOn ? null : <MicOff className="size-3.5 shrink-0 text-[var(--danger)]" />}
          <span className="truncate">{label ?? name}</span>
        </span>
        {sharing ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)] px-2 py-1 text-[11px] font-medium text-black">
            <MonitorUp className="size-3" />
            Sharing
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Un reloj que corre solo, hacia delante desde `from` o hacia atrás hasta `until`. */
function useTicker() {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function mmss(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** mm:ss desde que la llamada pasó a activa. */
function Duration({ startedAt }: { startedAt: number }) {
  return <span className="tabular-nums">{mmss(useTicker() - startedAt)}</span>;
}

/** Lo que queda para que la llamada se cierre sola. */
function Countdown({ until }: { until: number }) {
  return <span className="tabular-nums">{mmss(until - useTicker())}</span>;
}

/**
 * La llamada de la que te acabas de salir, mientras siga en pie.
 *
 * Se pinta con el estado en `idle`, que es cuando el overlay no existe: colgar
 * sin querer o quedarse sin cobertura no deberían costar volver a llamar.
 */
function RejoinBar() {
  const rejoinable = useCallStore((state) => state.rejoinable);
  const clearRejoin = useCallStore((state) => state.clearRejoin);
  const { rejoinCall } = useCallApi();
  const now = useTicker();

  React.useEffect(() => {
    if (rejoinable && now > rejoinable.expiresAt) clearRejoin();
  }, [rejoinable, now, clearRejoin]);

  if (!rejoinable || now > rejoinable.expiresAt) return null;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(26rem,92vw)]">
      <div className="panel flex items-center gap-3 rounded-[var(--radius-card)] p-3 shadow-lg">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-hover)]">
          <Phone className="size-4 text-[var(--accent)]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">
            {rejoinable.conversationName ?? 'Call'} is still going
          </p>
          <p className="text-[12px] text-[var(--text-3)]">
            Ends in <Countdown until={rejoinable.expiresAt} /> if nobody comes back
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={clearRejoin}>
          Dismiss
        </Button>
        <Button size="sm" onClick={() => void rejoinCall()}>
          Rejoin
        </Button>
      </div>
    </div>
  );
}

/** Las salidas de audio que ofrece el navegador, si es que ofrece alguna. */
function useAudioOutputs() {
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);

  React.useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const read = () => {
      void navigator.mediaDevices
        .enumerateDevices()
        .then((all) => setDevices(all.filter((d) => d.kind === 'audiooutput' && d.deviceId)))
        .catch(() => setDevices([]));
    };

    read();
    // Enchufar unos auriculares en mitad de una llamada es justo cuando esto
    // importa, así que la lista no puede leerse una sola vez.
    navigator.mediaDevices.addEventListener('devicechange', read);
    return () => navigator.mediaDevices.removeEventListener('devicechange', read);
  }, []);

  return devices;
}

function ActiveCall() {
  const me = useSession();
  const {
    localStream,
    remotes,
    micOn,
    cameraOn,
    sharing,
    speaking,
    mode,
    status,
    conversationId,
    conversationName,
    startedAt,
    waitingFor,
  } = useCallStore();
  const { leaveCall, toggleMic, toggleCamera, shareScreen, hasRelay } = useCallApi();

  const { data: conversation } = useConversation(conversationId ?? undefined);
  const outputs = useAudioOutputs();
  const [sinkId, setSinkId] = React.useState<string>('');

  /** userId -> quién es. Sin esto los recuadros serían UUIDs. */
  const people = React.useMemo(() => {
    const map = new Map<string, { displayName: string; avatarUrl: string | null }>();
    for (const member of conversation?.members ?? []) {
      map.set(member.user.id, {
        displayName: member.nickname ?? member.user.displayName,
        avatarUrl: member.user.avatarUrl,
      });
    }
    return map;
  }, [conversation]);

  const participants: RemoteParticipant[] = Object.values(remotes);
  const total = participants.length + 1;
  const columns = total <= 1 ? 1 : total <= 4 ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between gap-3 p-4 text-white">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{conversationName ?? 'Call'}</p>
          <p className="text-[12px] text-white/60">
            {status === 'joining' ? (
              'Calling…'
            ) : (
              <>
                {total} in call
                {startedAt ? (
                  <>
                    {' · '}
                    <Duration startedAt={startedAt} />
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
        {!hasRelay ? (
          // Worth saying out loud: without a relay this fails on most mobile
          // networks, and the failure looks like "it just never connects".
          <p className="shrink-0 text-[11px] text-[var(--warning)]">No TURN relay</p>
        ) : null}
      </div>

      <div
        className="grid flex-1 gap-2 p-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        <Tile
          name={me.displayName}
          label={`${me.displayName} (you)`}
          avatarUrl={me.avatarUrl}
          stream={localStream}
          muted
          micOn={micOn}
          cameraOn={cameraOn}
          sharing={sharing}
          speaking={speaking}
        />

        {participants.map((participant) => {
          const person = people.get(participant.userId);
          return (
            <Tile
              key={participant.userId}
              name={person?.displayName ?? 'Someone'}
              avatarUrl={person?.avatarUrl ?? null}
              stream={participant.stream}
              sinkId={sinkId || undefined}
              micOn={participant.micOn}
              cameraOn={participant.cameraOn}
              sharing={participant.sharing}
              speaking={participant.speaking}
              connecting={participant.state !== 'connected'}
            />
          );
        })}

        {participants.length === 0 ? (
          <div className="grid place-items-center gap-1 text-center">
            {waitingFor ? (
              // Quedarse solo porque el otro colgó y que aún no lo haya cogido
              // nadie se ven igual —una llamada sin nadie enfrente— y no son lo
              // mismo para quien la está mirando.
              <>
                <p className="text-[13px] text-white/80">
                  {people.get(waitingFor.userId)?.displayName ?? 'They'} left — they can rejoin
                </p>
                <p className="text-[12px] text-white/50">
                  Ending in <Countdown until={waitingFor.until} />
                </p>
              </>
            ) : (
              <p className="text-[13px] text-white/60">Waiting for an answer…</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 p-6">
        <Tooltip content={micOn ? 'Mute' : 'Unmute'}>
          <Button
            size="icon"
            className="size-12"
            variant={micOn ? 'secondary' : 'ghost'}
            aria-label={micOn ? 'Mute' : 'Unmute'}
            onClick={toggleMic}
          >
            {micOn ? <Mic /> : <MicOff />}
          </Button>
        </Tooltip>

        {mode === 'video' ? (
          <Tooltip content={cameraOn ? 'Turn camera off' : 'Turn camera on'}>
            <Button
              size="icon"
              className="size-12"
              variant={cameraOn ? 'secondary' : 'ghost'}
              aria-label={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              onClick={toggleCamera}
            >
              {cameraOn ? <Video /> : <VideoOff />}
            </Button>
          </Tooltip>
        ) : null}

        <Tooltip content={sharing ? 'Stop sharing' : 'Share your screen'}>
          <Button
            size="icon"
            className="size-12"
            variant={sharing ? 'primary' : 'secondary'}
            aria-label={sharing ? 'Stop sharing' : 'Share your screen'}
            onClick={() => void shareScreen()}
          >
            <MonitorUp />
          </Button>
        </Tooltip>

        {outputs.length > 0 ? (
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon" className="size-12" variant="secondary" aria-label="Speaker">
                <Volume2 />
              </Button>
            </MenuTrigger>
            <MenuContent align="center">
              <MenuLabel>Speaker</MenuLabel>
              {outputs.map((device, index) => (
                <MenuItem key={device.deviceId} onSelect={() => setSinkId(device.deviceId)}>
                  {sinkId === device.deviceId ? (
                    <Check className="size-4" />
                  ) : (
                    <span className="size-4" />
                  )}
                  {device.label || `Output ${index + 1}`}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        ) : null}

        <Tooltip content="Leave call">
          <Button
            size="icon"
            aria-label="Leave call"
            onClick={leaveCall}
            className={cn('size-12 bg-[var(--danger)] text-white hover:bg-[var(--danger)]')}
          >
            <PhoneOff />
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

/** Mounted once in the shell so a call outlives navigating between chats. */
export function CallOverlay() {
  const status = useCallStore((state) => state.status);

  // En reposo no siempre hay «nada»: puede quedar una llamada a la que volver.
  if (status === 'idle') return <RejoinBar />;
  if (status === 'ringing') return <IncomingCall />;
  return <ActiveCall />;
}
