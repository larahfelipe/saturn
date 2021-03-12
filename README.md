<p align="center">
    <a href="https://github.com/felpshn/saturn-bot">
       <img src="https://github.com/felpshn/saturn-bot/blob/master/.github/project-banner.png">
    </a>
</p>

<p align="center">
    <a href="https://github.com/felpshn/saturn-bot/releases">
        <img src="https://img.shields.io/badge/version-2.0-lightgrey">
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
        <img src="https://img.shields.io/badge/license-GPL--3.0-orange">
    </a>
    <a href="https://makeapullrequest.com/">
        <img src="https://img.shields.io/badge/PRs-welcome-blueviolet">
    </a>
</p>

## About

Saturn is a modular multipurpose, user-friendly discord bot, which has a lot of features such as server moderation, music function, weather report and many more, all of that together on the most amazing planet in our solar system!

### Technologies used
- [TypeScript](https://www.typescriptlang.org/)
- [Node.js](https://nodejs.org/en/)
- [Discord.js](https://github.com/discordjs/discord.js)
- [Axios](https://github.com/axios/axios)
- [Mongoose](https://github.com/Automattic/mongoose)
- [Ytdl](https://github.com/fent/node-ytdl-core)
- [Nodemon](https://github.com/remy/nodemon)
- [Dotenv](https://github.com/motdotla/dotenv)

## How to use

Saturn is a *self-hosted* bot, this means you will need to host and maintain your own instance. For that, you can instantiate at your own machine or you can use a cloud platform to do so. A great cloud platform that I personally use and recommend is [Heroku](https://www.heroku.com/), it's a nice cloud service which offers a great compatibility for apps like this one, and also has a free plan option.

In this step-by-step I will only cover about how you can set Saturn in your own machine. Also, note that each topic in the next sections has a brief description in the title explaining what we're about to do. With that been said, let's move on.

### Getting started

First things first, make sure that you have `git`, `node` and `npm` installed. Then open your terminal or cmd and type the commands below.

#### Cloning this repository & cd'ing into project's folder

```elm
git clone https://github.com/felpshn/saturn-bot.git

cd saturn-bot
```

#### Creating and setting the environment file & installing dependencies

```elm
touch .env

npm install
```

After setting up all dependencies, find the `.env` file that we just created and open it with some text editor of your choice.

Now, make sure that you have your own bot token in hands — in case you don't know how to get it, just go at the [Discord developers portal](https://discord.com/developers/) and create a new app. Copy and paste the `.env` template below and replace `HELLO_WORLD` with your token.

```bash
BOT_PREFIX=.
BOT_TOKEN=HELLO_WORLD
```

As mentioned before, this bot has a weather report function and also supports a MongoDB database linked to it. In case you wanna use these features, you will also need to set in `.env` an OpenWeather API token and your database's connection link.

To get these features working properly, your `.env` file should have this template below with your credentials settled in the `HELLO_WORLD`'s place.

```bash
BOT_PREFIX=.
BOT_TOKEN=HELLO_WORLD
DB_ACCESS=HELLO_WORLD
OPENWEATHER_TOKEN=HELLO_WORLD
```

Note that, these are **extra** features! If you don't wanna use them, just follow the first `.env` template introduced in this step-by-step and your bot still will work normally.

#### Running
```elm
npm run dev
```

#### We're done!

That's pretty much it, thanks for using Saturn and have fun! Also, don't forget to read the **Additional Info** section for more details about this discord bot project.

## Additional Info

PRs are more than welcome, just remind to keep your code concise and clean in case you're planning to add more features to the bot.

> **This project is licensed under a [GNU General Public License v3.0 License](https://github.com/felpshn/saturn-bot/blob/master/LICENSE)**