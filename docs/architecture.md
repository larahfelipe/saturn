# Architecture

Saturn is a single Node.js process: a Discord gateway client, one playback
engine per guild, and an HTTP endpoint for Prometheus. The code follows a
ports-and-adapters layout so the playback engine runs and is tested without
Discord, YouTube or FFmpeg.

## Layers

```text
src/
├── domain/music/        Track, TrackQueue, PlaybackState transitions, domain errors
├── application/
│   ├── music/           GuildPlayer, PlayerRegistry, PlaybackService
│   ├── ports/           TrackResolver, Voice (VoiceConnector, AudioSession), Logger
│   └── errors.ts        Errors the application reports to adapters
├── infrastructure/
│   ├── youtube/         YouTubeTrackResolver (TrackResolver over @distube/ytdl-core), cookie sign-in
│   ├── audio/           VoiceConnectionManager, DiscordAudioSession, FFmpeg encoding
│   ├── discord/         DiscordClient, InteractionHandler, commands, replies
│   ├── logging/         pino logger factory
│   └── metrics/         Metrics (Prometheus registry), MetricsServer (HTTP)
├── config/              Environment loading and validation
├── lifecycle/           GracefulShutdown
├── shared/              SaturnError, the root of every error class
└── main.ts              Composition root
```

| Layer          | Responsibility                                                                                                    | May import                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Domain         | Pure rules: track validity, FIFO positions, the playback state machine. No I/O, no timers.                        | `shared`                                |
| Application    | Playback use cases and per-guild coordination. Talks to the outside world only through the interfaces in `ports`. | `domain`, `shared`                      |
| Infrastructure | Adapters implementing the ports, plus Discord, logging and metrics concerns. No playback rules.                   | `application`, `domain`, `shared`, libs |
| Config         | Turns environment variables into a validated, frozen `Config`.                                                    | `shared`                                |
| Lifecycle      | Ordered, time-boxed shutdown driven by process signals.                                                           | `application/ports`                     |
| `main.ts`      | Builds every object, wires them together and starts the process. The only module that knows all others.           | everything                              |

Dependencies are passed through constructors; there is no container and no
module-level mutable state. The ports are where the tests substitute fakes.

## Main components

- **`GuildPlayer`** owns one guild's queue, playback state, voice session and
  in-flight work. See [concurrency](decisions.md#concurrency-per-guild-serialization-and-epochs).
- **`PlayerRegistry`** creates a player on first use, drops it once it is idle,
  counts active players for the metrics gauge, and disposes all of them on
  shutdown.
- **`PlaybackService`** is the use-case API the Discord layer calls: `play`,
  `pause`, `resume`, `skip`, `stop`, addressed by guild ID, with the member's
  voice channel. Members outside the bot's voice channel are refused.
- **`YouTubeTrackResolver`** validates the URL, fetches metadata, picks an audio
  format and returns a `Track` plus an `AudioSource` whose stream is opened
  only when the track starts.
- **`VoiceConnectionManager`** joins a voice channel and, once the connection
  is ready, returns a `DiscordAudioSession`.
- **`DiscordAudioSession`** plays one track at a time: source stream → FFmpeg →
  Ogg/Opus → `@discordjs/voice` audio player. It owns the voice connection and
  recovers it from transient disconnects.
- **`InteractionHandler`** routes slash commands and playback buttons to
  handlers, acknowledges each interaction exactly once, maps errors to replies
  and counts commands. Deferred commands of a guild run in arrival order.
- **`CommandRegistry`** pairs the command definitions (data sent to Discord)
  with their handlers (execution) and synchronizes the definitions.
- **`DiscordClient`** wraps the discord.js `Client`: login, command
  synchronization, presence, voice channel lookup, shutdown.
- **`Metrics` / `MetricsServer`** hold the Prometheus registry and serve it on
  `GET /metrics`.
- **`GracefulShutdown`** runs the shutdown steps once, in order, each with a
  time limit, then flushes logs and exits.

## Data flows

### `play`

```text
Discord ─interaction→ DiscordClient ─→ InteractionHandler
  defer reply (before any I/O, inside Discord's 3 s window)
  ── wait for earlier play interactions of the guild (arrival order) ──
  → play handler → PlaybackService.play(guild, url, user, voice channel)
    refuse if the user is in no voice channel or over the request limit
    → PlayerRegistry.acquire(guild) → GuildPlayer.play
      refuse if the bot is in another voice channel or the queue is full
      1. TrackResolver.resolve(url)          metadata + lazy AudioSource, starts at once
      ── wait for earlier requests of the guild (arrival order) ──
      2. VoiceConnector.connect(channel)     only when not connected yet
      3. refuse if the bot is in another voice channel by now
      4. TrackQueue.enqueue → position
      5. start the playback loop if nothing is playing
  ← "Now playing" or "Queued at position n" embed with control buttons
```

### Playback loop

`GuildPlayer` dequeues the next track and calls `AudioSession.play(source,
signal)`. `DiscordAudioSession` opens the source stream, spawns FFmpeg, and
wraps FFmpeg's Ogg/Opus output in an audio resource. When the resource ends or
fails, the loop advances. A failed track is logged and skipped. When the queue
is empty, the player releases the session (FFmpeg gone, voice left), goes idle,
and the registry drops it. If a `play` request is still in flight at that
moment, the player keeps the session and waits for it instead, so the bot does
not leave and rejoin the channel; it leaves once no request remains.

### Controls

Slash commands and buttons call `PlaybackService.pause/resume/skip/stop` with
the member's voice channel; members outside the bot's channel are refused.
These are synchronous state changes, so they never wait behind a slow `play`.
`skip` aborts the current track's signal. `stop` aborts the player's epoch,
which also cancels in-flight resolution and connection attempts. Button custom
IDs carry the guild ID, and the handler acts only when it matches the
interaction's guild.

### Shutdown

`SIGINT`/`SIGTERM` → `GracefulShutdown`: close the player registry (new
requests rejected, streams aborted, FFmpeg killed, voice left) → destroy the
gateway client → close the metrics server → flush logs → exit. See
[operations](operations.md#graceful-shutdown).

### Metrics

`InteractionHandler` increments `saturn_commands_processed_total` before
running each recognized command. `saturn_active_players` is computed from
`PlayerRegistry` at scrape time.
