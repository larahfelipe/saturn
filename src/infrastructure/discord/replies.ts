import { ButtonStyle, ComponentType, escapeMarkdown } from 'discord.js';
import type { APIActionRowComponent, APIButtonComponent, APIEmbed } from 'discord.js';

import type { NowPlaying } from '../../application/music/GuildPlayer.ts';
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
export const EMPTY_QUEUE_MESSAGE = 'The queue is empty';
export const QUEUE_CLEARED_MESSAGE = 'Queue cleared 🧹';
export const QUEUE_SHUFFLED_MESSAGE = 'Queue shuffled 🔀';
export const QUEUE_PAGE_SIZE = 10;
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

const PROGRESS_SEGMENTS = 20;

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

export function formatPosition(elapsedMs: number, durationMs: number): string {
  if (durationMs <= 0) return formatDuration(elapsedMs);
  return `${formatDuration(Math.min(elapsedMs, durationMs))} / ${formatDuration(durationMs)}`;
}

export function formatProgress(elapsedMs: number, durationMs: number): string {
  if (durationMs <= 0) return formatPosition(elapsedMs, durationMs);
  const played = Math.min(
    Math.floor((elapsedMs / durationMs) * PROGRESS_SEGMENTS),
    PROGRESS_SEGMENTS - 1,
  );
  const bar = `${'━'.repeat(played)}●${'─'.repeat(PROGRESS_SEGMENTS - 1 - played)}`;
  return `${bar} ${formatPosition(elapsedMs, durationMs)}`;
}

export function nowPlayingEmbed(track: Track): APIEmbed {
  return {
    ...trackDetails(track),
    author: { icon_url: NOW_PLAYING_ICON, name: 'Now playing' },
    color: COLORS.playing,
    description: `Requested by <@${track.requestedBy}> Enjoy!`,
  };
}

export function nowPlayingProgressEmbed({ elapsedMs, paused, track }: NowPlaying): APIEmbed {
  return {
    ...trackDetails(track),
    author: { icon_url: NOW_PLAYING_ICON, name: paused ? 'Paused' : 'Now playing' },
    color: COLORS.playing,
    description: `Requested by <@${track.requestedBy}>`,
    footer: { text: formatProgress(elapsedMs, track.durationMs) },
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

export function queueEmbed(
  bot: BotProfile,
  current: NowPlaying,
  upcoming: readonly Track[],
  page: number,
  now = new Date(),
): APIEmbed {
  const pages = Math.max(1, Math.ceil(upcoming.length / QUEUE_PAGE_SIZE));
  const shown = Math.min(Math.max(1, page), pages);
  const start = (shown - 1) * QUEUE_PAGE_SIZE;
  const entries = upcoming
    .slice(start, start + QUEUE_PAGE_SIZE)
    .map(
      (track, index) =>
        `\`${start + index + 1}.\` ${queueEntry(track, formatDuration(track.durationMs))}`,
    );
  const { elapsedMs, paused, track } = current;
  const description = [
    `**${paused ? 'Paused' : 'Now playing'}**`,
    queueEntry(track, formatPosition(elapsedMs, track.durationMs)),
    '',
    '**Up next**',
    ...(entries.length > 0 ? entries : ['Nothing queued']),
  ].join('\n');
  const totalMs = upcoming.reduce((sum, { durationMs }) => sum + durationMs, 0);
  const songs = upcoming.length === 1 ? '1 song' : `${upcoming.length} songs`;
  return {
    ...standardEmbed(bot, description, now),
    footer: { text: `Page ${shown}/${pages} · ${songs} · ${formatDuration(totalMs)} total` },
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

export function trackLink(track: Track): string {
  return `[${escapeMarkdown(track.title).replaceAll(/[[\]]/g, String.raw`\$&`)}](${track.url})`;
}

function avatar(bot: BotProfile): { icon_url?: string } {
  return bot.avatarUrl === undefined ? {} : { icon_url: bot.avatarUrl };
}

function isControl(value: string): value is PlaybackControl {
  return CONTROLS.has(value);
}

function queueEntry(track: Track, time: string): string {
  return `${trackLink(track)} · \`${time}\` · <@${track.requestedBy}>`;
}

function trackDetails(track: Track): APIEmbed {
  return {
    title: track.title,
    url: track.url,
    ...(track.artworkUrl !== undefined && { thumbnail: { url: track.artworkUrl } }),
    footer: { text: `Duration: ${formatDuration(track.durationMs)}` },
  };
}
