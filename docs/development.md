# Development

## Prerequisites

- Node.js 26 (`engines` is enforced through `.npmrc`; CI and the image use
  26.13.1) and npm.
- FFmpeg with the `libopus` encoder, to run the bot and the `test:ffmpeg`
  suite. Check with `ffmpeg -hide_banner -encoders | grep libopus`.
  Debian/Ubuntu: `sudo apt install ffmpeg`; macOS: `brew install ffmpeg`.
- A Discord application and bot token for a test server. Never develop
  against the production bot token.
- Docker, optionally, to build and run the production image.

## Setup

```bash
npm ci
cp .env.example .env   # then set BOT_TOKEN
npm run dev
```

`npm run dev` and `npm start` load `.env` when it exists, through Node's
`--env-file-if-exists`. Variables already set in the environment take
precedence. The variables are described in
[operations](operations.md#environment-variables).
`APP_ENVIRONMENT=development` enables debug logs.

## Commands

| Command                    | Purpose                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`              | Run `src/main.ts` directly (type stripping), restart on change, pretty-print logs |
| `npm run build`            | Clean `dist/` and compile with `tsconfig.build.json`                              |
| `npm start`                | Run the compiled `dist/main.js`                                                   |
| `npm run typecheck`        | Type-check sources, tests and config files                                        |
| `npm run lint`             | ESLint with type-aware rules; warnings fail                                       |
| `npm run lint:fix`         | Apply ESLint fixes, including import, key and member order                        |
| `npm run format`           | Format with Prettier                                                              |
| `npm run format:check`     | Verify formatting                                                                 |
| `npm test`                 | Unit and integration tests                                                        |
| `npm run test:unit`        | Unit tests only                                                                   |
| `npm run test:integration` | Integration tests only                                                            |
| `npm run test:ffmpeg`      | Tests against a real FFmpeg build (`FFMPEG_PATH`, or `ffmpeg` on the `PATH`)      |

Run a single file or test with Vitest directly, for example
`npx vitest run test/unit/domain/music/TrackQueue.test.ts -t "positions"`.

## Tests

```text
test/
├── unit/          Domain, application and adapter logic, all I/O faked
├── integration/   Adapters with real streams, child processes and sockets
├── ffmpeg/        Real FFmpeg: encoding, demuxing, failures, cancellation
└── fixtures/      Fakes for the ports, interactions, YouTube data, fake FFmpeg scripts
```

- In every suite, a test file mirrors the path of the module it covers:
  `src/infrastructure/audio/ffmpeg.ts` is tested in
  `test/unit/infrastructure/audio/ffmpeg.test.ts`,
  `test/integration/infrastructure/audio/ffmpeg.test.ts` and
  `test/ffmpeg/infrastructure/audio/ffmpeg.test.ts`.
- Fakes implement the ports (`FakeResolver`, `FakeVoiceConnector`,
  `FakeAudioSession`, `RecordingLogger`). Set `manual = true` to settle calls
  yourself and reproduce interleavings. `flush()` lets pending continuations
  run.
- `test/fixtures/ffmpeg/*.ts` are executable stand-ins for FFmpeg, passed as
  `ffmpegPath`, so process handling is tested without FFmpeg installed.
- Tests must not reach external services: no Internet access and no real
  Discord application. Local sockets and child processes are fine.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `master`, on pull requests, and on
demand:

- **Checks:** `npm ci`, type check, lint, format check, unit, integration and
  FFmpeg tests, then the build.
- **Docker image:** build the image, then verify it runs as non-root, has
  `libopus`, contains no `.env` file and no development-only packages, exits
  with 1 without configuration, and fails startup without leaking the token
  when Discord is unreachable.

Make both jobs required status checks on `master` in the repository settings
so a failing pipeline blocks merging.

When bumping Node.js, change `NODE_VERSION` in the workflow and `NODE_IMAGE`
in the `Dockerfile` together.

## Conventions

- **Layering:** domain imports nothing but `shared`; application talks to the
  outside only through `application/ports`; adapters live in `infrastructure`.
  New external systems get a port first. ESLint enforces the boundaries. See
  [architecture](architecture.md).
- **TypeScript:** relative imports with the `.ts` extension; `import type`
  statements for types, not inline `type` specifiers; no enums, namespaces or
  parameter properties (`erasableSyntaxOnly`); `#private` members, not the
  `private` keyword; `readonly` by default; discriminated unions for state; no
  `any`, and no non-null assertions where a check fits.
- **Naming:** a file built around a class or type is named after it in
  PascalCase (`GuildPlayer.ts`); a module of functions or values is camelCase
  (`ffmpeg.ts`, `createYouTubeClient.ts`). Module-level constants, other than
  functions, are UPPER_SNAKE_CASE, types PascalCase, everything else
  camelCase. Options objects are `XOptions`. Named exports only: no default
  exports and no barrel files.
- **Ordering:** imports, object keys, interface and union members, class
  members and module-level declarations are sorted by
  `eslint-plugin-perfectionist`. Let `npm run lint:fix` order them rather than
  doing it by hand.
- **Lint exceptions:** an `eslint-disable` comment names the rule and gives a
  reason after `--`. Unused ones fail the lint.
- **Errors:** throw a `SaturnError` subclass that says what failed. Errors
  users can act on extend `UserInputError`; failures of YouTube, Discord voice
  or FFmpeg extend `ExternalServiceError`. Map new ones in `userErrorMessage`.
  Keep the original error as `cause`.
- **Async work:** accept an `AbortSignal` for anything cancellable, and release
  resources on every path: success, failure and abort.
- **Logging:** context object first, message second, errors under `err`:
  `logger.warn({ err, guildId }, 'voice connection lost')`. Never log tokens
  or configuration values.
- **Comments:** only to explain an algorithm the code cannot make obvious,
  such as the playback state machine or the per-guild ordering of commands.
  Names, types and tests document everything else.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/),
  small and focused, with checks passing.
