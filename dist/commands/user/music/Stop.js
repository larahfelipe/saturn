"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const ReactionsHandler_1 = require("../../../utils/ReactionsHandler");
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
    ReactionsHandler_1.Reaction.handleDeletion(true);
}
exports.default = {
    name: `${process.env.BOT_PREFIX}stop`,
    help: 'Stops the music function',
    permissionLvl: 0,
    run
};
