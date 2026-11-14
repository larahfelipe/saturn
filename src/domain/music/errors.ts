import { SaturnError } from '../../shared/errors.ts';
import type { PlaybackEvent, PlaybackStatus } from './PlaybackState.ts';

export abstract class DomainError extends SaturnError {}

export class InvalidTrackError extends DomainError {
  readonly field: string;

  constructor(field: string) {
    super(`Invalid track ${field}`);
    this.field = field;
  }
}

export class InvalidPlaybackTransitionError extends DomainError {
  readonly from: PlaybackStatus;
  readonly event: PlaybackEvent<unknown>['type'];

  constructor(from: PlaybackStatus, event: PlaybackEvent<unknown>['type']) {
    super(`Cannot apply "${event}" while ${from}`);
    this.from = from;
    this.event = event;
  }
}
