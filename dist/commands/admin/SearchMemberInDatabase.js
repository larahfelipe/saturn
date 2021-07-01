"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const FetchMemberService_1 = require("../../services/FetchMemberService");
class SearchMemberInDatabase extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}find`,
            help: 'Search a member in database',
            permissionLvl: 1
        });
    }
    async run(msg, args) {
        const targetMember = msg.mentions.members?.first();
        if (!targetMember)
            return msg.reply('You need to tag someone!');
        try {
            const member = await FetchMemberService_1.handleMemberSearch(targetMember);
            if (member) {
                msg.channel.send(`\`· Member: ${member.username} ─ Role Lvl: ${member.roleLvl}\``);
            }
        }
        catch (err) {
            console.error(err);
            msg.reply('Member was not found in database.');
        }
    }
}
exports.default = SearchMemberInDatabase;
