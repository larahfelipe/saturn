"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberAuth = void 0;
const Member_1 = require("../models/Member");
async function handleMemberAuth(member) {
    const memberExists = await Member_1.Member.findOne({ userID: member.id });
    if (!memberExists)
        throw new Error();
    return memberExists;
}
exports.handleMemberAuth = handleMemberAuth;
