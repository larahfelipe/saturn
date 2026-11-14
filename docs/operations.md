# Operations

## Discord application

- Invite the bot with the `bot` and `applications.commands` scopes and the
  **View Channels**, **Connect** and **Speak** permissions.
- Gateway intents: `Guilds` and `GuildVoiceStates`. Neither is privileged, so
  nothing needs enabling in the Developer Portal.
- Slash commands are global and synchronized on every start with a bulk
  overwrite. Commands registered for the same application by anything else
  are removed.
- Run one instance per bot token. A second process with the same token
  receives the same interactions, and the two race to answer them. This also
  applies to the Go and TypeScript implementations.

## Docker deployment

```bash
docker build -t saturn .
docker run -d --name saturn \
  --restart unless-stopped \
  --stop-timeout 20 \
  --env-file .env \
  -p 127.0.0.1:8080:8080 \
  saturn
```

- Configuration comes only from the environment. The build context is an
  allow-list (`.dockerignore`), so `.env` files never enter the image.
- Docker's `--env-file` takes values literally: write
  `BOT_ACTIVITY_STATUS=Hello, earth!`, without quotes.
- Publish port 8080 only to where Prometheus scrapes from. The endpoint has no
  authentication.
- `--stop-timeout 20` leaves room for the shutdown steps (up to 5 s each)
  before Docker sends `SIGKILL`. The default is 10 s.
- The process exits on fatal errors, and the restart policy brings it back.
  There is no health endpoint. A running process with a reachable
  `/metrics` has passed configuration and FFmpeg checks, but it may not have
  connected to Discord yet.

The image runs `node dist/main.js` as the unprivileged `node` user from
`/app`. It contains production dependencies only and FFmpeg from Debian.

## Environment variables

| Variable              | Required | Default      | Description                                             |
| --------------------- | -------- | ------------ | ------------------------------------------------------- |
| `BOT_TOKEN`           | yes      |              | Discord bot token. Never logged.                        |
| `BOT_ACTIVITY_STATUS` | no       | none         | Custom status text shown on the bot's profile.          |
| `APP_ENVIRONMENT`     | no       | `production` | `production` (info logs) or `development` (debug logs). |
| `FFMPEG_PATH`         | no       | `ffmpeg`     | FFmpeg binary, resolved through `PATH` when not a path. |

Values are trimmed, and blank values count as unset. Invalid configuration
stops the process with exit code 1 and an `invalid configuration` log naming
each offending variable, never its value. The metrics port is fixed at 8080.

## Runtime requirements

- Node.js 26 (included in the image).
- FFmpeg with the `libopus` encoder. Startup checks both and exits with code 1
  if either is missing. The image ships Debian 13's FFmpeg 7.1, the version
  the `test:ffmpeg` suite is verified against.
- Outbound network: HTTPS and WSS to Discord, UDP to Discord voice servers,
  HTTPS to YouTube. YouTube may refuse datacenter IP addresses with
  `BOT_CHECK`; run from a network YouTube accepts.
- One FFmpeg child process per guild that is playing.

## Logging

One JSON object per line on stdout, written by pino:

```json
{
  "level": 30,
  "time": 1794676107097,
  "pid": 1,
  "hostname": "…",
  "port": 8080,
  "msg": "metrics endpoint listening"
}
```

- `level`: 20 debug, 30 info, 40 warn, 50 error. Production logs from info,
  development from debug (`playback state changed`, `shutdown step completed`).
- Context fields include `guildId`, `channelId`, `command`, `trackId` and
  `err` (`type`, `message`, `stack`, and the `cause` chain in the message).
- Keys named `token`, `botToken` or `authorization`, at the top level or one
  object deep, are replaced with `[Redacted]`.
- `npm run dev` pretty-prints the logs. For production, collect stdout with the
  container runtime.

Messages worth alerting or searching on:

