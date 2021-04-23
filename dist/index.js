"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bot = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const DatabaseConnection_1 = require("./utils/DatabaseConnection");
const AuthenticateMemberService_1 = require("./services/AuthenticateMemberService");
const discord_js_1 = __importDefault(require("discord.js"));
const CommandsHandler_1 = require("./utils/CommandsHandler");
dotenv_1.default.config();
const prefix = process.env.BOT_PREFIX;
if (!prefix || !process.env.BOT_TOKEN)
    throw new Error('Prefix and/or token not settled.');
let hasDBConnection = false;
if (process.env.DB_ACCESS) {
    console.log('\n[Saturn] Requesting access to database ...\n');
    DatabaseConnection_1.Database.setConnection();
    hasDBConnection = DatabaseConnection_1.Database.isConnected;
}
class Bot extends discord_js_1.default.Client {
}
exports.Bot = Bot;
const bot = new Bot();
bot.commands = new discord_js_1.default.Collection();
const embed = new discord_js_1.default.MessageEmbed();
bot.queues = new Map();
CommandsHandler_1.Commands.loadAndSet(bot);
bot.once('ready', () => {
    console.log('[Saturn] Discord API ready.\n');
});
bot.on('message', async (msg) => {
    var _a, _b;
    (_a = bot.user) === null || _a === void 0 ? void 0 : _a.setActivity(`${prefix}help`);
    if (!msg.content.startsWith(prefix) || msg.author.bot)
        return;
    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const commandListener = prefix + ((_b = args.shift()) === null || _b === void 0 ? void 0 : _b.toLowerCase());
    console.log(`[@${msg.author.tag}] >> ${commandListener} ${args.join(' ')}`);
    const getCommand = bot.commands.get(commandListener);
    try {
        if (hasDBConnection) {
            const getMember = await AuthenticateMemberService_1.handleMemberAuth(msg.member);
            if (!getMember)
                return msg.reply('Cannot execute your command because you\'re not registered in database!');
            if (getMember.roleLvl >= getCommand.permissionLvl) {
                getCommand.run(bot, msg, args);
            }
            else {
                msg.reply('You don\'t have permission to use this command!');
            }
        }
        else
            getCommand.run(bot, msg, args);
    }
    catch (err) {
        console.error(err);
        embed
            .setAuthor('❌ Whoops, a wild error appeared!')
            .setDescription(`**Why I\'m seeing this?!** 🤔\n\nYou probably have a typo in your command\'s message or you currently don\'t have permission to execute this command.\n\nYou can get a full commands list by typing **\`${prefix}help\`**`)
            .setColor('#6E76E5');
        msg.channel.send({ embed });
    }
});
if (process.env.NODE_ENV !== 'development') {
    bot.login(process.env.BOT_TOKEN);
}
else
    bot.login(process.env.BOT_DEVTOKEN);
