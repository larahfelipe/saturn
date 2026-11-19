import { ButtonStyle, ComponentType } from 'discord.js';
import type { APIActionRowComponent, APIButtonComponent, APIEmbed } from 'discord.js';

import type { Track } from '../../domain/music/Track.ts';

export interface BotProfile {
  readonly avatarUrl: string | undefined;
  readonly username: string;
}

export type PlaybackControl = 'pause' | 'skip' | 'stop' | 'unpause';

export interface Reply {
  readonly components?: readonly APIActionRowComponent<APIButtonComponent>[];
  readonly content?: string;
  readonly embeds?: readonly APIEmbed[];
  readonly ephemeral?: boolean;
}

export const IDLE_MESSAGE = 'There is no song playing right now';
export const CONTROL_FAILED_MESSAGE = 'Command could not be completed (player might be idle)';
export const CONTROL_MESSAGES: Readonly<Record<PlaybackControl, string>> = {
  pause: 'Playback paused ⏸️',
  skip: 'Song skipped ⏭️',
  stop: 'Playback stopped 🛑',
  unpause: 'Playback resumed ▶️',
};

const COLORS = {
  error: 0xfb_36_40,
  playing: 0x1e_d7_60,
  queued: 0xff_b3_19,
  standard: 0x6e_76_e5,
} as const;

const NOW_PLAYING_ICON =
  'https://github.com/larahfelipe/saturn/blob/04d648edc74dcac7089d665e297b68c767b6ada3/src/assets/cd.gif?raw=true';

const CONTROL_BUTTONS: readonly {
  readonly control: PlaybackControl;
  readonly emoji: string;
  readonly label: string;
  readonly style:
    ButtonStyle.Danger | ButtonStyle.Primary | ButtonStyle.Secondary | ButtonStyle.Success;
}[] = [
  { control: 'pause', emoji: '⏸️', label: 'Pause', style: ButtonStyle.Secondary },
  { control: 'unpause', emoji: '▶️', label: 'Resume', style: ButtonStyle.Success },
  { control: 'skip', emoji: '⏭️', label: 'Skip', style: ButtonStyle.Primary },
  { control: 'stop', emoji: '🛑', label: 'Stop', style: ButtonStyle.Danger },
];

const CONTROLS: ReadonlySet<string> = new Set(CONTROL_BUTTONS.map(({ control }) => control));

export function errorEmbed(bot: BotProfile, description: string, now = new Date()): APIEmbed {
  return {
    author: { name: '❌ Oops, a wild error appeared! 😱', ...avatar(bot) },
    color: COLORS.error,
    description,
    footer: { text: 'Please try again later' },
    timestamp: now.toISOString(),
  };
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
    : `${minutes}:${seconds}`;
}

export function nowPlayingEmbed(track: Track): APIEmbed {
  return {
    ...trackDetails(track),
    author: { icon_url: NOW_PLAYING_ICON, name: 'Now playing' },
    color: COLORS.playing,
    description: `Requested by <@${track.requestedBy}> Enjoy!`,
  };
}

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

export function playbackControls(guildId: string): APIActionRowComponent<APIButtonComponent> {
  return {
    components: CONTROL_BUTTONS.map(({ control, emoji, label, style }) => ({
      custom_id: `${control}_${guildId}`,
      emoji: { name: emoji },
      label,
      style,
      type: ComponentType.Button,
    })),
    type: ComponentType.ActionRow,
  };
}

export function queuedEmbed(track: Track, position: number, now = new Date()): APIEmbed {
  return {
    ...trackDetails(track),
    author: { name: 'Queued' },
    color: COLORS.queued,
    description: `Added to the queue by <@${track.requestedBy}> at position ${position}`,
    timestamp: now.toISOString(),
  };
}

export function standardEmbed(bot: BotProfile, description: string, now = new Date()): APIEmbed {
  return {
    author: { name: bot.username, ...avatar(bot) },
    color: COLORS.standard,
    description,
    footer: { text: 'From space' },
    timestamp: now.toISOString(),
  };
}

function avatar(bot: BotProfile): { icon_url?: string } {
  return bot.avatarUrl === undefined ? {} : { icon_url: bot.avatarUrl };
}

function isControl(value: string): value is PlaybackControl {
  return CONTROLS.has(value);
}

function trackDetails(track: Track): APIEmbed {
  return {
    title: track.title,
    url: track.url,
    ...(track.artworkUrl !== undefined && { thumbnail: { url: track.artworkUrl } }),
    footer: { text: `Duration: ${formatDuration(track.durationMs)}` },
  };
}