| Message                                             | Level        | Meaning                                                            |
| --------------------------------------------------- | ------------ | ------------------------------------------------------------------ |
| `invalid configuration`                             | error        | Startup stopped; the error names the variables                     |
| `startup failed`                                    | error        | FFmpeg check, metrics port or Discord login failed; exiting with 1 |
| `discord ready`, `slash commands synchronized`      | info         | Connected and serving                                              |
| `discord gateway disconnected` / `resumed`          | warn / info  | Gateway connection dropped / recovered                             |
| `command rejected`                                  | info         | User error (invalid URL, not in a voice channel)                   |
| `command failed`                                    | warn         | YouTube or voice failure reported to the user                      |
| `command failed`, `interaction failed`              | error        | Unexpected error; the user got a generic reply                     |
| `track playback failed`                             | error        | Stream or FFmpeg failure; the track was skipped                    |
| `voice connection lost`                             | warn         | Voice did not recover; the guild's playback stopped                |
| `shutting down`, `shutdown complete`                | info         | Shutdown reason and exit code                                      |
| `shutdown step failed` / `timed out`, `forced exit` | error / warn | Shutdown did not complete cleanly                                  |

## Metrics

`GET /metrics` (or `HEAD`) on port 8080, all interfaces, in the Prometheus text
format. Other paths return 404, other methods 405.

| Metric                                     | Type    | Description                                                                      |
| ------------------------------------------ | ------- | -------------------------------------------------------------------------------- |
| `saturn_commands_processed_total{command}` | counter | Slash commands received, per command. Starts at 0 for each. Buttons not counted. |
| `saturn_active_players`                    | gauge   | Guilds holding playback resources (connecting, playing or paused).               |
| `process_*`, `nodejs_*`                    | various | Node.js runtime and process metrics.                                             |

```yaml
scrape_configs:
  - job_name: saturn
    static_configs:
      - targets: ['saturn:8080']
```

## Graceful shutdown

On `SIGTERM` or `SIGINT`:

1. **players**: reject new requests, abort streams, kill FFmpeg, leave voice
   channels.
2. **discord gateway**: close the gateway connection.
3. **metrics server**: stop listening and drop open connections.
4. Flush logs and exit.

Each step has 5 s. A failed or timed-out step is logged, and the remaining
steps still run. Queues are not persisted: playing and queued tracks are
dropped.

Exit codes:

- **0**: clean shutdown after a signal.
- **1**: invalid configuration, startup failure, a failed or timed-out
  shutdown step, an uncaught exception or unhandled rejection, or a second
  signal during shutdown (forced exit).

Node runs as PID 1 in the container and handles signals itself, so no init
process is needed.

## Troubleshooting

| Symptom                                                       | Likely cause and action                                                                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exits with `invalid configuration`                            | `BOT_TOKEN` missing or `APP_ENVIRONMENT` not `development`/`production`. The log names the variable.                                                  |
| `startup failed` with `FfmpegUnavailableError`                | FFmpeg not found or built without libopus. Install it or set `FFMPEG_PATH`.                                                                           |
| `startup failed` with `TokenInvalid` or HTTP 401              | Wrong or reset token. Copy a fresh one from the Developer Portal.                                                                                     |
| `startup failed` with `EAI_AGAIN`, `ENOTFOUND` or `ETIMEDOUT` | No DNS or outbound access to Discord.                                                                                                                 |
| `startup failed` with `EADDRINUSE`                            | Port 8080 is taken.                                                                                                                                   |
| Commands missing in Discord                                   | Bot invited without `applications.commands`, or synchronization failed (see `startup failed`). Reload the Discord client to refresh its command list. |
| `Something went wrong while searching your song`              | YouTube refused or the video is unavailable. `command failed` shows the code, e.g. `BOT_CHECK` (datacenter IP), `PRIVATE`.                            |
| `…trying to join the party`                                   | User not in a voice channel, bot lacks View Channels/Connect/Speak, or voice did not become ready within 15 s.                                        |
| Tracks skip right after starting                              | `track playback failed`: the message includes FFmpeg's last error line or the stream error.                                                           |
| Bot leaves voice unexpectedly                                 | `voice connection lost`: kicked, channel deleted, or voice did not start reconnecting within 5 s and become ready within 15 s.                        |
| `/health` shows `-1ms`                                        | No heartbeat acknowledged yet after connecting. Retry after a minute.                                                                                 |
| Discord shows "The application did not respond"               | Another instance uses the same token, or the process is overloaded or stopped. Check for `failed to respond to interaction`.                          |
