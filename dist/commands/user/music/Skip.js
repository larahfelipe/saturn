"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../../config"));
const Command_1 = __importDefault(require("../../../structs/Command"));
const ReactionHandler_1 = __importDefault(require("../../../handlers/ReactionHandler"));
const SongHandler_1 = __importDefault(require("../../../handlers/SongHandler"));
class Skip extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}skip`,
            help: 'Skip the current song',
            permissionLvl: 0,
        });
    }
    async run(msg, args) {
        const queueExists = this.bot.queues.get(msg.guild.id);
        if (!queueExists)
            return msg.reply("There's no song currently playing.");
        if (queueExists.songs.length > 1) {
            queueExists.songs.shift();
            queueExists.authors.shift();
            ReactionHandler_1.default.performDeletion(true);
            const embed = new discord_js_1.MessageEmbed();
            embed
                .setTitle('⏭  Skip Music')
                .setDescription('Okay! Setting up the next song for you.')
                .setColor('#6E76E5');
            msg.channel.send({ embed });
            SongHandler_1.default.setSong(this.bot, msg, queueExists.songs[0], queueExists.authors[0]);
        }
    }
}
exports.default = Skip;
