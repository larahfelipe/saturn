"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function run(bot, msg, args) {
    if (msg.channel.type === 'dm')
        return;
    let fetchedMessages = await msg.channel.messages.fetch({ limit: 100 });
    msg.channel.bulkDelete(fetchedMessages);
}
exports.default = {
    name: '.clear',
    help: 'Cleans the messages in the current text channel',
    permissionLvl: 1,
    run
};
