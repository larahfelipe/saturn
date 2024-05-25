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

## Usage

Saturn is a _self-hosted_ bot, which means you'll be responsible for hosting and maintaining your own instance. You can choose to set it up on your local machine or opt for a cloud platform. One recommended cloud platform is Heroku, known for its seamless compatibility with apps like Saturn.

Please be aware that uploading this bot to services like "discordbotlist" or "top.gg" is strictly prohibited. Saturn is intended for personal community hosting only.

### Getting started

In this step-by-step guide, you can choose between 2 setup paths. Although, I highly recommend using Docker to run this Discord bot because it offers several advantages. Docker provides a standardized environment for your application, ensuring that it runs consistently across different systems. This can greatly simplify deployment and eliminate potential compatibility issues, and I've ensured that everything necessary for the bot to work properly is included in the Dockerfile.

### Clone this repo and navigate to it

```
git clone https://github.com/larahfelipe/saturn.git && cd saturn
```

### Preparing the environment

Locate the `.env.example` file within the project's folder and open it using your preferred text editor.

Now, make sure you have your bot token and your desired bot prefix ready. If you don't know how to obtain your token, follow the steps below:

1. Visit the [Discord Developers Portal](https://discord.com/developers/);
2. Create a new app;
3. Navigate to the "Bot" section to copy your generated token.

After that, fill the `.env.example` with your credentials and rename it to `.env`.

### Setting up automatically via Docker (recommended)

Ensure you have Docker installed on your machine before proceeding. To check if Docker is properly installed, run the following command:

```
docker -v
```

If you get an output saying something like the Docker version, then you're good to go. Otherwise, please refer to the Docker documentation for installation instructions.

Once you have Docker installed, run the following command to build the image:

```
docker build -t saturn .
```

After the image is built, you can run the container using the following command:

```
docker run -d --name saturn saturn
```

Ensure that the container is running by executing the following command:

```
docker ps -a
```

If the container is running, you should be able to see it in the list of container with the status "Up".

For the Docker setup, that's it, you're good to go!

### Setting up manually

Before we begin, make sure that you have `go` installed in your machine. You can check this out by running the following command:

```
go version
```

Also, if you intend to use the music function, you must install `ffmpeg` on your system. The installation process varies depending on your operating system. For instance, if you are using Ubuntu, you can install it using the following command. Alternatively, refer to the FFmpeg documentation for installation instructions tailored to your specific OS.

```
sudo apt install ffmpeg -y
```

Now, you can start the bot by running the following command:

```
go run cmd/main.go
```
