"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
class LeaveServer extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}leave`,
            help: 'Leave the server',
            permissionLvl: 2,
        });
    }
    async run(msg, args) {
        await msg.guild.leave();
    }
}
exports.default = LeaveServer;
