"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const CommandsHandler_1 = require("../../utils/CommandsHandler");
function run(bot, msg, args) {
    const modulesLen = CommandsHandler_1.Commands.modulesLength;
    let concatHelpStr = '';
    let i = 0;
    bot.commands.forEach(command => {
        if (i === 0) {
            concatHelpStr += '***Admin     ─────────────***\n';
        }
        else if (i === modulesLen[0]) {
            concatHelpStr += '***Dev     ───────────────***\n';
        }
        else if (i === modulesLen[0] + modulesLen[1]) {
            concatHelpStr += '***User    ───────────────***\n';
        }
        concatHelpStr += `\`${command.name}\` → ${command.help}.\n`;
        i++;
    });
    const embed = new discord_js_1.MessageEmbed();
    embed
        .setAuthor('SATURN Commands Help', bot.user.avatarURL())
        .setDescription(concatHelpStr)
        .setColor('#6E76E5');
    msg.channel.send({ embed });
}
exports.default = {
    name: `${config_1.default.botPrefix}help`,
    help: 'Commands help',
    permissionLvl: 0,
    run
};
