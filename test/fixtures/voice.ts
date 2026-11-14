import { EventEmitter } from 'node:events';
import { PassThrough, type Readable } from 'node:stream';

import { VoiceConnectionStatus, type AudioPlayer, type VoiceConnection } from '@discordjs/voice';

import type { AudioSource } from '../../src/application/ports/TrackResolver.ts';

export interface FakeSubscription {
  readonly player: AudioPlayer;
  unsubscribed: boolean;
  unsubscribe(): void;
}

/** The part of `VoiceConnection` the audio adapters use, driven by the test. */
export class FakeVoiceConnection extends EventEmitter {
  state: { status: VoiceConnectionStatus } = { status: VoiceConnectionStatus.Signalling };
  readonly subscriptions: FakeSubscription[] = [];
  destroyCount = 0;

  setStatus(status: VoiceConnectionStatus): void {
    const previous = this.state;
    this.state = { status };
    this.emit('stateChange', previous, this.state);
    this.emit(status, previous, this.state);
  }

  subscribe(player: AudioPlayer): FakeSubscription | undefined {
    if (this.state.status === VoiceConnectionStatus.Destroyed) return undefined;
    const subscription: FakeSubscription = {
      player,
      unsubscribed: false,
      unsubscribe() {
        this.unsubscribed = true;
      },
    };
    this.subscriptions.push(subscription);
    return subscription;
  }

  destroy(): void {
    if (this.state.status === VoiceConnectionStatus.Destroyed) {
      throw new Error('Cannot destroy VoiceConnection - it has already been destroyed');
    }
    this.destroyCount++;
    this.setStatus(VoiceConnectionStatus.Destroyed);
  }

  asConnection(): VoiceConnection {
    return this as unknown as VoiceConnection;
  }
}

/** An audio source whose streams are recorded; by default each emits `data` and ends. */
export class StreamSource implements AudioSource {
  readonly streams: PassThrough[] = [];
  readonly signals: AbortSignal[] = [];
  readonly #data: Buffer;
  readonly #end: boolean;

  constructor(data: Buffer, { end = true }: { end?: boolean } = {}) {
    this.#data = data;
    this.#end = end;
  }

  get stream(): PassThrough | undefined {
    return this.streams.at(-1);
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
