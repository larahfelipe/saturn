import { SaturnError } from '../shared/errors.ts';

export const APP_ENVIRONMENTS = ['development', 'production'] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export interface Config {
  readonly activityStatus: string | undefined;
  readonly botToken: string;
  readonly environment: AppEnvironment;
  readonly ffmpegPath: string;
  readonly youtubeCookieFile: string | undefined;
}

export class ConfigurationError extends SaturnError {}

export function loadConfig(env: Readonly<Record<string, string | undefined>>): Config {
  const problems: string[] = [];

  const botToken = value(env.BOT_TOKEN);
  if (botToken === undefined) problems.push('BOT_TOKEN is required');

  const environment = value(env.APP_ENVIRONMENT) ?? 'production';
  if (!isAppEnvironment(environment)) {
    problems.push(`APP_ENVIRONMENT must be one of: ${APP_ENVIRONMENTS.join(', ')}`);
  }

  if (botToken === undefined || !isAppEnvironment(environment)) {
    throw new ConfigurationError(`Invalid configuration: ${problems.join('; ')}`);
  }

  const config = {
    activityStatus: value(env.BOT_ACTIVITY_STATUS),
    environment,
    ffmpegPath: value(env.FFMPEG_PATH) ?? 'ffmpeg',
    youtubeCookieFile: value(env.YOUTUBE_COOKIE_FILE),
  };
  Object.defineProperty(config, 'botToken', { enumerable: false, value: botToken });
  return Object.freeze(config as Config);
}

function isAppEnvironment(value: string): value is AppEnvironment {
  return (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

function value(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}
