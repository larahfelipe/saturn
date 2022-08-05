import type { Message, StreamDispatcher, VoiceConnection } from 'discord.js';

export type GeneralAppError = {
  name?: string;
  message: string;
  bot: Bot;
  interaction?: Message;
};

export type CommandDetails = {
  name: string;
  trigger: [string, string?];
  help: string;
  isActive: boolean;
};

export type Track = {
  title: string;
  url: string;
  duration: string;
  thumbnail: string;
};

export type TrackData = {
  data: Track;
  readableStream: Readable<NodeJS.ReadableStream>;
};

export type GetTrackResult = {
  tracks: TrackData[];
  platform: keyof typeof PLATFORMS;
};

export type AudioPlayer = {
  state: VoiceConnection;
  tracks: {
    data: TrackData[];
    author: string[];
  };
  volume: number;
  dispatcher: StreamDispatcher | null;
};

export type SpotifyRequestType = 'TRACK' | 'PLAYLIST';

type SpotifyItemTrack = {
  track: {
    name: string;
    duration_ms: number;
    artists: { name: string }[];
  };
};

type SpotifyItemImage = {
  url: string;
  height: number;
  width: number;
};

type SpotifyItemOwner = {
  id: string;
  display_name: string;
};

type SpotifyItem = {
  [key: string]: {
    name: string;
    images: SpotifyItemImage[];
    owner: SpotifyItemOwner;
    tracks: {
      items: SpotifyItemTrack[];
    };
  };
};

export type SpotifyPlaylistRawResponse = {
  entities: {
    items: SpotifyItem;
  };
};

export type SpotifyPlaylist = {
  name: string;
  owner: string;
  cover: string;
  tracks: string[];
  duration: number;
};
