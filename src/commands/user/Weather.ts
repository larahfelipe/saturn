import axios, { AxiosResponse } from 'axios';
import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { OpenWeatherIconUrl, OpenWeatherColor } from '@/constants';
import { Command, Bot } from '@/structs';
import { Location } from '@/types';

export default class Weather extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}weather`,
      help: "Get some location's weather",
      requiredRoleLvl: 0
    });
  }

  async run(msg: Message, args: string[]) {
    if (!config.openWeatherToken)
      return msg.reply('OpenWeather token not settled.');

    const location = args.join(' ');
    try {
      const { data }: AxiosResponse<Location> = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?q=${location}&units=metric&appid=${config.openWeatherToken}`
      );
      const formatLocation = `${data.name}, ${data.sys.country} — Weather`;
      const formatWeatherIcon = `http://openweathermap.org/img/wn/${data.weather[0].icon}.png`;
      const weatherDescription = data.weather[0].description.toUpperCase();
      const currentTemp = data.main.temp.toFixed(1);
      const tempFeelsLike = data.main.feels_like.toFixed(1);
      const minTemp = data.main.temp_min.toFixed(1);
      const maxTemp = data.main.temp_max.toFixed(1);
      const humidityPercentage = data.main.humidity;
      const windSpeed = data.wind.speed;

      const embed = new MessageEmbed();
      embed
        .setAuthor(formatLocation, formatWeatherIcon)
        .setDescription(`*${weatherDescription}*`)
        .addField(
          'Current Temperature',
          `• ${currentTemp} ºC, Feels like ${tempFeelsLike} ºC`
        )
        .addField('Min & Max Temperatures', `• ${minTemp} ºC, ${maxTemp} ºC`)
        .addField(
          'Humidity & Wind Speed',
          `• ${humidityPercentage}%, ${windSpeed} km/h`
        )
        .setTimestamp(Date.now())
        .setFooter('OpenWeather', OpenWeatherIconUrl)
        .setColor(OpenWeatherColor);
      msg.channel.send({ embed });
    } catch (err) {
      this.bot.logger.emitErrorReport(err);
      msg.reply('Enter a valid city name.');
    }
  }
}
