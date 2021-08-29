import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import Command from '@/structs/Command';
import Bot from '@/structs/Bot';

export default class RestartBot extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}restart`,
      help: 'Restart the bot',
      requiredRoleLvl: 2
    });
  }

  async run(msg: Message, args: string[]) {
    const embed = new MessageEmbed();

    if (args.length === 0) {
      embed
        .setAuthor('Saturn Boot Manager', this.bot.user!.avatarURL()!)
        .setDescription('`exec shutdown --restart now`\n\nSee you soon.. 👋')
        .setTimestamp(Date.now())
        .setFooter('All services was stopped.')
        .setColor(config.warningColor);
      await msg.channel.send({ embed });
    } else {
      embed
        .setAuthor('Saturn Boot Manager', this.bot.user!.avatarURL()!)
        .setDescription(
          `\`exec shutdown --restart --time ${args}s\`\n\nSee you soon.. 👋`
        )
        .setTimestamp(Date.now())
        .setFooter('All services was stopped.')
        .setColor(config.warningColor);
      await msg.channel.send({ embed });
    }

    this.bot.queues.clear();
    this.bot.destroy();

    setTimeout(async () => {
      await this.bot
        .login(config.botToken)
        .then(() => {
          embed
            .setAuthor('Saturn Boot Manager', this.bot.user!.avatarURL()!)
            .setDescription('`exec sys --init`\n\nBip Boop... Hello world! 🤗')
            .setTimestamp(Date.now())
            .setFooter('All services are now running.')
            .setColor(config.mainColor);
          msg.channel.send({ embed });
        })
        .catch((err) => console.error(err));
    }, +args * 1000 || 0);
  }
}
