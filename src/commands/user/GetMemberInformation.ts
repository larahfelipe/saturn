import { Message, MessageEmbed } from 'discord.js';

import config from '../../config';
import Command from '../../structs/Command';
import Bot from '../../structs/Bot';

export default class GetMemberInformation extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}profile`,
      help: 'Show your discord profile info',
      permissionLvl: 0,
    });
  }

  async run(msg: Message, args: string[]) {
    const userRegistrationDate = new Date(
      msg.member!.user.createdTimestamp!,
    ).toLocaleDateString('en-us');
    const userJoinedServerDate = new Date(
      msg.member!.joinedTimestamp!,
    ).toLocaleDateString('en-us');

    const embed = new MessageEmbed();
    embed
      .setAuthor('Your Profile', msg.author.displayAvatarURL())
      .addField('Member Name', `${msg.member} (${msg.member!.user.tag})`)
      .addField('Discord ID', msg.member!.id)
      .addField('Registration Date', userRegistrationDate)
      .addField(`Joined "${msg.guild!.name}" at`, userJoinedServerDate)
      .setColor('#6E76E5');
    msg.channel.send({ embed });
  }
}
