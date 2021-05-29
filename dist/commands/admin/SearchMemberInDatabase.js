"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
const FetchMemberService_1 = require("../../services/FetchMemberService");
async function run(bot, msg, args) {
    var _a;
    const targetMember = (_a = msg.mentions.members) === null || _a === void 0 ? void 0 : _a.first();
    if (!targetMember)
        return msg.reply('You need to tag someone!');
    try {
        const member = await FetchMemberService_1.handleMemberSearch(targetMember);
        msg.channel.send(`\`· Member: ${member.username} ─ Role Lvl: ${member.roleLvl}\``);
    }
    catch (err) {
        console.error(err);
        msg.reply('Member is not registered in database!');
    }
}
exports.default = {
    name: `${config_1.default.botPrefix}find`,
    help: 'Searches a member in database',
    permissionLvl: 1,
    run
};
