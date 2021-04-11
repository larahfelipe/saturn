"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const FetchMessages_1 = require("../../utils/FetchMessages");
async function run(bot, msg, args) {
    if (msg.channel.type === 'dm')
        return;
    let fetchMsgs = await FetchMessages_1.FetchMessages.firstHundredSent(msg);
    msg.channel.bulkDelete(fetchMsgs);
}
exports.default = {
    name: `${process.env.BOT_PREFIX}clear`,
    help: 'Cleans the messages in the current text channel',
    permissionLvl: 1,
    run
};
