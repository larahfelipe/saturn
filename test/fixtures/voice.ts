import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { Readable } from 'node:stream';

import { VoiceConnectionDisconnectReason, VoiceConnectionStatus } from '@discordjs/voice';
import type { AudioPlayer, VoiceConnection } from '@discordjs/voice';

import type { AudioSource } from '../../src/application/ports/TrackResolver.ts';

export interface FakeDisconnect {
  readonly closeCode?: number;
  readonly reason?: VoiceConnectionDisconnectReason;
}

export interface FakeSubscription {
  readonly player: AudioPlayer;
  unsubscribe(): void;
  unsubscribed: boolean;
}

export class FakeVoiceConnection extends EventEmitter {
  destroyCount = 0;
  failingRejoins = 0;
  readonly joinConfig: { channelId: string | null } = { channelId: 'voice-1' };
  readonly rejoins: number[] = [];
  state: FakeDisconnect & { status: VoiceConnectionStatus } = {
    status: VoiceConnectionStatus.Signalling,
  };
  readonly subscriptions: FakeSubscription[] = [];

  asConnection(): VoiceConnection {
    return this as unknown as VoiceConnection;
  }

  destroy(): void {
    if (this.state.status === VoiceConnectionStatus.Destroyed) {
      throw new Error('Cannot destroy VoiceConnection - it has already been destroyed');
    }
    this.destroyCount++;
    this.setStatus(VoiceConnectionStatus.Destroyed);
  }

  rejoin(): boolean {
    if (this.state.status === VoiceConnectionStatus.Destroyed) return false;
    this.rejoins.push(performance.now());
    if (this.rejoins.length > this.failingRejoins) {
      this.setStatus(VoiceConnectionStatus.Signalling);
      return true;
    }
    this.setStatus(VoiceConnectionStatus.Disconnected, {
      reason: VoiceConnectionDisconnectReason.AdapterUnavailable,
    });
    return false;
  }

  setStatus(status: VoiceConnectionStatus, disconnect: FakeDisconnect = {}): void {
    const previous = this.state;
    this.state = { status, ...disconnect };
    this.emit('stateChange', previous, this.state);
    this.emit(status, previous, this.state);
  }

  subscribe(player: AudioPlayer): FakeSubscription | undefined {
    if (this.state.status === VoiceConnectionStatus.Destroyed) return undefined;
    const subscription: FakeSubscription = {
      player,
      unsubscribe() {
        this.unsubscribed = true;
      },
      unsubscribed: false,
    };
    this.subscriptions.push(subscription);
    return subscription;
  }
}

export class StreamSource implements AudioSource {
  readonly signals: AbortSignal[] = [];
  readonly streams: PassThrough[] = [];

  get stream(): PassThrough | undefined {
    return this.streams.at(-1);
  }

  readonly #data: Buffer;
  readonly #end: boolean;

  constructor(data: Buffer, { end = true }: { end?: boolean } = {}) {
    this.#data = data;
    this.#end = end;
  }

  open(signal: AbortSignal): Readable {
    const stream = new PassThrough();
    if (this.#end) stream.end(this.#data);
    else stream.write(this.#data);
    this.streams.push(stream);
    this.signals.push(signal);
    return stream;
  }
}
