"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberDeletion = void 0;
const ParseMember_1 = require("../utils/ParseMember");
const Member_1 = __importDefault(require("../models/Member"));
async function handleMemberDeletion(memberAuthor, member) {
    const requestAuthor = await Member_1.default.findOne({ userID: memberAuthor.id });
    try {
        const [memberExists] = await ParseMember_1.parseMember(member);
        if (requestAuthor.roleLvl < memberExists.roleLvl)
            return;
        memberExists.delete();
    }
    catch (err) {
        console.error(err);
    }
}
exports.handleMemberDeletion = handleMemberDeletion;
