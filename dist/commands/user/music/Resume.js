"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function run(bot, msg, args) {
    const queueExists = bot.queues.get(msg.guild.id);
    if (!queueExists || !queueExists.connection)
        return msg.reply('There\'s no song playing in your current channel.');
    await msg.react('👌');
    queueExists.connection.dispatcher.resume();
}
exports.default = {
    name: `${process.env.BOT_PREFIX}resume`,
    help: 'Resumes the current song',
    permissionLvl: 0,
    run
};
