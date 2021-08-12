"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dropBotQueueConnection = void 0;
async function dropBotQueueConnection(bot, msg) {
    if (!bot.queues)
        return console.log("There's no queues established on the server.");
    bot.queues.forEach((queue) => {
        queue.connection.disconnect();
    });
    bot.queues.delete(msg.member.guild.id);
}
exports.dropBotQueueConnection = dropBotQueueConnection;
