"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
async function run(bot, msg, args) {
    await msg.guild.leave();
}
exports.default = {
    name: `${process.env.BOT_PREFIX}leave`,
    help: 'Leaves the server',
    permissionLvl: 2,
    run
};
