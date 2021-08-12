"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../../config"));
const Command_1 = __importDefault(require("../../../structs/Command"));
const ReactionHandler_1 = __importDefault(require("../../../handlers/ReactionHandler"));
class Stop extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}stop`,
            help: 'Stop the music function',
            permissionLvl: 0,
        });
    }
    async run(msg, args) {
        const queueExists = this.bot.queues.get(msg.guild.id);
        if (!queueExists)
            return msg.reply("There's no song playing in your current channel.");
        const embed = new discord_js_1.MessageEmbed();
        embed
            .setTitle('⏹  Stop Music')
            .setDescription('Understood! Stopping the music function.')
            .setColor('#6E76E5');
        msg.channel.send({ embed });
        queueExists.connection.disconnect();
        this.bot.queues.delete(msg.guild.id);
        ReactionHandler_1.default.performDeletion(true);
    }
}
exports.default = Stop;
