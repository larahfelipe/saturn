import { Message, MessageEmbed } from 'discord.js';
import { Bot } from '../..';

import { dropBotQueueConnection } from '../../utils/DropBotQueueConnection';

async function run (bot: Bot, msg: Message, args: number) {
  const embed = new MessageEmbed();
  
  if (!args) {
    embed
      .setAuthor('SATURN Boot Manager', bot.user!.avatarURL()!)
      .setDescription('\`EXEC SHUTDOWN --RESTART NOW\`\n\nSee you soon.. 👋')
      .setFooter('All services was stopped.')
      .setColor('#6E76E5');
    await msg.channel.send({ embed });
  } else {
    embed
      .setAuthor('SATURN Boot Manager', bot.user!.avatarURL()!)
      .setDescription(`\`EXEC SHUTDOWN --RESTART --TIME ${args}s\`\n\nSee you soon.. 👋`)
      .setFooter('All services was stopped.')
      .setColor('#6E76E5');
    await msg.channel.send({ embed });
  }

  dropBotQueueConnection(bot, msg);
  bot.destroy();

  setTimeout(async () => {
    await bot.login(process.env.BOT_TOKEN)
      .then(() => {
        embed
          .setAuthor('SATURN Boot Manager', bot.user!.avatarURL()!)
          .setDescription('\`EXEC SYSTEM INIT\`\n\nBip Boop... Hello world! 🤗')
          .setFooter('All services are now running.')
          .setColor('#6E76E5');
        msg.channel.send({ embed });
      })
      .catch(err => { throw new Error(err) });
  }, args * 1000 || 0);
}

export default {
  name: `${process.env.BOT_PREFIX}restart`,
  help: 'Restarts the bot',
  permissionLvl: 2,
  run
};
