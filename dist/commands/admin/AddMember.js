"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const CreateMemberService_1 = require("../../services/CreateMemberService");
async function run(bot, msg, args) {
    var _a, _b;
    const targetMember = (_a = msg.mentions.members) === null || _a === void 0 ? void 0 : _a.first();
    if (!targetMember)
        return msg.reply('You need to tag someone!');
    const embed = new discord_js_1.MessageEmbed();
    embed
        .setAuthor(`SATURN Database Manager`, (_b = bot.user) === null || _b === void 0 ? void 0 : _b.avatarURL())
        .setDescription(`**» ${targetMember} REGISTRY HAS BEEN CREATED.**\n*Database was updated at ${msg.createdAt}.*`)
        .setTimestamp(Date.now())
        .setFooter('MongoDB', 'https://pbs.twimg.com/profile_images/1234528105819189248/b6F1hk_6_400x400.jpg')
        .setColor('#6E76E5');
    try {
        await CreateMemberService_1.handleMemberCreation(targetMember)
            .then(() => msg.channel.send({ embed }));
    }
    catch (err) {
        console.error(err);
        msg.reply('Member already registered!');
    }
}
exports.default = {
    name: `${config_1.default.botPrefix}add`,
    help: 'Adds a new member to the database',
    permissionLvl: 1,
    run
};
