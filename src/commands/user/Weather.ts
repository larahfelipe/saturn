import { Message, MessageEmbed } from 'discord.js';
import axios, { AxiosError, AxiosResponse } from 'axios';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';
import { ILocation } from '../../types';

export default class Weather extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}weather`,
      help: 'Get the weather of the location that you want',
      permissionLvl: 0,
    });
  }

  async run(msg: Message, args: string[]) {
    if (!config.openWeatherToken)
      return msg.reply('OpenWeather token not settled.');

    const location = args.join(' ');
    await axios
      .get(
        `https://api.openweathermap.org/data/2.5/weather?q=${location}&units=metric&appid=${config.openWeatherToken}`,
      )
      .then(({ data }: AxiosResponse<ILocation>) => {
        const weatherData = data;
        const formatLocation = `${weatherData.name}, ${weatherData.sys.country} — Weather`;
        const formatWeatherIcon = `http://openweathermap.org/img/wn/${weatherData.weather[0].icon}.png`;
        const weatherDescription =
          weatherData.weather[0].description.toUpperCase();
        const currentTemp = weatherData.main.temp.toFixed(1);
        const tempFeelsLike = weatherData.main.feels_like.toFixed(1);
        const minTemp = weatherData.main.temp_min.toFixed(1);
        const maxTemp = weatherData.main.temp_max.toFixed(1);
        const humidityPercentage = weatherData.main.humidity;
        const windSpeed = weatherData.wind.speed;

        const embed = new MessageEmbed();
        embed
          .setAuthor(formatLocation, formatWeatherIcon)
          .setDescription(`*${weatherDescription}*`)
          .addField(
            'Current Temperature',
            `• ${currentTemp} ºC, Feels like ${tempFeelsLike} ºC`,
          )
          .addField('Min & Max Temperatures', `• ${minTemp} ºC, ${maxTemp} ºC`)
          .addField(
            'Humidity & Wind Speed',
            `• ${humidityPercentage}%, ${windSpeed} km/h`,
          )
          .setTimestamp(Date.now())
          .setFooter(
            'OpenWeather',
            'https://openweathermap.org/themes/openweathermap/assets/img/mobile_app/android_icon.png',
          )
          .setColor('#6E76E5');
        msg.channel.send({ embed });
      })
      .catch((err: AxiosError) => {
        console.error(err);
        msg.reply('Enter a valid city name!');
      });
  }
}
