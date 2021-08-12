"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const FetchMemberService_1 = require("../../services/FetchMemberService");
const UpdateMemberService_1 = require("../../services/UpdateMemberService");
const DeleteMemberService_1 = require("../../services/DeleteMemberService");
class FetchAllMembersInDatabase extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}findall`,
            help: 'List all members in database',
            permissionLvl: 2,
        });
    }
    async run(msg, args) {
        try {
            let concatMembersData = '';
            const members = await FetchMemberService_1.handleFetchAllMembers();
            if (!members)
                return msg.reply('No member was found in database.');
            members.forEach((member, index) => {
                concatMembersData += `**${index}** ─ ${member.roleLvl} • ${member.username}\n`;
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
                            UpdateMemberService_1.handleMemberElevation(targetMember.userID);
                            break;
                        case '&UNSETADMIN':
                            UpdateMemberService_1.handleMemberDemotion(targetMember.userID);
                            break;
                        case '&DELETE':
                            DeleteMemberService_1.handleMemberDeletion(msg.author, targetMember.userID);
                            break;
                        default:
                            return msg.channel.send('Unknown command.');
                    }
                    return msg.channel.send(`Database was updated • ${msg.createdAt}`);
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
