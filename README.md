<p align="center">
  <a href="https://github.com/larahfelipe/saturn">
    <img src="https://github.com/larahfelipe/saturn/blob/master/.github/logo.png">
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

## Table of contents

- [About](#about)
- [Setup options](#setup-options)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Configuration](#configuration)
  - [Option 1: Docker setup (recommended)](#option-1-docker-setup-recommended)
  - [Option 2: Manual setup](#option-2-manual-setup)
- [License](#license)

## About

**Saturn** is a **self-hosted Discord bot** built with Go and `discordgo`. Designed for community use, it's lightweight, customizable, and easy to deploy either locally or in the cloud. Hosting platforms like **Heroku** work especially well with Saturn.

> ⚠️ **Note:** Public listing of this bot on services like [top.gg](https://top.gg) or [discordbotlist.com](https://discordbotlist.com) is **strictly prohibited**. Saturn is intended for **private or community use only**.

## Setup options

You can set up Saturn in two ways:

1. **Docker setup (Recommended)**: Provides a standardized environment, ensuring consistent performance across different systems while simplifying deployment.

2. **Manual Setup**: Traditional installation directly on your machine.

## Installation

### Prerequisites

- Git
- Your Discord bot token (from [Discord Developers Portal](https://discord.com/developers/))
- For Docker setup: Docker installed on your machine
- For manual setup: Go language and FFmpeg (for music functionality)

### Configuration

1. Clone the repository:

   ```bash
   git clone https://github.com/larahfelipe/saturn.git && cd saturn
   ```

2. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Add your bot token and configure your preferred prefix

### Option 1: Docker setup (recommended)

1. Verify Docker installation:

   ```bash
   docker -v
   ```

2. Build the Docker image:

   ```bash
   docker build -t saturn .
   ```

3. Run the container:

   ```bash
   docker run -d --name saturn saturn
   ```

4. Verify the container is running:
   ```bash
   docker ps -a
   ```
   The container should appear with status "Up".

### Option 2: Manual setup

1. Verify Go installation:

   ```bash
   go version
   ```

2. If using music functionality, install FFmpeg:

   - Ubuntu/Debian:
     ```bash
     sudo apt install ffmpeg -y
     ```
   - Other systems: Refer to the [FFmpeg documentation](https://ffmpeg.org/download.html)

3. Run the bot:
   ```bash
   go run cmd/main.go
   ```

## License

Saturn is licensed under the [GPL-3.0 License](https://github.com/larahfelipe/saturn/blob/master/LICENSE).
