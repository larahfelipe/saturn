import { InvalidTrackError } from './errors.ts';

export interface Track {
  readonly artworkUrl: string | undefined;
  readonly durationMs: number;
  readonly id: string;
  readonly requestedBy: string;
  readonly title: string;
  readonly url: string;
}

export function createTrack(props: Track): Track {
  const title = props.title.trim();
  if (props.id.length === 0) throw new InvalidTrackError('id');
  if (title.length === 0) throw new InvalidTrackError('title');
  if (!URL.canParse(props.url)) throw new InvalidTrackError('url');
  if (props.artworkUrl !== undefined && !URL.canParse(props.artworkUrl)) {
    throw new InvalidTrackError('artworkUrl');
  }
  if (!Number.isSafeInteger(props.durationMs) || props.durationMs < 0) {
    throw new InvalidTrackError('durationMs');
  }
  if (props.requestedBy.length === 0) throw new InvalidTrackError('requestedBy');

  return Object.freeze({ ...props, title });
}
