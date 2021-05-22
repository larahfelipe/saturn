import { Message, MessageEmbed } from 'discord.js';

import config from '../../config';
import { Bot } from '../..';

function run (bot: Bot, msg: Message, args: string[]) {
  const userRegistrationDate = new Date(msg.member!.user.createdTimestamp!).toLocaleDateString('en-us');
  const userJoinedServerDate = new Date(msg.member!.joinedTimestamp!).toLocaleDateString('en-us');

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

export default {
  name: `${config.botPrefix}profile`,
  help: 'Shows your profile information',
  permissionLvl: 0,
  run
};
