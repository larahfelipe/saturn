<p align="center">
  <a href="https://github.com/larahfelipe/saturn">
    <img src="https://github.com/larahfelipe/saturn/blob/master/.github/saturn-logo.png">
  </a>
</p>

<p align="center">
  <a href="https://github.com/larahfelipe/saturn/releases">
    <img src="https://img.shields.io/static/v1?label=version&message=5.x&color=5965E0&labelColor=121214" alt="Version">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/static/v1?label=built%20with&message=TypeScript&color=5965E0&labelColor=121214" alt="TypeScript">
  </a>
  <a href="https://nodejs.org/en/">
    <img src="https://img.shields.io/static/v1?label=built%20with&message=Node.js&color=5965E0&labelColor=121214" alt="Node.js">
  </a>
  <a href="https://github.com/discordjs/discord.js/">
    <img src="https://img.shields.io/static/v1?label=built%20with&message=Discord.js&color=5965E0&labelColor=121214" alt="Discord.js">
  </a>
  <a href="https://github.com/larahfelipe/saturn/blob/master/LICENSE">
    <img src="https://img.shields.io/static/v1?label=license&message=GPL-v3.0&color=5965E0&labelColor=121214" alt="License">
  </a>
  <a href="https://github.com/larahfelipe/saturn/actions/workflows/ci.yml">
    <img src="https://github.com/larahfelipe/saturn/actions/workflows/ci.yml/badge.svg" alt="GitHub Actions">
  </a>
</p>

## Overview

Saturn is a comprehensive, fully modular, multipurpose Discord bot that caters to both users and developers. It's an ideal choice for effectively managing your server and enhancing the overall experience for you and your community. All of this and much more, bundled together on the most captivating planet in our solar system!

## Usage

Saturn is a _self-hosted_ bot, which means you'll be responsible for hosting and maintaining your own instance. You can choose to set it up on your local machine or opt for a cloud platform. One recommended cloud platform is Heroku, known for its seamless compatibility with apps like Saturn.

Please be aware that uploading this bot to services like "discordbotlist" or "top.gg" is strictly prohibited. Saturn is intended for personal community hosting only.

In this step-by-step guide, we will focus on setting up Saturn on your local machine. Each section's title provides a brief description of the upcoming steps. With that, let's get started.

### Getting started

Before we begin, make sure that you have `git`, `node`, and `npm` installed.

Also, I highly recommend using Docker to run this Discord bot because it offers several advantages. Docker provides a standardized environment for your application, ensuring that it runs consistently across different systems. This can greatly simplify deployment and eliminate potential compatibility issues, and I've ensured that everything necessary for the bot to work properly is included in the Dockerfile.

#### Clone this repo and navigate to it

```
git clone https://github.com/larahfelipe/saturn.git && cd saturn
```

#### Preparing the environment

Locate the `.env.example` file within the project's folder and open it using your preferred text editor.

Ensure you have your bot token and application ID ready. If you're unsure how to obtain these, visit the [Discord Developers Portal](https://discord.com/developers/), create a new app, copy your application ID, and navigate to the "Bot" section to copy your generated token.

Next, input your credentials and the `GUILD_ID`. Once you've completed this step, rename the `.env.example` file to `.env`.

```bash
BOT_TOKEN=
BOT_APP_ID=
GUILD_ID=
```

Saturn also offers database integration through Prisma, which is an Object-Relational Mapping (ORM). I have already implemented an integration that stores all the errors encountered by the bot during its runtime. This can be valuable for debugging purposes. To enable this feature, you must set the `DATABASE_URL` environment variable to your database's URL, which is also provided in the `.env.example` file.

```bash
DATABASE_URL=
```

##### Setting up automatically via Docker (recommended)

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

For the Docker setup, that's it! However, if you prefer to set up the bot manually, please refer to the next section.

##### Setting up manually

If you intend to use the music function, you must install `ffmpeg` on your system. The installation process varies depending on your operating system. For instance, if you are using Ubuntu, you can install it using the following command. Alternatively, refer to the FFmpeg documentation for installation instructions tailored to your specific OS.

```
sudo apt install ffmpeg -y
```

Once you have `ffmpeg` installed, you can proceed to install the project dependencies by running the following command:

```
-- Using npm:
npm install

-- Using yarn:
yarn
```

After the installation is complete, you can start the bot by running the following command:

```
-- Using npm:
npm run dev

-- Using yarn:
yarn dev
```

## Final considerations

That's all there is to it! Thank you for choosing Saturn, and enjoy using it!

Additionally, if you wish to contribute to this project, we welcome pull requests with open arms. Please don't hesitate to open one if you'd like to get involved.

> **This project is licensed under a [GNU General Public License v3.0 License](https://github.com/larahfelipe/saturn/blob/master/LICENSE)**
