import { Message, MessageEmbed } from 'discord.js';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';
import CommandHandler from '../../handlers/CommandHandler';

export default class Help extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}help`,
      help: 'Commands help',
      requiredRoleLvl: 0,
    });
  }

  async run(msg: Message, _: string[]) {
    const modulesLen = CommandHandler.modulesLength;
    console.log(modulesLen);
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
      .setAuthor('SATURN Commands Help', this.bot.user!.avatarURL()!)
      .setDescription(concatHelpStr)
      .setColor('#6E76E5');
    msg.channel.send({ embed });
  }
}
