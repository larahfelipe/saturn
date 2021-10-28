import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import CommandHandler from '@/handlers/CommandHandler';
import Bot from '@/structs/Bot';
import Command from '@/structs/Command';

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
      } else if (i === modulesLen[0]) {
        concatHelpStr += '***Dev     ───────────────***\n';
      } else if (i === modulesLen[0] + modulesLen[1] + 1) {
        concatHelpStr += '***User    ───────────────***\n';
      }
      concatHelpStr += `\`${command.name}\` → ${command.description.help}.\n`;
      i++;
    });

    const embed = new MessageEmbed();
    embed
      .setAuthor('Saturn Commands Help', this.bot.user!.avatarURL()!)
      .setDescription(concatHelpStr)
      .setColor(config.mainColor);
    msg.channel.send({ embed });
  }
}
