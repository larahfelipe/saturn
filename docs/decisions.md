# Decisions

Decisions that shape maintenance, with the reasoning and the trade-offs
accepted. Behavior differences from the Go implementation are listed in
[migration](migration.md#behavior-changes).

## Runtime and language

- **Node.js 26 LTS, native ESM.** Node 26 runs TypeScript directly by stripping
  types, so `npm run dev` needs no build step or loader. Production runs the
  compiled `dist/` output.
- **TypeScript 6.0, not 7.** TypeScript 7 ships no classic compiler API, and
  typescript-eslint supports TypeScript below 6.1 only. Revisit once
  typescript-eslint supports 7.
- **Erasable syntax only** (`erasableSyntaxOnly`): no enums, namespaces or
  parameter properties, so type stripping and `tsc` produce the same program.
  Imports use `.ts` extensions, rewritten to `.js` on build.
- **Strict compiler settings**, including `exactOptionalPropertyTypes` and
  `noUncheckedIndexedAccess`, plus type-aware typescript-eslint
  (`strictTypeChecked`).

## Architecture

- **Ports and adapters.** The playback engine depends on three interfaces
  (`TrackResolver`, `VoiceConnector`/`AudioSession`, `Logger`), not on
  discord.js, YouTube or FFmpeg. That allows deterministic tests of the hardest
  logic (ordering, cancellation, races) and keeps library churn out of
  `application/`.
- **Constructor injection, composed in `main.ts`.** No DI container and no
  singletons. The object graph is small enough to read in one file.
- **Commands are thin adapters.** Definitions (data sent to Discord) are
  separate from handlers (execution). The registry is an explicit list, not
  file-system discovery.
- **Typed error hierarchy** rooted at `SaturnError`. `UserInputError` and
  `ExternalServiceError` are mapped to replies in one place
  (`userErrorMessage`). Anything else gets a generic reply and is logged as an
  error.

## Dependencies

Every runtime dependency has one purpose. Versions are pinned exactly
(`save-exact`) and installed from the lockfile with `npm ci`.

| Package                 | Purpose                    | Why this one                                                                                                                                            |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `discord.js`            | Gateway, interactions, API | The maintained, typed Discord library for Node.js. `@discordjs/rest` comes with it.                                                                     |
| `@discordjs/voice`      | Voice connections, audio   | Official voice implementation. It encrypts with Node's built-in AES-256-GCM and bundles the DAVE library, so no sodium or Opus native module is needed. |
| `@distube/ytdl-core`    | YouTube metadata, streams  | Maintained fork of the abandoned `ytdl-core`. Hidden behind `TrackResolver`, so it can be replaced without touching playback.                           |
| `pino`                  | Structured JSON logs       | Fast, small, with built-in redaction.                                                                                                                   |
| `@prometheus-io/client` | Prometheus metrics         | The official successor of `prom-client`, which is deprecated in its favor. Same API.                                                                    |

Not used: `dotenv` (Node's `--env-file`), `glob` (explicit command registry),
`ffmpeg-static` (system FFmpeg), Opus and sodium native modules (see above),
`ts-node`/`tsx` (native type stripping), and the Prisma, axios, yt-search and
node-vibrant dependencies of the historical TypeScript branch.

**YouTube risk.** Extraction depends on YouTube's undocumented behavior.
Expect breakage when YouTube changes, and `BOT_CHECK` refusals from datacenter
IP addresses. Keep `@distube/ytdl-core` current, and swap the resolver if it
stops being maintained.

## Playback engine

- **One FFmpeg process per track**, reading the source stream on stdin and
  writing 48 kHz stereo Ogg/Opus to stdout. `@discordjs/voice` demuxes the Ogg
  pages and sends the Opus packets as they are, so no audio is encoded in
  JavaScript. FFmpeg handles any input codec YouTube serves.
- **Bitrate** follows the voice channel's bitrate, clamped to 8–128 kbit/s.
- **Audio format preference:** audio-only over muxed, then Opus (avoids
  decoding a lossy codec only to re-encode it to Opus), then the highest
  bitrate. DRM formats are excluded.
- **Streams open when the track starts**, not when it is requested. YouTube
  stream URLs expire, and a long queue would otherwise hold dead URLs and open
  connections.
- **FFmpeg is verified at startup** (binary present, `libopus` available), so a
  broken installation fails the process immediately instead of on the first
  `play`.
- **Stall tolerance:** up to 1 MiB of source audio, about a minute, is read
  ahead of playback. ytdl resumes a download whose next chunk takes longer
  than 10 s, so a network stall is absorbed by the read-ahead instead of
  interrupting the track. Once the buffer runs dry, the audio player allows
  250 missed frames (5 s) before it considers the track stuck, and a track
  that delivers no audio within 20 s of starting fails.

## Concurrency: per-guild serialization and epochs

Node.js runs one thread, but every `await` is a point where another
interaction can run. Go's implementation had races between stop/skip,
in-flight resolution and stream completion. The TypeScript design removes them
structurally:

- **`play` requests are ordered per guild.** Lookups start at once and run in
  parallel, so a slow one does not delay the others. Connecting and enqueueing
  then run one request at a time, in arrival order, chained on a promise tail.
  Queue positions are assigned atomically by `enqueue`, and guilds never wait
  on each other.
- **Lookups have a deadline.** A YouTube lookup can take several requests, each
  limited to 10 s by ytdl; the whole lookup is limited to 20 s.
- **Controls are synchronous.** `pause`, `resume`, `skip` and `stop` change
  state immediately and never queue behind a slow request.
- **Epochs.** Each activation of a player owns an `AbortController`. `stop`,
  disposal and voice loss abort it, which cancels resolution, connection and
  playback in progress. Every continuation re-checks the signal, so work from a
  previous epoch cannot start a track afterwards. `skip` aborts only the
  current track's controller.
- **Pure state machine.** `PlaybackState` transitions are a pure function, so
  invalid transitions are rejected and unit-tested instead of handled ad hoc.

## Resource management

- **Players exist only while needed.** The registry drops a player once it
  has no playback and no pending requests. An idle guild holds no memory,
  connection or process.
- **One owner per resource.** The audio session owns the voice connection. A
  track's abort signal owns its FFmpeg process (spawned with that signal and
  killed with `SIGKILL`) and destroys the source stream. Every exit path
  (finished, failed, skipped, stopped, shut down) goes through the same
  cleanup.
- **Voice recovery.** A disconnect counts as transient if the connection starts
  reconnecting within 5 s and becomes ready within 15 s. Otherwise the session
  is destroyed and the player stops. Joining a channel times out after 15 s.
- **Shutdown order:** players first, while the gateway is still up so voice
  disconnects are delivered, then the gateway, then the metrics server. Each
  step is limited to 5 s, and a failing step does not skip the next ones.

## Observability

- **Logs are JSON on stdout** in every environment. Rotation and shipping are
  the platform's job. Credential-like keys are redacted, and the token is
  never logged.
- **Metric names and help texts match Go**, so existing dashboards keep working.
  Command counters start at zero for every command, so `rate()` and absence
  alerts work from the first scrape. The active-player gauge is read from the
  registry at scrape time, so it cannot drift.

## Configuration

Environment variables only, read and validated once at startup. Errors name
the invalid variables without echoing their values. The token is a
non-enumerable property, so logging or serializing the config cannot reveal it.

## Container image

`node:26.13.1-trixie-slim` with Debian's `ffmpeg` package. The image is about 1 GB,
and FFmpeg with its libraries accounts for roughly 420 MB of it. A static
FFmpeg build or a distroless base would be smaller, but would replace
security updates from the distribution with manual tracking. Revisit if image
size becomes a problem.

## Testing

- **Fakes over mocks.** Ports have hand-written fakes (`test/fixtures`) that
  record calls and let tests settle promises explicitly to reproduce races.
- **FFmpeg integration tests use fake FFmpeg scripts** (pass-through, failing,
  stalled, missing libopus), so the default test run needs no FFmpeg. A
  separate `ffmpeg` project runs against a real FFmpeg build.
- **Real Discord and YouTube are not exercised automatically.** They require
  credentials and an allowed network; see [migration](migration.md).
