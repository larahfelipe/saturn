import { Message, MessageEmbed, version as discordVersion } from 'discord.js';
import { type, arch, uptime } from 'os';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';
import { formatSecondsToTime } from '../../utils/FormatSecondsToTime';

export default class GetBotInformation extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}bot`,
      help: 'Display bot properties',
      permissionLvl: 0,
    });
  }

  async run(msg: Message, args: string[]) {
    const hostInformation = `${type} (${arch})`;
    const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

    const embed = new MessageEmbed();
    embed
      .setAuthor(`SATURN Properties`, this.bot.user?.avatarURL()!)
      .setDescription(
        `• Saturn © Discord Bot — version 3.x\n• Created and maintained by [Felipe Lara](https://github.com/felpshn) — Licensed under a GNU GPL v3.0`,
      )
      .addField(
        'Bot Status',
        `• Currently **ONLINE** and listening commands on **"${
          msg.guild!.name
        }"** server`,
      )
      .addField(
        'Host Status',
        `• OS: ${hostInformation}\n• Uptime: ${formatSecondsToTime(
          uptime(),
        )}\n• Memory Usage: ${memoryUsage.toFixed(2)} MB (${(
          (memoryUsage * 100) /
          512
        ).toFixed(2)}%)\n• Discord API Latency: ${this.bot.ws.ping} ms`,
      )
      .addField(
        'Source',
        '• [GitHub | Where the world builds software](https://github.com/felpshn/saturn-bot)',
      )
      .setTimestamp(Date.now())
      .setFooter(
        `Discord Inc. — version ${discordVersion}`,
        'https://discord.com/assets/2c21aeda16de354ba5334551a883b481.png',
      )
      .setColor('#6E76E5');
    msg.channel.send({ embed });
  }
}
