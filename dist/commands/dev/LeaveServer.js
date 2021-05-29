"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
async function run(bot, msg, args) {
    await msg.guild.leave();
}
exports.default = {
    name: `${config_1.default.botPrefix}leave`,
    help: 'Leaves the server',
    permissionLvl: 2,
    run
};
