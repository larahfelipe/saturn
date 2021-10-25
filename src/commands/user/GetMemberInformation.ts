import { Message, MessageEmbed } from 'discord.js';

import config from '@/config';
import Bot from '@/structs/Bot';
import Command from '@/structs/Command';

export default class GetMemberInformation extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}profile`,
      help: 'Show your discord profile info',
      requiredRoleLvl: 0
    });
  }

  async run(msg: Message) {
    const userRegistrationDate = new Date(
      msg.member!.user.createdTimestamp!
    ).toLocaleDateString('en-us');
    const userJoinedServerDate = new Date(
      msg.member!.joinedTimestamp!
    ).toLocaleDateString('en-us');

    const embed = new MessageEmbed();
    embed
      .setAuthor('Your Profile', msg.author.displayAvatarURL())
      .addField('Member Name', `${msg.member} (${msg.member!.user.tag})`)
      .addField('Discord ID', msg.member!.id)
      .addField('Registration Date', userRegistrationDate)
      .addField(`Joined "${msg.guild!.name}" at`, userJoinedServerDate)
      .setColor(config.mainColor);
    msg.channel.send({ embed });
  }
}
