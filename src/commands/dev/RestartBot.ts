import { Message, MessageEmbed } from 'discord.js';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';
import { dropBotQueueConnection } from '../../utils/DropBotQueueConnection';

export default class RestartBot extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}restart`,
      help: 'Restart the bot',
      requiredRoleLvl: 2,
    });
  }

  async run(msg: Message, args: string[]) {
    const embed = new MessageEmbed();

    if (!args) {
      embed
        .setAuthor('SATURN Boot Manager', this.bot.user!.avatarURL()!)
        .setDescription('`EXEC SHUTDOWN --RESTART NOW`\n\nSee you soon.. 👋')
        .setFooter('All services was stopped.')
        .setColor('#6E76E5');
      await msg.channel.send({ embed });
    } else {
      embed
        .setAuthor('SATURN Boot Manager', this.bot.user!.avatarURL()!)
        .setDescription(
          `\`EXEC SHUTDOWN --RESTART --TIME ${args}s\`\n\nSee you soon.. 👋`
        )
        .setFooter('All services was stopped.')
        .setColor('#6E76E5');
      await msg.channel.send({ embed });
    }

    dropBotQueueConnection(this.bot, msg);
    this.bot.destroy();

    setTimeout(async () => {
      await this.bot
        .login(config.botToken)
        .then(() => {
          embed
            .setAuthor('SATURN Boot Manager', this.bot.user!.avatarURL()!)
            .setDescription('`EXEC SYSTEM INIT`\n\nBip Boop... Hello world! 🤗')
            .setFooter('All services are now running.')
            .setColor('#6E76E5');
          msg.channel.send({ embed });
        })
        .catch((err) => console.error(err));
    }, +args * 1000 || 0);
  }
}
