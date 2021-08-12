"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
class GetMemberInformation extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}profile`,
            help: 'Show your discord profile info',
            permissionLvl: 0,
        });
    }
    async run(msg, args) {
        const userRegistrationDate = new Date(msg.member.user.createdTimestamp).toLocaleDateString('en-us');
        const userJoinedServerDate = new Date(msg.member.joinedTimestamp).toLocaleDateString('en-us');
        const embed = new discord_js_1.MessageEmbed();
        embed
            .setAuthor('Your Profile', msg.author.displayAvatarURL())
            .addField('Member Name', `${msg.member} (${msg.member.user.tag})`)
            .addField('Discord ID', msg.member.id)
            .addField('Registration Date', userRegistrationDate)
            .addField(`Joined "${msg.guild.name}" at`, userJoinedServerDate)
            .setColor('#6E76E5');
        msg.channel.send({ embed });
    }
}
exports.default = GetMemberInformation;
