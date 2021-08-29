"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildMemberDeletion = void 0;
const ParseMember_1 = require("../utils/ParseMember");
const Member_1 = __importDefault(require("../models/Member"));
async function handleGuildMemberDeletion(targetMember, msg) {
    const getRequestAuthor = await Member_1.default.findOne({ userId: msg.author.id });
    try {
        const [memberExists] = await ParseMember_1.parseMember(targetMember);
        if (getRequestAuthor.userRoleLvl < memberExists.userRoleLvl)
            return;
        memberExists.delete();
    }
    catch (err) {
        console.error(err);
    }
}
exports.handleGuildMemberDeletion = handleGuildMemberDeletion;
