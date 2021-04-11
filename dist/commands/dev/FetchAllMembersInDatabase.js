"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const FetchMemberService_1 = require("../../services/FetchMemberService");
async function run(bot, msg, args) {
    try {
        let concatMembersData = '**Role Lvl ─ Member**\n';
        const members = await FetchMemberService_1.handleFetchAllMembers();
        members.forEach(elmt => {
            concatMembersData += `   ${elmt.roleLvl} ─ ${elmt.username}\n`;
        });
        const embed = new discord_js_1.MessageEmbed();
        embed
            .setDescription(concatMembersData)
            .setColor('#6E76E5');
        msg.channel.send({ embed });
    }
    catch (err) {
        console.error(err);
        msg.reply('Cannot retrieve members in database!');
    }
}
exports.default = {
    name: `${process.env.BOT_PREFIX}findall`,
    help: 'List all members in database',
    permissionLvl: 2,
    run
};
