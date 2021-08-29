"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const CommandHandler_1 = __importDefault(require("../../handlers/CommandHandler"));
class Help extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}help`,
            help: 'Commands help',
            requiredRoleLvl: 0,
        });
    }
    async run(msg, _) {
        const modulesLen = CommandHandler_1.default.modulesLength;
        console.log(modulesLen);
        let concatHelpStr = '';
        let i = 0;
        this.bot.commands.forEach((command) => {
            if (i === 0) {
                concatHelpStr += '***Admin     ─────────────***\n';
            }
            else if (i === modulesLen[0]) {
                concatHelpStr += '***Dev     ───────────────***\n';
            }
            else if (i === modulesLen[0] + modulesLen[1] + 1) {
                concatHelpStr += '***User    ───────────────***\n';
            }
            concatHelpStr += `\`${command.name}\` → ${command.description.help}.\n`;
            i++;
        });
        const embed = new discord_js_1.MessageEmbed();
        embed
            .setAuthor('SATURN Commands Help', this.bot.user.avatarURL())
            .setDescription(concatHelpStr)
            .setColor('#6E76E5');
        msg.channel.send({ embed });
    }
}
exports.default = Help;
