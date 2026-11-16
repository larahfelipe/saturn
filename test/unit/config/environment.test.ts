import { inspect } from 'node:util';

import { describe, expect, it } from 'vitest';

import { ConfigurationError, loadConfig } from '../../../src/config/environment.ts';

const TOKEN = 'MTA0.test-token.value';

describe('loadConfig', () => {
  it('applies defaults for optional settings', () => {
    const config = loadConfig({ BOT_TOKEN: TOKEN });

    expect(config.botToken).toBe(TOKEN);
    expect(config).toEqual({
      activityStatus: undefined,
      environment: 'production',
      ffmpegPath: 'ffmpeg',
    });
  });

  it('reads every supported variable', () => {
    const config = loadConfig({
      BOT_TOKEN: ` ${TOKEN}\n`,
      BOT_ACTIVITY_STATUS: ' Hello, earth! ',
      APP_ENVIRONMENT: 'development',
      FFMPEG_PATH: '/usr/bin/ffmpeg',
    });

    expect(config.botToken).toBe(TOKEN);
    expect(config).toEqual({
      activityStatus: 'Hello, earth!',
      environment: 'development',
      ffmpegPath: '/usr/bin/ffmpeg',
    });
  });

  it('treats blank optional values as unset', () => {
    const config = loadConfig({
      BOT_TOKEN: TOKEN,
      BOT_ACTIVITY_STATUS: '  ',
      APP_ENVIRONMENT: '',
      FFMPEG_PATH: ' ',
    });

    expect(config).toEqual({
      activityStatus: undefined,
      environment: 'production',
      ffmpegPath: 'ffmpeg',
    });
  });

  it.each([undefined, '', '   '])('requires BOT_TOKEN (%j)', (token) => {
    expect(() => loadConfig({ BOT_TOKEN: token })).toThrow(
      new ConfigurationError('Invalid configuration: BOT_TOKEN is required'),
    );
  });

  it.each(['staging', 'Production', 'dev'])('rejects APP_ENVIRONMENT=%s', (environment) => {
    expect(() => loadConfig({ BOT_TOKEN: TOKEN, APP_ENVIRONMENT: environment })).toThrow(
      'APP_ENVIRONMENT must be one of: development, production',
    );
  });

  it('reports every problem at once without echoing values', () => {
    let error: unknown;
    try {
      loadConfig({ APP_ENVIRONMENT: 'secret-looking-value' });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ConfigurationError);
    expect((error as Error).message).toBe(
      'Invalid configuration: BOT_TOKEN is required; APP_ENVIRONMENT must be one of: development, production',
    );
  });

  it('never reveals the token when serialized or inspected', () => {
    const config = loadConfig({ BOT_TOKEN: TOKEN });

    expect(JSON.stringify(config)).not.toContain(TOKEN);
    expect(inspect(config)).not.toContain(TOKEN);
    expect({ ...config }).not.toHaveProperty('botToken');
  });

  it('returns an immutable config', () => {
    const config = loadConfig({ BOT_TOKEN: TOKEN });

    expect(Object.isFrozen(config)).toBe(true);
  });
});
