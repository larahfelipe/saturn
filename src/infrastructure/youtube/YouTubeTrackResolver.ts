import type { Readable } from 'node:stream';

import {
  parseVideoId,
  YtdlError,
  YtdlErrorCode,
  type DownloadOptions,
  type LookupOptions,
  type Thumbnail,
  type VideoFormat,
  type VideoInfo,
} from '@distube/ytdl-core';

import {
  InvalidTrackUrlError,
  NoAudioFormatError,
  TrackResolutionError,
  TrackUnavailableError,
} from '../../application/errors.ts';
import type {
  ResolvedTrack,
  TrackRequest,
  TrackResolver,
} from '../../application/ports/TrackResolver.ts';
import { createTrack } from '../../domain/music/Track.ts';

/** The subset of `Ytdl` the resolver depends on. */
export interface YouTubeClient {
  getInfo(video: string, options?: LookupOptions): Promise<VideoInfo>;
  download(video: VideoInfo, options?: DownloadOptions): Readable;
}

const SUPPORTED_HOSTS: ReadonlySet<string> = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
]);

/**
 * Source audio buffered ahead of playback: about a minute at YouTube's audio
 * bitrates, so playback continues while ytdl resumes a stalled download.
 */
export const READ_AHEAD_BYTES = 1024 * 1024;

/**
 * ytdl's limit for a response's headers or next body chunk. ytdl resumes a
 * download from where it stopped once this expires, well before
 * `READ_AHEAD_BYTES` of audio runs out.
 */
export const YOUTUBE_REQUEST_TIMEOUT_MS = 10_000;

const UNAVAILABLE_CODES: ReadonlySet<YtdlErrorCode> = new Set([
  YtdlErrorCode.NOT_FOUND,
  YtdlErrorCode.PRIVATE,
  YtdlErrorCode.AGE_RESTRICTED,
  YtdlErrorCode.MEMBERS_ONLY,
  YtdlErrorCode.PREMIUM_ONLY,
  YtdlErrorCode.REGION_BLOCKED,
  YtdlErrorCode.NOT_STARTED,
]);

/**
 * Returns the video ID of an `https` YouTube video URL on a supported host.
 *
 * @throws InvalidTrackUrlError
 */
export function parseYouTubeVideoUrl(input: string): string {
  const url = URL.parse(input.trim());
  const videoId =
    url?.protocol === 'https:' && SUPPORTED_HOSTS.has(url.hostname)
      ? parseVideoId(url.href)
      : undefined;
  if (videoId === undefined) throw new InvalidTrackUrlError();
  return videoId;
}

export class YouTubeTrackResolver implements TrackResolver {
  readonly #client: YouTubeClient;

  constructor(client: YouTubeClient) {
    this.#client = client;
  }

  async resolve(request: TrackRequest, signal: AbortSignal): Promise<ResolvedTrack> {
    const videoId = parseYouTubeVideoUrl(request.url);

    let info: VideoInfo;
    try {
      info = await this.#client.getInfo(videoId, { signal });
    } catch (error) {
      throw signal.aborted ? signal.reason : toResolutionError(error);
    }

    const format = selectAudioFormat(info.formats);
    const details = info.videoDetails;
    const track = createTrack({
      id: videoId,
      title: details.title.trim() || `YouTube video ${videoId}`,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      artworkUrl: selectArtwork(details.thumbnails),
      durationMs: Number.isFinite(details.lengthSeconds)
        ? Math.max(0, Math.round(details.lengthSeconds * 1000))
        : 0,
      requestedBy: request.requestedBy,
    });

    return {
      track,
      source: {
        open: (streamSignal) =>
          this.#client.download(info, {
            format,
            signal: streamSignal,
            highWaterMark: READ_AHEAD_BYTES,
          }),
      },
    };
  }
}

/**
 * Prefers audio-only over muxed formats, then Opus (no transcoding loss when
 * re-encoding to Opus), then the highest audio bitrate.
 *
 * @throws NoAudioFormatError
 */
export function selectAudioFormat(formats: readonly VideoFormat[]): VideoFormat {
  const score = (format: VideoFormat): number[] => [
    format.hasVideo ? 0 : 1,
    format.audioCodec?.startsWith('opus') ? 1 : 0,
    format.audioBitrate ?? 0,
  ];
  const [best] = formats
    .filter((format) => format.hasAudio && !format.isDrm)
    .map((format) => ({ format, score: score(format) }))
    .sort((a, b) => compareScores(b.score, a.score));
  if (best === undefined) throw new NoAudioFormatError();
  return best.format;
}

function compareScores(a: readonly number[], b: readonly number[]): number {
  for (const [index, value] of a.entries()) {
    const difference = value - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function selectArtwork(thumbnails: readonly Thumbnail[]): string | undefined {
  return thumbnails
    .filter((thumbnail) => URL.canParse(thumbnail.url))
    .reduce<Thumbnail | undefined>(
      (widest, thumbnail) =>
        widest === undefined || (thumbnail.width ?? 0) > (widest.width ?? 0) ? thumbnail : widest,
      undefined,
    )?.url;
}

function toResolutionError(error: unknown): Error {
  if (!YtdlError.is(error)) return new TrackResolutionError('request failed', { cause: error });
  if (UNAVAILABLE_CODES.has(error.code))
    return new TrackUnavailableError(error.code, { cause: error });
  if (error.code === YtdlErrorCode.NO_FORMAT) return new NoAudioFormatError({ cause: error });
  if (error.code === YtdlErrorCode.INVALID_URL) return new InvalidTrackUrlError({ cause: error });
  return new TrackResolutionError(error.code, { cause: error });
}
