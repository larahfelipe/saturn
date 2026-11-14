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
| `npm run format`           | Format with Prettier                                                              |
| `npm run format:check`     | Verify formatting                                                                 |
| `npm test`                 | Unit and integration tests                                                        |
| `npm run test:unit`        | Unit tests only                                                                   |
| `npm run test:integration` | Integration tests only                                                            |
| `npm run test:ffmpeg`      | Tests against a real FFmpeg build (`FFMPEG_PATH`, or `ffmpeg` on the `PATH`)      |

Run a single file or test with Vitest directly, for example
`npx vitest run test/unit/domain/TrackQueue.test.ts -t "positions"`.

## Tests

```text
test/
├── unit/          Domain, application and adapter logic, all I/O faked
├── integration/   Adapters with real streams, child processes and sockets
├── ffmpeg/        Real FFmpeg: encoding, demuxing, failures, cancellation
└── fixtures/      Fakes for the ports, interactions, YouTube data, fake FFmpeg scripts
```

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
  New external systems get a port first. See [architecture](architecture.md).
- **TypeScript:** relative imports with the `.ts` extension; `import type` for
  types; no enums, namespaces or parameter properties (`erasableSyntaxOnly`);
  `#private` fields; `readonly` by default; discriminated unions for state; no
  `any`, and no non-null assertions where a check fits.
- **Errors:** throw a `SaturnError` subclass that says what failed. Errors
  users can act on extend `UserInputError`; failures of YouTube, Discord voice
  or FFmpeg extend `ExternalServiceError`. Map new ones in `userErrorMessage`.
  Keep the original error as `cause`.
- **Async work:** accept an `AbortSignal` for anything cancellable, and release
  resources on every path: success, failure and abort.
- **Logging:** context object first, message second, errors under `err`:
  `logger.warn({ err, guildId }, 'voice connection lost')`. Never log tokens
  or configuration values.
- **Comments:** only for decisions or behavior the code cannot make obvious.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/),
  small and focused, with checks passing.
