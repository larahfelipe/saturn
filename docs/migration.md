# Go → TypeScript migration record

Behavioral contract of the Go implementation on `master` (`d837df6`), the
parity matrix, and the acceptance status of the TypeScript reimplementation on
`nodejs-stale`. Remove this file together with the Go sources once parity is
validated against a real Discord application.

## Reference behavior (Go, `master`)

### Commands

All commands are global slash commands, registered one by one at startup
(`ApplicationCommandCreate`; stale commands are never removed).

| Command                       | Behavior                                                                                            | Responses                                                   |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `play url:<string, required>` | Validates the URL synchronously, defers, then resolves, enqueues and starts playback in a goroutine | See [play flow](#play-flow)                                 |
| `pause`                       | Sends `PAUSE` if the player is not idle                                                             | `Playback paused ⏸️` / `There is no song playing right now` |
| `unpause`                     | Sends `UNPAUSE` if the player is not idle                                                           | `Playback resumed ▶️` / idle text                           |
| `skip`                        | Sends `SKIP` if the player is not idle                                                              | `Song skipped ⏭️` / idle text                               |
| `stop`                        | Resets the player (disconnect, clear queue) if not idle                                             | `Playback stopped 🛑` / idle text                           |
| `help`                        | Lists active commands, `` `/name` - description ``, map order (random)                              | Standard embed, `Available slash commands:` header          |
| `ping`                        | —                                                                                                   | `Pong! 🏓`                                                  |
| `health`                      | Gateway heartbeat latency                                                                           | Standard embed, `Heartbeat latency: <n>ms`                  |

Control responses are plain, public text. Pausing an already paused player and
resuming a playing one both report success.

### Play flow

1. Missing `url` → error embed `Missing song url option`.
2. Not `https`, or host not in `youtube.com`, `www.youtube.com`,
   `m.youtube.com`, `youtu.be` → error embed
   `Invalid YouTube URL. Please provide a valid YouTube link`.
3. Defer the reply (deferred channel message).
4. Metadata failure → `Something went wrong while searching your song. Please, try again later`.
5. No format with audio → `No suitable audio track was found for this video`.
6. Stream failure → `Something went wrong while retrieving your song. Please, try again later`.
7. Enqueue; position = waiting songs + 1, read separately from the insert.
8. Join the requester's voice channel if not connected. Failure, including the
   requester not being in a voice channel →
   `Something went wrong while trying to join the party. Please, try again later`.
9. Edit the deferred reply with the track embed and the four control buttons:
   `Queued` if the player was already active, otherwise `Now playing`.

### Embeds

| Embed       | Author                                        | Description                                     | Footer                   | Color     | Timestamp |
| ----------- | --------------------------------------------- | ----------------------------------------------- | ------------------------ | --------- | --------- |
| Standard    | bot username + avatar                         | content                                         | `From space`             | `#6E76E5` | yes       |
| Error       | `❌ Oops, a wild error appeared! 😱` + avatar | content                                         | `Please try again later` | `#FB3640` | yes       |
| Queued      | `Queued`                                      | `Added to the queue by <@user> at position <n>` | `Duration: <d>`          | `#FFB319` | yes       |
| Now playing | `Now playing` + cd.gif icon                   | `Requested by <@user> Enjoy!`                   | `Duration: <d>`          | `#1ED760` | no        |

Track embeds carry the title, the video URL and the first thumbnail.

### Buttons

Custom ID `<action>_<guildId>`, actions `pause`, `unpause`, `skip`, `stop`
(labels Pause, Resume, Skip, Stop). The reply is ephemeral and uses the command
texts; failure, including an unknown action, replies
`Command could not be completed (player might be idle)`. An ID without `_` is
never acknowledged. The guild comes from the custom ID, not the interaction.

### Playback lifecycle

- One `Queue` per guild, created on first access, never removed. Each owns a
  goroutine that loops forever.
- Signals: `PLAY` pops the next song and streams it; on completion `PLAY` again;
  an empty queue resets the player (voice disconnect, idle).
- `SKIP` ends the current stream and plays the next song, or resets if none.
- A stream error resets the player, which also clears the queue.
- Audio: the full YouTube stream is resolved before enqueueing, then encoded by
  FFmpeg (dca, Opus). Bitrate = voice channel kbps when ≤ 128, else 128 when the
  source is ≥ 128 kbps, else the dca default (64).

### Platform

- Config: `.env` loaded if present. `BOT_TOKEN` required; `BOT_ACTIVITY_STATUS`
  optional custom status; `APP_ENVIRONMENT=development` selects the verbose
  console logger, anything else JSON logs to stdout and `.logs/app.log`.
- Gateway intents: `Guilds`, `GuildVoiceStates`.
- Metrics on `:8080/metrics`: `saturn_commands_processed_total{command}`
  (incremented before running a known, active command; buttons not counted) and
  `saturn_active_players` (incremented when an idle player starts, decremented
  on reset), plus Go runtime and process metrics.
- Shutdown on SIGINT/SIGTERM: close the gateway, then reset players, then sync
  logs. The metrics server is never closed.
- Docker: multi-stage, Debian slim runtime with FFmpeg, non-root user, port 8080.

### Known defects (not reproduced)

| Defect                                                                                         | Resolution in TypeScript                                          |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Queue position read separately from the insert                                                 | `TrackQueue.enqueue` returns the position atomically              |
| Song stays queued after a voice join failure                                                   | Join before enqueueing; a failed join enqueues nothing            |
| `Thumbnails[0]` and `Member.User` dereferenced unchecked (panic on empty thumbnails or DM use) | Optional artwork; commands are guild-only                         |
| Stream resolved at request time; queued URLs can expire                                        | Streams are opened when a track starts                            |
| Player goroutines and registry entries never terminate                                         | Players are disposed when idle and on shutdown                    |
| Stop/skip race with in-flight resolution and stream completion                                 | Per-guild serialized operations, `AbortSignal`, generation checks |
| Stream error clears the whole queue                                                            | Failed track is skipped; the queue advances                       |
| Voice disconnected after the gateway is closed; metrics server left open                       | Ordered shutdown                                                  |
| Control buttons trust the guild in the custom ID                                               | Custom ID guild must match the interaction guild                  |
| Stale global commands never removed                                                            | Commands synchronized with a bulk overwrite                       |

## Behavior changes

Intentional differences from `master`; see [decisions](decisions.md).

- Durations render as `m:ss` / `h:mm:ss` instead of Go's `3m33s`.
- Logs go to stdout only; the `.logs/app.log` file sink is dropped.
- `help` lists commands in registration order.
- An unrecognized `APP_ENVIRONMENT` value is rejected at startup.
- The Opus bitrate is the channel bitrate clamped to 8–128 kbit/s. Go fell back to
  64 kbit/s on channels above 128 kbit/s when the source was below 128 kbit/s.
- `play` defers before validating the URL, so an invalid URL edits the deferred
  reply instead of replying directly.
- Stream failures surface when a track starts, not at request time: they are
  logged and the queue advances, so the `…while retrieving your song…` reply is
  gone.
- New replies: `Playback was stopped before your song could be added` (stop
  during resolution), `Saturn is shutting down. Please, try again later`, and
  `Something went wrong. Please, try again later` for unexpected errors.
- `play` refuses stage channels, the AFK channel, full channels and channels
  where the bot lacks Connect or Speak before joining, each with its own reply.
  Go joined them anyway: a timeout, or silence after `Now playing`.
- A guild's queue holds at most 100 songs; beyond that `play` replies
  `The queue is full (100 songs). Please, try again later`. Go's queue was
  unbounded.
- A user may send 5 `play` requests in any 10 s; beyond that `play` replies
  `You are adding songs too quickly. Please, try again in N seconds`. Go had
  no limit.
- Every button interaction is acknowledged. Malformed IDs, unsupported actions
  and IDs naming another guild reply with the ephemeral failure text.
- `saturn_commands_processed_total` exports every command at zero from startup,
  and `saturn_active_players` is read from the player registry at scrape time.
  Go runtime metrics are replaced by Node.js runtime and process metrics.
- `APP_ENVIRONMENT=development` lowers the log level to `debug`; output is JSON
  in both environments, pretty-printed by `npm run dev`.
- Startup fails with exit code 1 when FFmpeg is missing or lacks libopus,
  before connecting to Discord.
- Shutdown exits with 0 after a clean SIGINT/SIGTERM shutdown and 1 when a step
  fails or times out, on startup failure, or on an uncaught error. A second
  signal forces an immediate exit.
- The Docker image is based on Debian 13 instead of 12, so it ships FFmpeg 7.1
  instead of 5.1, and runs as `node` (uid 1000) from `/app`.
- A GitHub Actions workflow runs the checks, the real-FFmpeg tests and a Docker
  image smoke test; `master` has no CI.

## Edge cases

| Case                                      | Expected behavior                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| Empty queue on skip                       | Current track stops; player goes idle and disconnects                    |
| Missing / invalid URL, unsupported host   | User-input error reply, nothing enqueued                                 |
| Unavailable, private or bot-checked video | Resolution error reply, nothing enqueued                                 |
| No audio formats                          | `No suitable audio track…` reply                                         |
| Missing thumbnail                         | Embed without thumbnail                                                  |
| Stream failure mid-queue                  | Error logged, next track starts                                          |
| Voice connection failure / disconnect     | Join error reply; on disconnect, reconnect attempt, then player disposal |
| Concurrent `play` requests                | Looked up in parallel, enqueued in arrival order; unique positions       |
| Rapid pause/unpause, concurrent controls  | Serialized; final state matches last operation                           |
| Stop during resolution                    | Resolution aborted; no track starts afterwards                           |
| Skip while the track is ending            | Exactly one advancement                                                  |
| Interaction timeout                       | `play` defers before any I/O                                             |
| Termination during playback               | Streams aborted, FFmpeg killed, voice disconnected, then gateway closed  |

## Parity matrix

Status: ✅ implemented and tested · 🟡 implemented, pending real Discord validation.

| Feature                     | Status |
| --------------------------- | ------ |
| play                        | 🟡     |
| pause                       | 🟡     |
| unpause                     | 🟡     |
| skip                        | 🟡     |
| stop                        | 🟡     |
| help                        | 🟡     |
| ping                        | 🟡     |
| health                      | 🟡     |
| Playback buttons            | 🟡     |
| Per-guild queues            | ✅     |
| Per-guild player isolation  | ✅     |
| YouTube metadata resolution | 🟡     |
| YouTube audio streaming     | 🟡     |
| FFmpeg integration          | 🟡     |
| Voice channel management    | 🟡     |
| Prometheus metrics          | ✅     |
| Structured logging          | ✅     |
| Graceful shutdown           | 🟡     |
| Docker deployment           | 🟡     |

## YouTube extraction proof of concept

`@distube/ytdl-core` 5.2.1 on Node.js 26.13.1, 2026-11-14, from an Oracle Cloud
host:

- `watch?v=dQw4w9WgXcQ`: metadata in ~1.1 s, audio formats 139/140 (AAC) and
  249/250/251 (Opus), 512 KiB streamed; aborting the signal destroyed the stream.
- `watch?v=aaaaaaaaaaa`: `YtdlError` `NOT_FOUND`.
- Further requests from the same host failed with `BOT_CHECK` ("Sign in to
  confirm you're not a bot"), a datacenter IP restriction rather than a library
  fault. Real playback must be validated from a residential or allowed network.
