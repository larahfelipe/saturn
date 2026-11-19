import { PassThrough } from 'node:stream';
import type { Readable } from 'node:stream';

import { Client } from '@distube/ytdl-core';
import type {
  DownloadOptions,
  LookupOptions,
  Thumbnail,
  VideoFormat,
  VideoInfo,
} from '@distube/ytdl-core';

import type { YouTubeClient } from '../../src/infrastructure/youtube/YouTubeTrackResolver.ts';

export interface VideoInfoOptions {
  readonly formats?: readonly VideoFormat[];
  readonly id?: string;
  readonly lengthSeconds?: number;
  readonly thumbnails?: readonly Thumbnail[];
  readonly title?: string;
}

export class FakeYouTubeClient implements YouTubeClient {
  readonly downloads: {
    info: VideoInfo;
    options: DownloadOptions | undefined;
    stream: PassThrough;
  }[] = [];
  readonly infoCalls: { options: LookupOptions | undefined; video: string }[] = [];

  download(info: VideoInfo, options?: DownloadOptions): Readable {
    const stream = new PassThrough();
    options?.signal?.addEventListener('abort', () => stream.destroy(), { once: true });
    this.downloads.push({ info, options, stream });
    return stream;
  }

  getInfo(video: string, options?: LookupOptions): Promise<VideoInfo> {
    this.infoCalls.push({ options, video });
    return this.getInfoImpl(video, options);
  }

  getInfoImpl: (video: string, options?: LookupOptions) => Promise<VideoInfo> = () =>
    Promise.resolve(makeVideoInfo());
}

export function makeFormat(overrides: Partial<VideoFormat> = {}): VideoFormat {
  return {
    audioBitrate: 160,
    audioCodec: 'opus',
    client: Client.VisionOS,
    codecs: 'opus',
    container: 'webm',
    hasAudio: true,
    hasVideo: false,
    isDrc: false,
    isDrm: false,
    isHLS: false,
    isLive: false,
    isOtf: false,
    itag: 251,
    mimeType: 'audio/webm; codecs="opus"',
    url: 'https://rr1---sn.googlevideo.com/videoplayback?itag=251',
    videoCodec: undefined,
    ...overrides,
  };
}

export function makeVideoInfo(options: VideoInfoOptions = {}): VideoInfo {
  const id = options.id ?? 'dQw4w9WgXcQ';
  return {
    captionTracks: [],
    client: Client.VisionOS,
    expiresAt: 0,
    formats: options.formats ?? [makeFormat()],
    hlsManifestUrl: undefined,
    playableAt: 0,
    playerResponse: {},
    relatedVideos: [],
    sabr: undefined,
    videoDetails: {
      author: {
        id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
        name: 'Rick Astley',
        subscriberCount: undefined,
        thumbnails: [],
        url: 'https://www.youtube.com/@RickAstleyYT',
        verified: undefined,
      },
      availableCountries: undefined,
      category: undefined,
      chapters: [],
      description: undefined,
      id,
      isAgeRestricted: false,
      isFamilySafe: undefined,
      isLive: false,
      isUnlisted: undefined,
      isUpcoming: false,
      keywords: [],
      lengthSeconds: options.lengthSeconds ?? 213,
      likes: undefined,
      publishDate: undefined,
      storyboards: [],
      thumbnails: options.thumbnails ?? [
        { height: 90, url: `https://i.ytimg.com/vi/${id}/default.jpg`, width: 120 },
        { height: 720, url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, width: 1280 },
      ],
      title: options.title ?? 'Never Gonna Give You Up',
      uploadDate: undefined,
      url: `https://www.youtube.com/watch?v=${id}`,
      viewCount: undefined,
    },
    visitorData: undefined,
  };
}
