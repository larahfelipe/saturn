"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
function run(bot, msg, args) {
    const concatArgs = args.join(' ');
    const messageCapitalized = concatArgs[0].toUpperCase() + concatArgs.slice(1);
    msg.channel.send(messageCapitalized);
}
exports.default = {
    name: `${config_1.default.botPrefix}say`,
    help: 'Repeats what user says',
    permissionLvl: 0,
    run
};
