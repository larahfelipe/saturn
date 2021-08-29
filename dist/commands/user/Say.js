"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
class Say extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}say`,
            help: 'Repeat what user says',
            requiredRoleLvl: 0,
        });
    }
    async run(msg, args) {
        const concatArgs = args.join(' ');
        const messageCapitalized = concatArgs[0].toUpperCase() + concatArgs.slice(1);
        msg.channel.send(messageCapitalized);
    }
}
exports.default = Say;
