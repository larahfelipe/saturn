"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberDeletion = void 0;
const ParseMembers_1 = require("../utils/ParseMembers");
const Member_1 = require("../models/Member");
async function handleMemberDeletion(memberAuthor, member) {
    const requestMemberAuthor = await Member_1.Member.findOne({ userID: memberAuthor.id });
    const [memberExists] = await ParseMembers_1.parseMember(member);
    if (!memberExists)
        throw new Error();
    if (requestMemberAuthor.roleLvl < memberExists.roleLvl)
        return;
    memberExists.delete();
}
exports.handleMemberDeletion = handleMemberDeletion;
