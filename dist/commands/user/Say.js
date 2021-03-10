"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function run(bot, msg, args) {
    const concatArgs = args.join(' ');
    const messageCapitalized = concatArgs[0].toUpperCase() + concatArgs.slice(1);
    msg.channel.send(messageCapitalized);
}
exports.default = {
    name: '.say',
    help: 'Repeats what user says',
    permissionLvl: 0,
    run
};
