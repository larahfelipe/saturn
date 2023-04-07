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

Saturn is a full-modular multipurpose, user and developer-friendly Discord bot. It's perfect for managing your server and providing the best experience for you and your community. All of that and more, together on the most fantastic planet in our solar system!

## Usage

Saturn is a _self-hosted_ bot, which means you will need to host and maintain your own instance. For that, you can instantiate it on your own machine or use a cloud platform to do that. A great cloud platform that I have used before and recommend is [Heroku](https://www.heroku.com/). It's a nice cloud service that offers great compatibility for apps like this one.

Please note that you are **NOT** allowed to upload this bot to any service such as "discordbotlist" or "top.gg". You are only allowed to host this bot for your community.

In this step-by-step guide, we will only cover how you can set up Saturn on your own machine. Also, note that each topic in the following sections has a brief description in the title explaining what we're about to do. With that being said, let's move on.

### Getting started

First things first, make sure that you have `git`, `node`, and `npm` installed. Then open your terminal or cmd and type the commands below.

#### Clone this repo and navigate to it

```
git clone https://github.com/larahfelipe/saturn.git

cd saturn
```

#### Setting up

```
-- Using npm:
npm install

-- Using yarn:
yarn
```

When the installation finishes, find the `.env.example` file inside of the project's folder and open it with some text editor of your choice.

Now, make sure that you have your bot token and app id in hand. In case you don't know how to get these things, go to the [Discord developers portal](https://discord.com/developers/) and create a new app, copy your application id, and then go to the "Bot" section and copy your generated token.

After that, set your credentials and also your `GUILD_ID`. When you're done, rename the `.env.example` file to `.env`.

```bash
BOT_TOKEN=
BOT_APP_ID=
GUILD_ID=
```

Saturn also provides integration with Prisma, which is an ORM, and already has a built-in error database that stores all the errors that the bot has encountered during its runtime. This can be useful for debugging purposes. To have this feature enabled, you must set the `DATABASE_URL` environment variable to the URL of your database, which is also available in the `.env.example` file.

```bash
DATABASE_URL=
```

#### Running

```
-- Using npm:
npm run dev

-- Using yarn:
yarn dev
```

## Final considerations

That's pretty much it! Thank you for using Saturn and have fun!

Also, in case you want to contribute to this project, pull requests are more than welcome. Feel free to open one.

> **This project is licensed under a [GNU General Public License v3.0 License](https://github.com/larahfelipe/saturn/blob/master/LICENSE)**
