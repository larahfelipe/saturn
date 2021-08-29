"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
class GetServerInformation extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}server`,
            help: 'Display server information',
            requiredRoleLvl: 1,
        });
    }
    async run(msg, _) {
        const guildCreationDate = new Date(msg.guild.createdTimestamp).toLocaleDateString('en-us');
        const roles = msg
            .guild.roles.cache.filter((role) => role.name !== '@everyone')
            .sort()
            .array();
        const textChannels = msg
            .guild.channels.cache.filter((channel) => channel.type === 'text' || channel.type === 'news')
            .array();
        const voiceChannels = msg
            .guild.channels.cache.filter((channel) => channel.type === 'voice')
            .array();
        const embed = new discord_js_1.MessageEmbed();
        embed
            .setAuthor(`"${msg.guild.name}" Server`, msg.guild.iconURL())
            .addField('Overview', `• Owner: ${msg.guild.owner}\n• Creation Date: ${guildCreationDate}\n• Guild ID: ${msg.guild.id}\n• Guild Region: ${msg.guild.region.toUpperCase()}\n• Verification Lvl Required: ${msg.guild.verificationLevel.toLowerCase()}\n• Explicit Content Filter: ${msg.guild.explicitContentFilter.toLowerCase()}`)
            .addField('Server Stats', `• Total Members: ${msg.guild.memberCount} user(s)\n• Total Roles: ${roles.length}\n• Text Channels: ${textChannels.length}\n• Voice Channels: ${voiceChannels.length}`)
            .addField('Server Boost', `• Nitro Level: ${msg.guild.premiumTier}\n• Total Nitro Subscriptions: ${msg.guild.premiumSubscriptionCount}\n`)
            .setColor('#6E76E5');
        msg.channel.send({ embed });
    }
}
exports.default = GetServerInformation;
