"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
const FetchMessages_1 = require("../../utils/FetchMessages");
async function run(bot, msg, args) {
    if (msg.channel.type === 'dm')
        return;
    let fetchMsgs = await FetchMessages_1.FetchMessages.firstHundredSent(msg);
    msg.channel.bulkDelete(fetchMsgs);
}
exports.default = {
    name: `${config_1.default.botPrefix}clear`,
    help: 'Cleans the messages in the current text channel',
    permissionLvl: 1,
    run
};
