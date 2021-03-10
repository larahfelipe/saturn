"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
function run(bot, msg, args) {
    const queueExists = bot.queues.get(msg.guild.id);
    let concatQueueStr = '';
    if (queueExists.songs.length === 1) {
        concatQueueStr = 'Hmm.. Seems like the queue is empty 🤔\nTry add a song!';
    }
    else {
        queueExists.songs.forEach(song => {
            if (queueExists.songs.indexOf(song) === 0)
                return;
            concatQueueStr += `**${queueExists.songs.indexOf(song)}** — ${song.title} \`[${song.timestamp}]\`\n`;
        });
    }
    const embed = new discord_js_1.MessageEmbed();
    embed
        .setTitle('📃  Music Queue')
        .addField('Currently Listening', `${queueExists.songs[0].title}`, true)
        .addField('Duration', `${queueExists.songs[0].timestamp}`, true)
        .addField('Coming Next', concatQueueStr)
        .setColor('#6E76E5');
    msg.channel.send({ embed });
}
exports.default = {
    name: '.queue',
    help: 'Shows the server\'s music queue',
    permissionLvl: 0,
    run
};
