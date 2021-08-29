"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const FetchGuildMemberService_1 = require("../../services/FetchGuildMemberService");
const UpdateGuildMemberService_1 = require("../../services/UpdateGuildMemberService");
const DeleteGuildMemberService_1 = require("../../services/DeleteGuildMemberService");
class FetchAllMembersInDatabase extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}findall`,
            help: 'List all members in database',
            requiredRoleLvl: 2,
        });
    }
    async run(msg, args) {
        try {
            let concatMembersData = '';
            const members = await FetchGuildMemberService_1.handleFetchAllMembersInDatabase();
            if (!members)
                return msg.reply('No member was found in database.');
            members.forEach((member, index) => {
                concatMembersData += `**${index}** ─ ${member.userRoleLvl} • ${member.username}\n`;
            });
            if (args) {
                const targetMemberIndex = parseInt(args[1]);
                const targetOperation = args[2];
                if (args[0] === '&SELECT') {
                    const targetMember = members.find((member, index) => {
                        if (index === targetMemberIndex)
                            return member;
                    });
                    switch (targetOperation) {
                        case '&SETADMIN':
                            UpdateGuildMemberService_1.handleGuildMemberElevation(targetMember.userId, msg);
                            break;
                        case '&UNSETADMIN':
                            UpdateGuildMemberService_1.handleGuildMemberDemotion(targetMember.userId, msg);
                            break;
                        case '&DELETE':
                            DeleteGuildMemberService_1.handleGuildMemberDeletion(targetMember.userId, msg);
                            break;
                        default:
                            return msg.channel.send('Unknown command.');
                    }
                    return msg.channel.send(`Database was updated • ${Date.now()}`);
                }
            }
            const embed = new discord_js_1.MessageEmbed();
            embed
                .setAuthor('SATURN Database Manager\nReg Index ─ Member Role Lvl • Member Username')
                .setDescription(concatMembersData)
                .setTimestamp(Date.now())
                .setFooter('MongoDB', 'https://pbs.twimg.com/profile_images/1234528105819189248/b6F1hk_6_400x400.jpg')
                .setColor('#6E76E5');
            msg.channel.send({ embed });
        }
        catch (err) {
            console.error(err);
            msg.reply("Couldn't retrieve members in database.");
        }
    }
}
exports.default = FetchAllMembersInDatabase;
