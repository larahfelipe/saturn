import {
  ReactionCollector,
  VoiceConnection,
  StreamDispatcher
} from 'discord.js';
import { Document } from 'mongoose';
import { VideoMetadataResult, VideoSearchResult } from 'yt-search';

export type UpdateGuildMemberActions = 'PROMOTE' | 'DEMOTE';

export type CommandDescription = {
  name: string;
  help: string;
  requiredRoleLvl: number;
};

export type MemberEssentials = {
  userId: string;
  username: string;
  userRoleLvl: number;
  wasAddedBy: string;
  wasUpdatedBy: string;
};

export interface IMember extends MemberEssentials, Document {
  _id: string;
  wasAddedAtTime: string;
}

export interface IReaction extends ReactionCollector {
  emoji: {
    name: string;
  };
}

export type User = {
  id: string;
};

type RGBVector = [number, number, number];

type Palette = {
  Vibrant: string | RGBVector | null;
  Muted: string | RGBVector | null;
  DarkVibrant: string | RGBVector | null;
  DarkMuted: string | RGBVector | null;
  LightVibrant: string | RGBVector | null;
  LightMuted: string | RGBVector | null;
};

export type Song = {
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
  coverColors?: Palette;
};

export type Queue = {
  connection: VoiceConnection;
  songs: Song[];
  authors: string[];
  volume: number;
  dispatcher: StreamDispatcher | null;
};

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

export type SpotifyRequestType = 'TRACK' | 'PLAYLIST';

export type SpotifyPlaylist = {
  name: string;
  owner: string;
  cover: string;
  tracks: string[];
  duration: number;
};

export type Location = {
  name: string;
  sys: {
    country: string;
  };
  weather: [
    {
      icon: string;
      description: string;
    }
  ];
  main: {
    [prop: string]: number;
  };
  wind: {
    speed: number;
  };
};
