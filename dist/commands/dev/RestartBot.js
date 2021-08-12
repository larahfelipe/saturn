"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const DropBotQueueConnection_1 = require("../../utils/DropBotQueueConnection");
class RestartBot extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}restart`,
            help: 'Restart the bot',
            permissionLvl: 2,
        });
    }
    async run(msg, args) {
        const embed = new discord_js_1.MessageEmbed();
        if (!args) {
            embed
                .setAuthor('SATURN Boot Manager', this.bot.user.avatarURL())
                .setDescription('`EXEC SHUTDOWN --RESTART NOW`\n\nSee you soon.. 👋')
                .setFooter('All services was stopped.')
                .setColor('#6E76E5');
            await msg.channel.send({ embed });
        }
        else {
            embed
                .setAuthor('SATURN Boot Manager', this.bot.user.avatarURL())
                .setDescription(`\`EXEC SHUTDOWN --RESTART --TIME ${args}s\`\n\nSee you soon.. 👋`)
                .setFooter('All services was stopped.')
                .setColor('#6E76E5');
            await msg.channel.send({ embed });
        }
        DropBotQueueConnection_1.dropBotQueueConnection(this.bot, msg);
        this.bot.destroy();
        setTimeout(async () => {
            await this.bot
                .login(config_1.default.botToken)
                .then(() => {
                embed
                    .setAuthor('SATURN Boot Manager', this.bot.user.avatarURL())
                    .setDescription('`EXEC SYSTEM INIT`\n\nBip Boop... Hello world! 🤗')
                    .setFooter('All services are now running.')
                    .setColor('#6E76E5');
                msg.channel.send({ embed });
            })
                .catch((err) => console.error(err));
        }, +args * 1000 || 0);
    }
}
exports.default = RestartBot;
