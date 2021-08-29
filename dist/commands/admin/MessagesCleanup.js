"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const MessageHandler_1 = __importDefault(require("../../handlers/MessageHandler"));
class MessagesCleanup extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}clear`,
            help: 'Cleans the messages in the invoked channel',
            requiredRoleLvl: 1,
        });
    }
    async run(msg, _) {
        if (msg.channel.type === 'dm')
            return;
        let fetchMsgs = await MessageHandler_1.default.firstHundredSent(msg);
        msg.channel.bulkDelete(fetchMsgs);
    }
}
exports.default = MessagesCleanup;
