"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../../config"));
const Command_1 = __importDefault(require("../../../structs/Command"));
class Resume extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}resume`,
            help: 'Resume the current song',
            permissionLvl: 0
        });
    }
    async run(msg, args) {
        const queueExists = this.bot.queues.get(msg.guild.id);
        if (!queueExists || !queueExists.connection)
            return msg.reply('There\'s no song playing in your current channel.');
        await msg.react('👌');
        queueExists.connection.dispatcher.resume();
    }
}
exports.default = Resume;
