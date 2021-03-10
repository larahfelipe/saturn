import { Message, MessageEmbed, version as discordVersion } from 'discord.js';
import { Bot } from '../..';

import { type, arch, uptime } from 'os';

import { formatSecondsToTime } from '../../utils/FormatSecondsToTime';

function run (bot: Bot, msg: Message, args: string[]) {
  const hostInformation = `${type} (${arch})`;
  const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

  const embed = new MessageEmbed();
  embed
    .setAuthor('SATURN Properties', bot.user?.avatarURL()!)
    .setDescription(`• Saturn © Discord Bot — version 2.0\n• Created and maintained by <@260866537798369299>`)
    .addField('Bot Status', `• Currently **ONLINE** and listening commands on **"${msg.guild!.name}"** server`)
    .addField('Host Status', `• OS: ${hostInformation}\n• Uptime: ${formatSecondsToTime(uptime())}\n• Memory Usage: ${memoryUsage.toFixed(2)} MB (${(memoryUsage * 100 / 512).toFixed(2)}%)\n• Discord API Latency: ${bot.ws.ping} ms`)
    .addField('Source', '• [GitHub | Where the world builds software](https://github.com/felpshn/saturn-bot)')
    .setTimestamp(new Date())
    .setFooter(`Discord Inc. — version ${discordVersion}`, 'https://discord.com/assets/2c21aeda16de354ba5334551a883b481.png')
    .setColor('#6E76E5');
  msg.channel.send({ embed });
}

export default {
  name: '.saturn',
  help: 'Displays bot properties',
  permissionLvl: 0,
  run
};
