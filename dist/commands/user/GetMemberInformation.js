"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
function run(bot, msg, args) {
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
exports.default = {
    name: '.profile',
    help: 'Shows your profile information',
    permissionLvl: 0,
    run
};
