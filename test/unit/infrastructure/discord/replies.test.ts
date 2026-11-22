import { ButtonStyle, ComponentType } from 'discord.js';
import { describe, expect, it } from 'vitest';

import {
  errorEmbed,
  formatDuration,
  formatPosition,
  formatProgress,
  nowPlayingEmbed,
  nowPlayingProgressEmbed,
  parseControlId,
  playbackControls,
  queuedEmbed,
  queueEmbed,
  standardEmbed,
  trackLink,
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

  it('builds the now playing embed with progress', () => {
    const track = makeTrack({ durationMs: 200_000, requestedBy: '42' });

    expect(nowPlayingProgressEmbed({ elapsedMs: 50_000, paused: true, track })).toEqual({
      author: {
        icon_url:
          'https://github.com/larahfelipe/saturn/blob/04d648edc74dcac7089d665e297b68c767b6ada3/src/assets/cd.gif?raw=true',
        name: 'Paused',
      },
      color: 0x1e_d7_60,
      description: 'Requested by <@42>',
      footer: { text: '━━━━━●────────────── 0:50 / 3:20' },
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

describe('queue embed', () => {
  const current = {
    elapsedMs: 61_000,
    paused: false,
    track: makeTrack({ durationMs: 213_000, id: 'current0000', requestedBy: '42' }),
  };

  function tracks(count: number) {
    return Array.from({ length: count }, (_, index) =>
      makeTrack({
        durationMs: 60_000,
        id: `track${String(index + 1).padStart(6, '0')}`,
        requestedBy: '7',
      }),
    );
  }

  it('lists the current song and one page of the queue', () => {
    const embed = queueEmbed(BOT, current, tracks(2), 1, NOW);

    expect(embed).toEqual({
      author: { icon_url: BOT.avatarUrl, name: 'Saturn' },
      color: 0x6e_76_e5,
      description: [
        '**Now playing**',
        '[Track current0000](https://www.youtube.com/watch?v=current0000) · `1:01 / 3:33` · <@42>',
        '',
        '**Up next**',
        '`1.` [Track track000001](https://www.youtube.com/watch?v=track000001) · `1:00` · <@7>',
        '`2.` [Track track000002](https://www.youtube.com/watch?v=track000002) · `1:00` · <@7>',
      ].join('\n'),
      footer: { text: 'Page 1/1 · 2 songs · 2:00 total' },
      timestamp: '2026-11-14T12:00:00.000Z',
    });
  });

  it('numbers later pages from their queue position', () => {
    const lines = queueEmbed(BOT, current, tracks(25), 3, NOW).description?.split('\n') ?? [];

    expect(lines.slice(4)).toEqual([
      expect.stringMatching(/^`21\.` \[Track track000021\]/),
      expect.stringMatching(/^`22\.` /),
      expect.stringMatching(/^`23\.` /),
      expect.stringMatching(/^`24\.` /),
      expect.stringMatching(/^`25\.` /),
    ]);
  });

  it.each([
    [0, 'Page 1/3 · 21 songs · 21:00 total'],
    [4, 'Page 3/3 · 21 songs · 21:00 total'],
  ])('shows the nearest page for page %i', (page, expected) => {
    expect(queueEmbed(BOT, current, tracks(21), page, NOW).footer).toEqual({ text: expected });
  });

  it('shows a paused song and an empty queue', () => {
    const embed = queueEmbed(BOT, { ...current, paused: true }, [], 1, NOW);

    expect(embed.description?.split('\n')).toEqual([
      '**Paused**',
      expect.any(String),
      '',
      '**Up next**',
      'Nothing queued',
    ]);
    expect(embed.footer).toEqual({ text: 'Page 1/1 · 0 songs · 0:00 total' });
  });
});

describe(trackLink, () => {
  it('escapes markdown and brackets in the title', () => {
    const track = makeTrack({ id: 'aaaaaaaaaaa', title: '**Loud** [Live] _mix_ `x`' });

    expect(trackLink(track)).toBe(
      String.raw`[\*\*Loud\*\* \[Live\] \_mix\_ \`x\`](https://www.youtube.com/watch?v=aaaaaaaaaaa)`,
    );
  });
});

describe(formatProgress, () => {
  it.each([
    [0, 200_000, '●─────────────────── 0:00 / 3:20'],
    [100_000, 200_000, '━━━━━━━━━━●───────── 1:40 / 3:20'],
    [199_999, 200_000, '━━━━━━━━━━━━━━━━━━━● 3:19 / 3:20'],
    [250_000, 200_000, '━━━━━━━━━━━━━━━━━━━● 3:20 / 3:20'],
    [95_000, 0, '1:35'],
  ])('shows %i ms of %i ms as %s', (elapsedMs, durationMs, expected) => {
    expect(formatProgress(elapsedMs, durationMs)).toBe(expected);
  });
});

describe(formatPosition, () => {
  it('shows only the elapsed time of a track without a duration', () => {
    expect(formatPosition(95_000, 0)).toBe('1:35');
    expect(formatPosition(95_000, 213_000)).toBe('1:35 / 3:33');
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
