import { Message, MessageEmbed } from 'discord.js';
import { Bot } from '../..';

import { Commands } from '../../utils/CommandsHandler';

function run (bot: Bot, msg: Message, args: string[]) {
  const modulesLen = Commands.modulesLength;
  let concatHelpStr = '';
  let i = 0;

  bot.commands.forEach(command => {
    if (i === 0) {
      concatHelpStr += '***Admin     ─────────────***\n';
    } else if (i === modulesLen[0]) {
      concatHelpStr += '***Dev     ───────────────***\n';
    } else if (i === modulesLen[0] + modulesLen[1]) {
      concatHelpStr += '***User    ───────────────***\n';
    }
    concatHelpStr += `\`${command.name}\` → ${command.help}.\n`;
    i++;
  });

  const embed = new MessageEmbed();
  embed
    .setAuthor('SATURN Commands Help', bot.user!.avatarURL()!)
    .setDescription(concatHelpStr)
    .setColor('#6E76E5');
  msg.channel.send({ embed });
}

export default {
  name: `${process.env.BOT_PREFIX}help`,
  help: 'Commands help',
  permissionLvl: 0,
  run
};
