<p align="center">
  <a href="https://github.com/larafe1/saturn-bot">
    <img src="https://github.com/larafe1/saturn-bot/blob/master/.github/saturn-logo.png">
  </a>
</p>

<p align="center">
  <a href="https://github.com/larafe1/saturn-bot/releases">
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
  <a href="https://github.com/larafe1/saturn-bot/blob/master/LICENSE">
    <img src="https://img.shields.io/static/v1?label=license&message=GPL-v3.0&color=5965E0&labelColor=121214" alt="License">
  </a>
  <a href="https://github.com/larafe1/saturn-bot/actions/workflows/ci.yml">
    <img src="https://github.com/larafe1/saturn-bot/actions/workflows/ci.yml/badge.svg" alt="GitHub Actions">
  </a>
</p>

<a href="https://www.digitalocean.com/">
  <img src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%201.svg" alt="DigitalOcean Referral Badge" />
</a>

## Overview

Saturn is a full-modular multipurpose, user and developer-friendly discord bot. Just perfect for manage your server and provide the best experience for you and your community. All of that and more, together on the most fantastic planet in our solar system!

## How to use (MUST READ)

Saturn is a _self-hosted_ bot, this means you will need to host and maintain your own instance. For that, you can instantiate at your own machine or you can use a cloud platform to do that. A great cloud platform that I have used before and recommend is [Heroku](https://www.heroku.com/), it's a nice cloud service that offers great compatibility for apps like this one, and also has a free plan option.

Please notice, that you're **NOT** allowed to upload this bot to any service such as "discordbotlist" or "top.gg". You're only allowed to host this bot for your community.

In this step-by-step, I will only cover how you can set Saturn in your own machine. Also, notice that each topic in the next sections has a brief description in the title explaining what we're about to do. With that being said, let's move on.

### Getting started

First things first, make sure that you have `git`, `node`, and `npm` installed. Then open your terminal or cmd and type the commands below.

#### Cloning this repository and cd'ing into the project's folder

```elm
git clone https://github.com/larafe1/saturn-bot.git

cd saturn-bot
```

#### Setting up everything

```elm
-- Using npm:
npm install

-- Using yarn:
yarn
```

When the installation finishes, find the `.env.example` inside of the project's folder and open it with some text editor of your choice.

Now, make sure that you have your own bot token in hands — in case you don't know how to get it, go to the [Discord developers portal](https://discord.com/developers/) and create a new app, then, go to the "Bot" section and copy your generated token.

After that, set your bot token and some prefix of your choice (e.g: !, +, -). When you're done, rename the `.env.example` to `.env`.

```bash
BOT_TOKEN=
BOT_PREFIX=
```

Saturn also provides integration with [Prisma](https://www.prisma.io/), which is an ORM, and already has a built-in error database, which is a database that stores all the errors that the bot has encountered during its runtime. This can be useful for debugging purposes. To have this feature enabled, you must set the `DATABASE_URL` environment variable to the URL of your database, which is also available in the `.env` file.

```bash
DATABASE_URL=
```

#### Running

```elm
-- Using npm:
npm run dev

-- Using yarn:
yarn dev
```

## Final considerations

That's pretty much it, thanks for using Saturn and have fun!

Also, in case you wanna contribute to this project, PRs are more than welcome, feel free to open one.

> **This project is licensed under a [GNU General Public License v3.0 License](https://github.com/larafe1/saturn-bot/blob/master/LICENSE)**
