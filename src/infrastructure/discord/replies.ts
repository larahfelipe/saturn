import {
  ButtonStyle,
  ComponentType,
  type APIActionRowComponent,
  type APIButtonComponent,
  type APIEmbed,
} from 'discord.js';

import type { Track } from '../../domain/music/Track.ts';

/** A Discord response, independent of how the interaction is acknowledged. */
export interface Reply {
  readonly content?: string;
  readonly embeds?: readonly APIEmbed[];
  readonly components?: readonly APIActionRowComponent<APIButtonComponent>[];
  readonly ephemeral?: boolean;
}

export interface BotProfile {
  readonly username: string;
  readonly avatarUrl: string | undefined;
}

export type PlaybackControl = 'pause' | 'unpause' | 'skip' | 'stop';

export const IDLE_MESSAGE = 'There is no song playing right now';
export const CONTROL_FAILED_MESSAGE = 'Command could not be completed (player might be idle)';
export const CONTROL_MESSAGES: Readonly<Record<PlaybackControl, string>> = {
  pause: 'Playback paused ⏸️',
  unpause: 'Playback resumed ▶️',
  skip: 'Song skipped ⏭️',
  stop: 'Playback stopped 🛑',
};

const COLORS = {
  standard: 0x6e76e5,
  error: 0xfb3640,
  queued: 0xffb319,
  playing: 0x1ed760,
} as const;

/** Pinned to the legacy commit that has the image, so the link survives branch changes. */
const NOW_PLAYING_ICON =
  'https://github.com/larahfelipe/saturn/blob/04d648edc74dcac7089d665e297b68c767b6ada3/src/assets/cd.gif?raw=true';

const CONTROL_BUTTONS: readonly {
  readonly control: PlaybackControl;
  readonly label: string;
  readonly emoji: string;
  readonly style:
    ButtonStyle.Primary | ButtonStyle.Secondary | ButtonStyle.Success | ButtonStyle.Danger;
}[] = [
  { control: 'pause', label: 'Pause', emoji: '⏸️', style: ButtonStyle.Secondary },
  { control: 'unpause', label: 'Resume', emoji: '▶️', style: ButtonStyle.Success },
  { control: 'skip', label: 'Skip', emoji: '⏭️', style: ButtonStyle.Primary },
  { control: 'stop', label: 'Stop', emoji: '🛑', style: ButtonStyle.Danger },
];

const CONTROLS: ReadonlySet<string> = new Set(CONTROL_BUTTONS.map(({ control }) => control));

export function standardEmbed(bot: BotProfile, description: string, now = new Date()): APIEmbed {
  return {
    author: { name: bot.username, ...avatar(bot) },
    description,
    footer: { text: 'From space' },
    timestamp: now.toISOString(),
    color: COLORS.standard,
  };
}

export function errorEmbed(bot: BotProfile, description: string, now = new Date()): APIEmbed {
  return {
    author: { name: '❌ Oops, a wild error appeared! 😱', ...avatar(bot) },
    description,
    footer: { text: 'Please try again later' },
    timestamp: now.toISOString(),
    color: COLORS.error,
  };
}

function avatar(bot: BotProfile): { icon_url?: string } {
  return bot.avatarUrl === undefined ? {} : { icon_url: bot.avatarUrl };
}

export function nowPlayingEmbed(track: Track): APIEmbed {
  return {
    ...trackDetails(track),
    author: { name: 'Now playing', icon_url: NOW_PLAYING_ICON },
    description: `Requested by <@${track.requestedBy}> Enjoy!`,
    color: COLORS.playing,
  };
}

export function queuedEmbed(track: Track, position: number, now = new Date()): APIEmbed {
  return {
    ...trackDetails(track),
    author: { name: 'Queued' },
    description: `Added to the queue by <@${track.requestedBy}> at position ${position}`,
    timestamp: now.toISOString(),
    color: COLORS.queued,
  };
}

function trackDetails(track: Track): APIEmbed {
  return {
    title: track.title,
    url: track.url,
    ...(track.artworkUrl === undefined ? {} : { thumbnail: { url: track.artworkUrl } }),
    footer: { text: `Duration: ${formatDuration(track.durationMs)}` },
  };
}

/** `m:ss`, or `h:mm:ss` from one hour. */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

export function playbackControls(guildId: string): APIActionRowComponent<APIButtonComponent> {
  return {
    type: ComponentType.ActionRow,
    components: CONTROL_BUTTONS.map(({ control, label, emoji, style }) => ({
      type: ComponentType.Button,
      custom_id: `${control}_${guildId}`,
      label,
      emoji: { name: emoji },
      style,
    })),
  };
}

/** Parses a `<control>_<guildId>` button ID; `undefined` when malformed or unsupported. */
export function parseControlId(
  customId: string,
): { readonly control: PlaybackControl; readonly guildId: string } | undefined {
  const separator = customId.indexOf('_');
  if (separator === -1) return undefined;
  const control = customId.slice(0, separator);
  const guildId = customId.slice(separator + 1);
  if (!isControl(control) || !/^\d{17,20}$/.test(guildId)) return undefined;
  return { control, guildId };
}

function isControl(value: string): value is PlaybackControl {
  return CONTROLS.has(value);
}
