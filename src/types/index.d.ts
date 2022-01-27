import type { StreamDispatcher, VoiceConnection } from 'discord.js';

export type CommandDetails = {
  name: string;
  trigger: string;
  help: string;
  usage: string;
};

export type AudioPlayer = {
  state: VoiceConnection;
  tracks: Track[];
  authors: string[];
  volume: number;
  dispatcher: StreamDispatcher | null;
};

export type SpotifyRequestType = 'TRACK' | 'PLAYLIST';

type Artist = {
  name: string;
};

type Track = {
  track: {
    name: string;
    duration_ms: number;
    artists: Artist[];
  };
};

type Image = {
  url: string;
  height: number;
  width: number;
};

type Item = {
  [key: string]: {
    name: string;
    images: Image[];
    owner: {
      id: string;
      display_name: string;
    };
    tracks: {
      items: Track[];
    };
  };
};

export type SpotifyPlaylistRawResponse = {
  entities: {
    items: Item;
  };
};

export type SpotifyPlaylist = {
  name: string;
  owner: string;
  cover: string;
  tracks: string[];
  duration: number;
};

export type Track = {
  artistName: string;
  albumTitle: string;
  albumUrl: string;
  streamUrl: string;
  videoUrl: string;
  videoId: string;
  title: string;
  durationTimestamp: string;
  albumCoverUrl: string;
  altThumbnailUrl: string;
};
