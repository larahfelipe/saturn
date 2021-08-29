"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../config"));
const Database_1 = __importDefault(require("../utils/Database"));
const CommandHandler_1 = __importDefault(require("../handlers/CommandHandler"));
const AuthenticateGuildMemberService_1 = require("../services/AuthenticateGuildMemberService");
class Bot extends discord_js_1.Client {
    static validateRequiredCredentials() {
        if (typeof config_1.default.botToken !== 'string')
            throw new TypeError('Tokens must be of type string.');
        if (!config_1.default.botPrefix)
            throw new Error('Prefix not settled.');
    }
    static async handleDatabaseConnection() {
        if (config_1.default.dbAccess) {
            try {
                Database_1.default.setConnection();
            }
            catch (err) {
                throw new Error(err);
            }
            finally {
                this.hasDatabaseConnection = Database_1.default.isConnected;
            }
        }
    }
    static async handleClientLogin(bot) {
        try {
            if (process.env.NODE_ENV !== 'development') {
                await bot.login(config_1.default.botToken);
            }
            else {
                await bot.login(config_1.default.botDevToken);
            }
        }
        catch (err) {
            console.error(err);
        }
    }
    static onInteractionReady(bot) {
        bot.on('message', async (msg) => {
            bot.user?.setActivity(`${config_1.default.botPrefix}help`);
            if (!msg.content.startsWith(config_1.default.botPrefix) || msg.author.bot)
                return;
            const embed = new discord_js_1.MessageEmbed();
            const args = msg.content
                .slice(config_1.default.botPrefix.length)
                .trim()
                .split(/ +/);
            const commandListener = config_1.default.botPrefix + args.shift()?.toLowerCase();
            const getCommand = bot.commands.get(commandListener);
            console.log(`[@${msg.author.tag}] > ${commandListener} ${args.join(' ')}`);
            try {
                if (this.hasDatabaseConnection) {
                    const getMember = await AuthenticateGuildMemberService_1.handleGuildMemberAuth(msg.member);
                    if (!getMember) {
                        msg.reply("Cannot execute your command because you're not registered in database.");
                    }
                    else if (getMember.userRoleLvl >= getCommand.description.requiredRoleLvl) {
                        getCommand.run(msg, args);
                    }
                    else {
                        msg.reply("You don't have permission to use this command.");
                    }
                }
                else {
                    getCommand.run(msg, args);
                }
            }
            catch (err) {
                console.error(err);
                embed
                    .setAuthor('❌ Whoops, a wild error appeared!')
                    .setDescription(`**Why I\'m seeing this?!** 🤔\n\nYou probably have a typo in your command\'s message or you currently don\'t have permission to execute this command.\n\nYou can get a full commands list by typing **\`${config_1.default.botPrefix}help\`**`)
                    .setColor('#6E76E5');
                msg.channel.send({ embed });
            }
        });
    }
    static onInteractionInit() {
        const bot = new Bot();
        bot.commands = new discord_js_1.Collection();
        bot.queues = new Map();
        new CommandHandler_1.default(bot).loadCommands();
        bot.once('ready', () => {
            console.log('[Saturn] Discord API ready.\n');
        });
        this.onInteractionReady(bot);
        this.handleClientLogin(bot);
    }
    static start() {
        try {
            this.validateRequiredCredentials();
            this.handleDatabaseConnection();
            this.onInteractionInit();
        }
        catch (err) {
            console.error(err);
        }
    }
}
exports.default = Bot;
