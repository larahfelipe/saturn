"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
function run(bot, msg, args) {
    const queueExists = bot.queues.get(msg.guild.id);
    if (!queueExists) {
        const embed = new discord_js_1.MessageEmbed();
        embed
            .setAuthor('❌ No queue established on the server!')
            .setDescription(`If you want to play a song type \`${process.env.BOT_PREFIX}play\` and the name/link of the song in front of it to get the party started! 🥳`)
            .setColor('#6E76E5');
        return msg.channel.send({ embed });
    }
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
    name: `${process.env.BOT_PREFIX}queue`,
    help: 'Shows the server\'s music queue',
    permissionLvl: 0,
    run
};
