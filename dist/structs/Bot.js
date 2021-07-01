"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../config"));
const Database_1 = __importDefault(require("../utils/Database"));
const CommandHandler_1 = __importDefault(require("../handlers/CommandHandler"));
const AuthenticateMemberService_1 = require("../services/AuthenticateMemberService");
class Bot extends discord_js_1.Client {
    static validateCredentials() {
        if (typeof config_1.default.botToken !== 'string' || typeof config_1.default.botDevToken !== 'string')
            throw new TypeError('Tokens must be of type string.');
        if (!config_1.default.botPrefix)
            throw new Error('Prefix not settled.');
    }
    static handleDatabaseConnection() {
        if (config_1.default.dbAccess) {
            console.log('\n[Saturn] Requesting access to database ...\n');
            Database_1.default.setConnection();
            this.hasDatabaseConnection = Database_1.default.isConnected;
        }
    }
    static async handleLogin(bot) {
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
    static onSetupState() {
        const bot = new Bot();
        bot.commands = new discord_js_1.Collection();
        bot.queues = new Map();
        new CommandHandler_1.default(bot).loadCommands();
        bot.once('ready', () => {
            console.log('[Saturn] Discord API ready.\n');
        });
        this.onReadyState(bot);
        this.handleLogin(bot);
    }
    static onReadyState(bot) {
        bot.on('message', async (msg) => {
            bot.user?.setActivity(`${config_1.default.botPrefix}help`);
            if (!msg.content.startsWith(config_1.default.botPrefix) || msg.author.bot)
                return;
            const args = msg.content.slice(config_1.default.botPrefix.length).trim().split(/ +/);
            const commandListener = config_1.default.botPrefix + args.shift()?.toLowerCase();
            console.log(`[@${msg.author.tag}] >> ${commandListener} ${args.join(' ')}`);
            const embed = new discord_js_1.MessageEmbed();
            const getCommand = bot.commands.get(commandListener);
            try {
                if (this.hasDatabaseConnection) {
                    const getMember = await AuthenticateMemberService_1.handleMemberAuth(msg.member);
                    if (!getMember)
                        return msg.reply('Cannot execute your command because you\'re not registered in database!');
                    if (getMember.roleLvl >= getCommand.permissionLvl) {
                        getCommand.run(msg, args);
                    }
                    else {
                        msg.reply('You don\'t have permission to use this command!');
                    }
                }
                else
                    getCommand.run(msg, args);
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
    static start() {
        this.validateCredentials();
        this.handleDatabaseConnection();
        this.onSetupState();
    }
}
exports.default = Bot;
