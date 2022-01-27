import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import { AppMainColor } from '@/constants';
import { CommandHandler } from '@/handlers';
import { Command, Bot } from '@/structs';

export default class Help extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}help`,
      help: 'Commands help',
      requiredRoleLvl: 0
    });
  }

  async run(msg: Message) {
    const modulesLen = CommandHandler.modulesLength;
    let concatHelpStr = '';
    let i = 0;

    this.bot.commands.forEach((command: Command) => {
      if (i === 0) {
        concatHelpStr += '***Admin     ─────────────***\n';
      } else if (i === modulesLen[0] + 1) {
        concatHelpStr += '***Dev     ───────────────***\n';
      } else if (i === modulesLen[0] + modulesLen[1] + 2) {
        concatHelpStr += '***User    ───────────────***\n';
      }
      concatHelpStr += `\`${command.name}\` → ${command.description.help}.\n`;
      i++;
    });

    const embed = new MessageEmbed();
    embed
      .setAuthor('Saturn Commands Help', this.bot.user!.avatarURL()!)
      .setDescription(concatHelpStr)
      .setColor(AppMainColor);
    msg.channel.send({ embed });
  }
}
