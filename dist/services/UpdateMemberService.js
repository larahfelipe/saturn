"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberDemotion = exports.handleMemberElevation = void 0;
const ParseMembers_1 = require("../utils/ParseMembers");
const Member_1 = require("../models/Member");
async function handleMemberElevation(member) {
    const [memberExists, memberId] = await ParseMembers_1.parseMember(member);
    if (!memberExists)
        throw new Error();
    await Member_1.Member.findOneAndUpdate({
        userID: memberId
    }, {
        $set: {
            roleLvl: 1
        }
    });
}
exports.handleMemberElevation = handleMemberElevation;
async function handleMemberDemotion(member) {
    const [memberExists, memberId] = await ParseMembers_1.parseMember(member);
    if (!memberExists)
        throw new Error();
    await Member_1.Member.findOneAndUpdate({
        userID: memberId
    }, {
        $set: {
            roleLvl: 0
        }
    });
}
exports.handleMemberDemotion = handleMemberDemotion;
