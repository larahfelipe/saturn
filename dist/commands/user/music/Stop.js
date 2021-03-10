"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
function run(bot, msg, args) {
    const queueExists = bot.queues.get(msg.guild.id);
    if (!queueExists)
        return msg.reply('There\'s no song playing in your current channel.');
    const embed = new discord_js_1.MessageEmbed();
    embed
        .setTitle('⏹  Stop Music')
        .setDescription('Understood! Stopping the music function.')
        .setColor('#6E76E5');
    msg.channel.send({ embed });
    queueExists.connection.disconnect();
    bot.queues.delete(msg.guild.id);
}
exports.default = {
    name: '.stop',
    help: 'Stops the music function',
    permissionLvl: 0,
    run
};
