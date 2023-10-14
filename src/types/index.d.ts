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

export type Queue = Array<BroadcastData>;

export type Track = Record<'title', 'url' | 'duration' | 'thumbnail', string>;

export type TrackData = {
  data: Track;
  readableStream: Readable<NodeJS.ReadableStream>;
};

export type GetTrackResult = {
  tracks: Array<TrackData>;
  platform: keyof typeof PLATFORMS;
};

export type SpotifyRequestType = 'TRACK' | 'PLAYLIST';

type SpotifyItemTrack = {
  track: {
    name: string;
    duration_ms: number;
    artists: Array<{ name: string }>;
  };
};

type SpotifyItemImage = {
  url: string;
  height: number;
  width: number;
};

type SpotifyItemOwner = Record<'id' | 'display_name', string>;

type SpotifyItem = {
  [key: string]: {
    name: string;
    images: Array<SpotifyItemImage>;
    owner: SpotifyItemOwner;
    tracks: Record<'items', Array<SpotifyItemTrack>>;
  };
};

export type SpotifyPlaylistRawResponse = {
  entities: Record<'items', SpotifyItem>;
};

export type SpotifyPlaylist = {
  name: string;
  owner: string;
  cover: string;
  tracks: Array<string>;
  duration: number;
};

export type RGBVector = [number, number, number];
