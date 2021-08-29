"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
class Weather extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}weather`,
            help: 'Get the weather of the location that you want',
            requiredRoleLvl: 0,
        });
    }
    async run(msg, args) {
        if (!config_1.default.openWeatherToken)
            return msg.reply('OpenWeather token not settled.');
        const location = args.join(' ');
        await axios_1.default
            .get(`https://api.openweathermap.org/data/2.5/weather?q=${location}&units=metric&appid=${config_1.default.openWeatherToken}`)
            .then(({ data }) => {
            const weatherData = data;
            const formatLocation = `${weatherData.name}, ${weatherData.sys.country} — Weather`;
            const formatWeatherIcon = `http://openweathermap.org/img/wn/${weatherData.weather[0].icon}.png`;
            const weatherDescription = weatherData.weather[0].description.toUpperCase();
            const currentTemp = weatherData.main.temp.toFixed(1);
            const tempFeelsLike = weatherData.main.feels_like.toFixed(1);
            const minTemp = weatherData.main.temp_min.toFixed(1);
            const maxTemp = weatherData.main.temp_max.toFixed(1);
            const humidityPercentage = weatherData.main.humidity;
            const windSpeed = weatherData.wind.speed;
            const embed = new discord_js_1.MessageEmbed();
            embed
                .setAuthor(formatLocation, formatWeatherIcon)
                .setDescription(`*${weatherDescription}*`)
                .addField('Current Temperature', `• ${currentTemp} ºC, Feels like ${tempFeelsLike} ºC`)
                .addField('Min & Max Temperatures', `• ${minTemp} ºC, ${maxTemp} ºC`)
                .addField('Humidity & Wind Speed', `• ${humidityPercentage}%, ${windSpeed} km/h`)
                .setTimestamp(Date.now())
                .setFooter('OpenWeather', 'https://openweathermap.org/themes/openweathermap/assets/img/mobile_app/android_icon.png')
                .setColor('#6E76E5');
            msg.channel.send({ embed });
        })
            .catch((err) => {
            console.error(err);
            msg.reply('Enter a valid city name!');
        });
    }
}
exports.default = Weather;
