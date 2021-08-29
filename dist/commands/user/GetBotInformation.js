"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const os_1 = require("os");
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const FormatSecondsToTime_1 = require("../../utils/FormatSecondsToTime");
class GetBotInformation extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}bot`,
            help: 'Display bot properties',
            requiredRoleLvl: 0,
        });
    }
    async run(msg, _) {
        const hostInformation = `${os_1.type} (${os_1.arch})`;
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        const embed = new discord_js_1.MessageEmbed();
        embed
            .setAuthor(`SATURN Properties`, this.bot.user?.avatarURL())
            .setDescription(`• Saturn © Discord Bot — version 3.x\n• Created and maintained by [Felipe Lara](https://github.com/felpshn) — Licensed under a GNU GPL v3.0`)
            .addField('Bot Status', `• Currently **ONLINE** and listening commands on **"${msg.guild.name}"** server`)
            .addField('Host Status', `• OS: ${hostInformation}\n• Uptime: ${FormatSecondsToTime_1.formatSecondsToTime(os_1.uptime())}\n• Memory Usage: ${memoryUsage.toFixed(2)} MB (${((memoryUsage * 100) /
            512).toFixed(2)}%)\n• Discord API Latency: ${this.bot.ws.ping} ms`)
            .addField('Source', '• [GitHub | Where the world builds software](https://github.com/felpshn/saturn-bot)')
            .setTimestamp(Date.now())
            .setFooter(`Discord Inc. — version ${discord_js_1.version}`, 'https://discord.com/assets/2c21aeda16de354ba5334551a883b481.png')
            .setColor('#6E76E5');
        msg.channel.send({ embed });
    }
}
exports.default = GetBotInformation;
