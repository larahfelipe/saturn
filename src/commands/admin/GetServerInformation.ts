import { Message, MessageEmbed } from 'discord.js';

import config from '../../config';
import { Bot } from '../..';

async function run (bot: Bot, msg: Message, args: string[]) {
  const guildCreationDate = new Date(msg.guild!.createdTimestamp).toLocaleDateString('en-us');
  const roles = msg.guild!.roles.cache.filter(role => role.name !== '@everyone').sort().array();
  const textChannels = msg.guild!.channels.cache.filter(channel => channel.type === 'text' || channel.type === 'news').array();
  const voiceChannels = msg.guild!.channels.cache.filter(channel => channel.type === 'voice').array();

  const embed = new MessageEmbed();
  embed
    .setAuthor(`"${msg.guild!.name}" Server`, msg.guild!.iconURL()!)
    .addField('Overview', `• Owner: ${msg.guild!.owner}\n• Creation Date: ${guildCreationDate}\n• Guild ID: ${msg.guild!.id}\n• Guild Region: ${(msg.guild!.region).toUpperCase()}\n• Verification Lvl Required: ${(msg.guild!.verificationLevel).toLowerCase()}\n• Explicit Content Filter: ${(msg.guild!.explicitContentFilter).toLowerCase()}`)
    .addField('Server Stats', `• Total Members: ${msg.guild!.memberCount} user(s)\n• Total Roles: ${roles.length}\n• Text Channels: ${textChannels.length}\n• Voice Channels: ${voiceChannels.length}`)
    .addField('Server Boost', `• Nitro Level: ${msg.guild!.premiumTier}\n• Total Nitro Subscriptions: ${msg.guild!.premiumSubscriptionCount}\n`)
    .setColor('#6E76E5');
  msg.channel.send({ embed });
}

export default {
  name: `${config.botPrefix}server`,
  help: 'Displays server information',
  permissionLvl: 1,
  run
};
