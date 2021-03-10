"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberDeletion = void 0;
const Member_1 = require("../models/Member");
async function handleMemberDeletion(memberAuthor, member) {
    const requestMemberAuthor = await Member_1.Member.findOne({ userID: memberAuthor.id });
    const memberExists = await Member_1.Member.findOne({ userID: member.id });
    if (!memberExists)
        throw new Error();
    if (requestMemberAuthor.roleLvl < memberExists.roleLvl)
        return;
    memberExists.delete();
}
exports.handleMemberDeletion = handleMemberDeletion;
