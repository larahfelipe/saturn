<p align="center">
  <a href="https://github.com/larahfelipe/saturn">
    <img src="https://github.com/larahfelipe/saturn/blob/master/.github/logo.png" alt="Saturn Logo">
  </a>
</p>

<p align="center">
  <a href="https://go.dev/">
    <img src="https://img.shields.io/static/v1?label=built%20with&message=Go&color=5965E0&labelColor=121214" alt="Go">
  </a>
  <a href="https://github.com/bwmarrin/discordgo">
    <img src="https://img.shields.io/static/v1?label=built%20with&message=discordgo&color=5965E0&labelColor=121214" alt="discordgo">
  </a>
  <a href="https://github.com/larahfelipe/saturn/blob/master/LICENSE">
    <img src="https://img.shields.io/static/v1?label=license&message=GPL-3.0&color=5965E0&labelColor=121214" alt="License">
  </a>
</p>

---

## Table of Contents

- [About](#about)
- [Features](#features)
- [Commands](#commands)
- [Configuration](#configuration)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Docker Setup (Recommended)](#docker-setup-recommended)
  - [Manual Setup](#manual-setup)
- [Testing](#testing)
- [License](#license)

---

## About

**Saturn** is a self-hosted Discord music bot built with Go and `discordgo`. It is designed for private or community use only.

> ⚠️ **Notice:** Listing this bot publicly on services like top.gg or discordbotlist.com is prohibited.

---

## Features

- **Multi-Guild Isolation**: Separate playback states, voice sessions, and queues for each server.
- **Ffmpeg Audio Streaming**: Efficient YouTube audio resolution and streaming.
- **Race-Free Concurrency**: Thread-safe queue structures and event coordinators.
- **Minimised Base Container**: Optimized multi-stage Docker build utilizing Debian-Slim and running under non-root user permissions.

---

## Commands

Commands are registered as native Discord Slash Commands.

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `play` | `<youtube-url>` | Resolve and play a YouTube audio stream |
| `pause` | None | Pause playback |
| `unpause` | None | Resume playback |
| `skip` | None | Skip the current track |
| `stop` | None | Stop streaming and clear guild queue |
| `help` | None | Print active command configurations |
| `ping` | None | Check bot responsiveness |
| `health` | None | Check heartbeat connection latency |

---

## Configuration

Duplicate `.env.example` to `.env` and set the following parameters:

```env
BOT_TOKEN=your-discord-bot-token
BOT_ACTIVITY_STATUS="Hello, earth!"
APP_ENVIRONMENT=production
```

---

## Prerequisites

- Git
- Discord bot token (obtained from the Discord Developers Portal)
- Gateway Intents enabled on the Bot page (Guilds, Guild Voice States, Guild Messages)
- **Docker** (recommended setup) or **Go 1.26+** and **FFmpeg** (manual setup)

---

## Installation

Clone the repository and enter the directory before choosing an installation option:

```bash
git clone https://github.com/larahfelipe/saturn.git && cd saturn
```

### Docker Setup (Recommended)

1. Build the Docker container:
   ```bash
   docker build -t saturn .
   ```

2. Run the container, passing the environment variables:
   ```bash
   docker run -d --name saturn --env-file .env saturn
   ```

### Manual Setup

1. Verify Go version (requires Go 1.26+):
   ```bash
   go version
   ```

2. Install FFmpeg:
   - **Debian/Ubuntu**:
     ```bash
     sudo apt update && sudo apt install -y ffmpeg
     ```
   - **macOS**:
     ```bash
     brew install ffmpeg
     ```

3. Build and execute:
   ```bash
   go run cmd/main.go
   ```

---

## Testing

Verify queue concurrency and routing handlers:

```bash
go test -race ./...
```

---

## License

Saturn is licensed under the GPL-3.0 License. See the `LICENSE` file for details.
