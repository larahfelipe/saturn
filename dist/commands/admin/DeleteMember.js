"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const DeleteMemberService_1 = require("../../services/DeleteMemberService");
class DeleteMember extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}del`,
            help: 'Delete a member from database',
            permissionLvl: 1
        });
    }
    async run(msg, args) {
        const targetMember = msg.mentions.members?.first();
        if (!targetMember)
            return msg.reply('You need to tag someone!');
        const embed = new discord_js_1.MessageEmbed();
        embed
            .setAuthor(`SATURN Database Manager`, this.bot.user?.avatarURL())
            .setDescription(`**» ${targetMember} REGISTRY HAS BEEN DELETED.**\n*Database was updated at ${msg.createdAt}.*`)
            .setTimestamp(Date.now())
            .setFooter('MongoDB', 'https://pbs.twimg.com/profile_images/1234528105819189248/b6F1hk_6_400x400.jpg')
            .setColor('#6E76E5');
        await DeleteMemberService_1.handleMemberDeletion(msg.author, targetMember)
            .then(() => msg.channel.send({ embed }))
            .catch(err => {
            console.error(err);
            msg.reply('Member was not found in database.');
        });
    }
}
exports.default = DeleteMember;
