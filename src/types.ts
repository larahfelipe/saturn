import { Document } from 'mongoose';

import { ReactionCollector, VoiceConnection, StreamDispatcher } from 'discord.js';

import { VideoMetadataResult, VideoSearchResult } from 'yt-search';

export interface IMember extends Document {
  _id: string;
  username: string;
  roleLvl: number;
  time: string;
}

export interface IMemberSimplified {
  username: string;
  roleLvl: number;
}

export interface IReaction extends ReactionCollector {
  emoji: {
    name: string;
  }
}

export interface IUser {
  id: string;
}

export type Song = VideoMetadataResult | VideoSearchResult;

export type SearchError = Error | string | null | undefined;

export interface IQueue {
  connection: VoiceConnection;
  songs: [{
    title: string;
    timestamp: string;
    seconds: number;
  }];
  authors: string[];
  volume: number;
  dispatcher: StreamDispatcher | null;
}

export interface ISpotifyPlaylist {
  name: string;
  owner: {
    display_name: string;
  }
  images: [{
    url: string;
  }]
  tracks: {
    items: [{
      track: {
        name: string;
        duration_ms: number;
        album: {
          artists: [{
            name: string;
          }]
        }
      }
    }]
  }
}

export interface ILocationData {
  name: string;
  sys: {
    country: string;
  }
  weather: [{
    icon: string;
    description: string;
  }]
  main: {
    [prop: string]: number;
  }
  wind: {
    speed: number;
  }
}
