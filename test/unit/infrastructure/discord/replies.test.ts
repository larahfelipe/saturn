import { ButtonStyle, ComponentType } from 'discord.js';
import { describe, expect, it } from 'vitest';

import {
  errorEmbed,
  formatDuration,
  nowPlayingEmbed,
  parseControlId,
  playbackControls,
  queuedEmbed,
  standardEmbed,
} from '../../../../src/infrastructure/discord/replies.ts';
import { makeTrack } from '../../../fixtures/tracks.ts';

const NOW = new Date('2026-11-14T12:00:00.000Z');
const GUILD_ID = '123456789012345678';
const BOT = { avatarUrl: 'https://cdn.discordapp.com/avatars/1/a.png', username: 'Saturn' };

describe('embeds', () => {
  it('builds the standard embed', () => {
    expect(standardEmbed(BOT, 'Hello', NOW)).toEqual({
      author: { icon_url: BOT.avatarUrl, name: 'Saturn' },
      color: 0x6e_76_e5,
      description: 'Hello',
      footer: { text: 'From space' },
      timestamp: '2026-11-14T12:00:00.000Z',
    });
  });

  it('builds the error embed', () => {
    expect(errorEmbed({ avatarUrl: undefined, username: 'Saturn' }, 'Nope', NOW)).toEqual({
      author: { name: '❌ Oops, a wild error appeared! 😱' },
      color: 0xfb_36_40,
      description: 'Nope',
      footer: { text: 'Please try again later' },
      timestamp: '2026-11-14T12:00:00.000Z',
    });
  });

  it('builds the now playing embed', () => {
    const track = makeTrack({ durationMs: 213_000, requestedBy: '42' });

    expect(nowPlayingEmbed(track)).toEqual({
      author: {
        icon_url:
          'https://github.com/larahfelipe/saturn/blob/04d648edc74dcac7089d665e297b68c767b6ada3/src/assets/cd.gif?raw=true',
        name: 'Now playing',
      },
      color: 0x1e_d7_60,
      description: 'Requested by <@42> Enjoy!',
      footer: { text: 'Duration: 3:33' },
      thumbnail: { url: track.artworkUrl },
      title: track.title,
      url: track.url,
    });
  });

  it('builds the queued embed without artwork when the track has none', () => {
    const track = makeTrack({ artworkUrl: undefined, durationMs: 61_000, requestedBy: '42' });

    expect(queuedEmbed(track, 3, NOW)).toEqual({
      author: { name: 'Queued' },
      color: 0xff_b3_19,
      description: 'Added to the queue by <@42> at position 3',
      footer: { text: 'Duration: 1:01' },
      timestamp: '2026-11-14T12:00:00.000Z',
      title: track.title,
      url: track.url,
    });
  });
});

describe(formatDuration, () => {
  it.each([
    [0, '0:00'],
    [999, '0:00'],
    [59_000, '0:59'],
    [600_000, '10:00'],
    [3_600_000, '1:00:00'],
    [3_723_000, '1:02:03'],
  ])('formats %i ms as %s', (durationMs, expected) => {
    expect(formatDuration(durationMs)).toBe(expected);
  });
});

describe('playback controls', () => {
  it('renders the four controls for the guild', () => {
    expect(playbackControls(GUILD_ID)).toEqual({
      components: [
        ['pause', 'Pause', '⏸️', ButtonStyle.Secondary],
        ['unpause', 'Resume', '▶️', ButtonStyle.Success],
        ['skip', 'Skip', '⏭️', ButtonStyle.Primary],
        ['stop', 'Stop', '🛑', ButtonStyle.Danger],
      ].map(([control, label, emoji, style]) => ({
        custom_id: `${String(control)}_${GUILD_ID}`,
        emoji: { name: emoji },
        label,
        style,
        type: ComponentType.Button,
      })),
      type: ComponentType.ActionRow,
    });
  });

  it('parses the IDs it renders', () => {
    const ids = playbackControls(GUILD_ID).components.map((button) =>
      'custom_id' in button ? button.custom_id : '',
    );

    expect(ids.map((id) => parseControlId(id))).toEqual([
      { control: 'pause', guildId: GUILD_ID },
      { control: 'unpause', guildId: GUILD_ID },
      { control: 'skip', guildId: GUILD_ID },
      { control: 'stop', guildId: GUILD_ID },
    ]);
  });

  it.each([
    'pause',
    `resume_${GUILD_ID}`,
    `pause_`,
    `pause_${GUILD_ID}_extra`,
    'pause_not-a-guild',
    `_${GUILD_ID}`,
  ])('rejects the control ID %j', (customId) => {
    expect(parseControlId(customId)).toBeUndefined();
  });
});
