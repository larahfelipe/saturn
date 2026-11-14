import { PassThrough, type Readable } from 'node:stream';

import {
  Client,
  type DownloadOptions,
  type LookupOptions,
  type Thumbnail,
  type VideoFormat,
  type VideoInfo,
} from '@distube/ytdl-core';

import type { YouTubeClient } from '../../src/infrastructure/youtube/YouTubeTrackResolver.ts';

export function makeFormat(overrides: Partial<VideoFormat> = {}): VideoFormat {
  return {
    itag: 251,
    mimeType: 'audio/webm; codecs="opus"',
    container: 'webm',
    codecs: 'opus',
    videoCodec: undefined,
    audioCodec: 'opus',
    audioBitrate: 160,
    isDrc: false,
    hasAudio: true,
    hasVideo: false,
    isLive: false,
    isHLS: false,
    isDrm: false,
    isOtf: false,
    client: Client.VisionOS,
    url: 'https://rr1---sn.googlevideo.com/videoplayback?itag=251',
    ...overrides,
  };
}

export interface VideoInfoOptions {
  readonly id?: string;
  readonly title?: string;
  readonly lengthSeconds?: number;
  readonly thumbnails?: readonly Thumbnail[];
  readonly formats?: readonly VideoFormat[];
}

export function makeVideoInfo(options: VideoInfoOptions = {}): VideoInfo {
  const id = options.id ?? 'dQw4w9WgXcQ';
  return {
    videoDetails: {
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title: options.title ?? 'Never Gonna Give You Up',
      description: undefined,
      lengthSeconds: options.lengthSeconds ?? 213,
      viewCount: undefined,
      likes: undefined,
      publishDate: undefined,
      uploadDate: undefined,
      keywords: [],
      category: undefined,
      thumbnails: options.thumbnails ?? [
        { url: `https://i.ytimg.com/vi/${id}/default.jpg`, width: 120, height: 90 },
        { url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, width: 1280, height: 720 },
      ],
      author: {
        id: 'UCuAXFkgsw1L7xaCfnd5JJOw',
        name: 'Rick Astley',
        url: 'https://www.youtube.com/@RickAstleyYT',
        thumbnails: [],
        verified: undefined,
        subscriberCount: undefined,
      },
      isLive: false,
      isUpcoming: false,
      isUnlisted: undefined,
      isFamilySafe: undefined,
      isAgeRestricted: false,
      availableCountries: undefined,
      chapters: [],
      storyboards: [],
    },
    relatedVideos: [],
    playerResponse: {},
    formats: options.formats ?? [makeFormat()],
    captionTracks: [],
    client: Client.VisionOS,
    hlsManifestUrl: undefined,
    sabr: undefined,
    visitorData: undefined,
    expiresAt: 0,
    playableAt: 0,
  };
}

/** In-memory `YouTubeClient` recording calls; streams are PassThroughs the test controls. */
export class FakeYouTubeClient implements YouTubeClient {
  readonly infoCalls: { video: string; options: LookupOptions | undefined }[] = [];
  readonly downloads: {
    info: VideoInfo;
    options: DownloadOptions | undefined;
    stream: PassThrough;
  }[] = [];
  getInfoImpl: (video: string, options?: LookupOptions) => Promise<VideoInfo> = () =>
    Promise.resolve(makeVideoInfo());

  getInfo(video: string, options?: LookupOptions): Promise<VideoInfo> {
    this.infoCalls.push({ video, options });
    return this.getInfoImpl(video, options);
  }

  download(info: VideoInfo, options?: DownloadOptions): Readable {
    const stream = new PassThrough();
    options?.signal?.addEventListener('abort', () => stream.destroy(), { once: true });
    this.downloads.push({ info, options, stream });
    return stream;
  }
}
