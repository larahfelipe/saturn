"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../../config"));
async function run(bot, msg, args) {
    const queueExists = bot.queues.get(msg.guild.id);
    if (!queueExists || !queueExists.connection)
        return msg.reply('There\'s no song playing in your current channel.');
    await msg.react('👌');
    queueExists.connection.dispatcher.resume();
}
exports.default = {
    name: `${config_1.default.botPrefix}resume`,
    help: 'Resumes the current song',
    permissionLvl: 0,
    run
};
