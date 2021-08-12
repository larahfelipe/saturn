import {
  ReactionCollector,
  VoiceConnection,
  StreamDispatcher,
} from 'discord.js';
import { Document } from 'mongoose';
import { VideoMetadataResult, VideoSearchResult } from 'yt-search';

export interface ICommandDescription {
  name: string;
  help: string;
  permissionLvl: number;
}

export interface IMemberEssentials {
  userID: string;
  username: string;
  roleLvl: number;
}

export interface IMember extends IMemberEssentials, Document {
  _id: string;
  time: string;
}

export interface IReaction extends ReactionCollector {
  emoji: {
    name: string;
  };
}

export interface IUser {
  id: string;
}

export type Song = VideoMetadataResult | VideoSearchResult;

export type SearchError = Error | string | null | undefined;

export interface IQueue {
  connection: VoiceConnection;
  songs: [
    {
      title: string;
      timestamp: string;
      seconds: number;
    },
  ];
  authors: string[];
  volume: number;
  dispatcher: StreamDispatcher | null;
}

export interface ISpotifyPlaylist {
  name: string;
  owner: {
    display_name: string;
  };
  images: [
    {
      url: string;
    },
  ];
  tracks: {
    items: [
      {
        track: {
          name: string;
          duration_ms: number;
          album: {
            artists: [
              {
                name: string;
              },
            ];
          };
        };
      },
    ];
  };
}

export interface ILocation {
  name: string;
  sys: {
    country: string;
  };
  weather: [
    {
      icon: string;
      description: string;
    },
  ];
  main: {
    [prop: string]: number;
  };
  wind: {
    speed: number;
  };
}
