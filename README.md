<p align="center">
    <a href="https://github.com/felpshn/saturn-bot">
       <img src="https://github.com/felpshn/saturn-bot/blob/master/.github/project-banner.png">
    </a>
</p>

<p align="center">
    <a href="https://github.com/felpshn/saturn-bot">
        <img src="https://img.shields.io/badge/version-5.0-lightgrey">
    </a>
    <a href="https://www.typescriptlang.org/">
        <img src="https://img.shields.io/badge/built%20with-TypeScript-blue">
    </a>
    <a href="https://nodejs.org/en/">
        <img src="https://img.shields.io/badge/built%20with-Node.js-brightgreen">
    </a>
    <a href="https://github.com/discordjs/discord.js/">
        <img src="https://img.shields.io/badge/built%20with-Discord.js-9cf">
    </a>
    <a href="https://github.com/felpshn/saturn-bot/blob/master/LICENSE">
        <img src="https://img.shields.io/badge/license-MIT-orange">
    </a>
    <a href="https://makeapullrequest.com/">
        <img src="https://img.shields.io/badge/PRs-welcome-blueviolet">
    </a>
</p>

## About

Saturn is a modular multipurpose discord bot built with TypeScript, Node.js and Discord.js

### Other technologies used
- [Axios](https://github.com/axios/axios)
- [Mongoose](https://github.com/Automattic/mongoose)
- [Ytdl](https://github.com/fent/node-ytdl-core)
- [Nodemon](https://github.com/remy/nodemon)
- [Dotenv](https://github.com/motdotla/dotenv)

## How to use

If your only goal is using Saturn, you can invite him to your server by using this [Discord Invite Link](https://github.com/felpshn/saturn-bot) (Temp unavailable). After this, we're already done, have fun!

Saturn is hosted at [Heroku | Cloud Application Platform](https://www.heroku.com/), but you can also host it yourself, for that check out the next topics.

### Getting started

First things first, make sure that you have `git`, `node` and `npm` installed. After checking this out, we can move to the next step.

#### Clone this repo and cd into project's folder

```elm
git clone https://github.com/felpshn/saturn-bot.git

cd saturn-bot
```

#### Creating dotenv file and installing dependencies

```elm
touch .env

npm install
```

After setting up all dependencies, go to `.env` that we just created. 

Now, make sure that you have your own bot token in hands. Copy n' paste the `.env` template below and replace `HELLO_WORLD` with your token.

```bash
BOT_PREFIX=.
BOT_TOKEN=HELLO_WORLD
```

This bot has a weather report function and also supports a MongoDB database linked to it. In case you wanna use these features, you will also need to set in `.env` a OpenWeather API token and your database's connection link.

To get these features working properly, your `.env` file should have this template below with your credentials settled in the `HELLO_WORLD` place.

```bash
BOT_PREFIX=.
BOT_TOKEN=HELLO_WORLD
DB_ACCESS=HELLO_WORLD
OPENWEATHER_TOKEN=HELLO_WORLD
```

Note that, these are extra features! If you don't wanna use them, just follow the first `.env` template introduced and your bot still will work normally.

#### Running
```elm
npm run dev
```

#### We're done!

Thanks for using Saturn! Don't forget to read the **Additional Info** section for more details about this discord bot project.

## Additional Info

PRs are more than welcome, just remind to keep your code concise and clean in case you're planning to add more features to the bot.

> This project is licensed under a [MIT License](https://github.com/felpshn/saturn-bot/blob/master/LICENSE)