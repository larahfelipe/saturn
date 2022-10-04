import type { CommandInteraction, SlashCommandBuilder } from 'discord.js';

export type GeneralAppError = {
  name?: string;
  message: string;
  bot: Bot;
  interaction?: CommandInteraction;
};

export type CommandData = {
  isActive: boolean;
  build: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
};

export type BroadcastData = {
  track: TrackData;
  requesterId: string;
};

export type Queue = BroadcastData[];

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

export type RGBVector = [number, number, number];
