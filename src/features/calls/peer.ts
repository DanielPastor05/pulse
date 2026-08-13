'use client';

import type { CallSignalPayload } from '@/lib/realtime';

type Signal = CallSignalPayload['data'];

type PeerOptions = {
  /** Sends a signal to the other end. The caller owns the transport. */
  send: (data: Signal) => void;
  onTrack: (stream: MediaStream) => void;
  onStateChange: (state: RTCPeerConnectionState) => void;
  /**
   * Perfect negotiation roles. The *polite* peer yields when two offers cross;
   * the impolite one ignores the incoming offer and presses on. Both ends must
   * agree on who is who, so it is derived from the user ids rather than from
   * who happened to press call first — which is exactly what is ambiguous when
   * they press it at the same moment.
   */
  polite: boolean;
  /** Minted per call by the server, so they arrive rather than being read. */
  iceServers: RTCIceServer[];
};

/**
 * One WebRTC connection to one other participant.
 *
 * Implements the W3C perfect negotiation pattern. The failure it prevents is
 * specific and easy to miss in testing: if both sides create an offer at the
 * same time, each receives an offer while already having a local one pending,
 * both throw `InvalidStateError`, and the call dies with no visible cause. Two
 * people calling each other simultaneously is rare enough to never happen while
 * developing and common enough to happen to real users.
 */
export class Peer {
  readonly connection: RTCPeerConnection;

  private makingOffer = false;
  private ignoreOffer = false;
  private readonly options: PeerOptions;
  private closed = false;

  constructor(options: PeerOptions) {
    this.options = options;
    this.connection = new RTCPeerConnection({ iceServers: options.iceServers });

    this.connection.onnegotiationneeded = async () => {
      // Guard so a track added mid-call cannot start a second offer while the
      // first is still in flight.
      try {
        this.makingOffer = true;
        await this.connection.setLocalDescription();
        const sdp = this.connection.localDescription;
        if (sdp) options.send({ kind: 'offer', sdp });
      } catch (error) {
        console.error('[call] negotiation failed', error);
      } finally {
        this.makingOffer = false;
      }
    };

    this.connection.onicecandidate = ({ candidate }) => {
      if (candidate) options.send({ kind: 'candidate', candidate: candidate.toJSON() });
    };

    this.connection.ontrack = ({ streams }) => {
      if (streams[0]) options.onTrack(streams[0]);
    };

    this.connection.onconnectionstatechange = () => {
      options.onStateChange(this.connection.connectionState);
    };

    // A connection that drops mid-call can often recover by re-offering rather
    // than tearing the whole call down.
    this.connection.oniceconnectionstatechange = () => {
      if (this.connection.iceConnectionState === 'failed') this.connection.restartIce();
    };
  }

  addLocalTracks(stream: MediaStream) {
    for (const track of stream.getTracks()) {
      this.connection.addTrack(track, stream);
    }
  }

  async accept(signal: Signal) {
    if (this.closed) return;

    try {
      if (signal.kind === 'candidate') {
        try {
          await this.connection.addIceCandidate(signal.candidate);
        } catch (error) {
          // A candidate arriving for an offer we chose to ignore is expected,
          // not a fault worth surfacing.
          if (!this.ignoreOffer) throw error;
        }
        return;
      }

      const description = signal.sdp;
      const offerCollision =
        description.type === 'offer' &&
        (this.makingOffer || this.connection.signalingState !== 'stable');

      // Here is the whole point of the pattern: on a collision the impolite
      // peer drops the incoming offer and keeps its own, and the polite one
      // rolls back. Without this both ends abort and nothing connects.
      this.ignoreOffer = !this.options.polite && offerCollision;
      if (this.ignoreOffer) return;

      await this.connection.setRemoteDescription(description);

      if (description.type === 'offer') {
        await this.connection.setLocalDescription();
        const answer = this.connection.localDescription;
        if (answer) this.options.send({ kind: 'answer', sdp: answer });
      }
    } catch (error) {
      console.error('[call] could not apply signal', error);
    }
  }

  close() {
    this.closed = true;
    this.connection.onnegotiationneeded = null;
    this.connection.onicecandidate = null;
    this.connection.ontrack = null;
    this.connection.onconnectionstatechange = null;
    this.connection.oniceconnectionstatechange = null;
    this.connection.close();
  }
}

export { isPolite } from '@/features/calls/negotiation';
