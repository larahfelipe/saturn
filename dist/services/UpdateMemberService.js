"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberDemotion = exports.handleMemberElevation = void 0;
const Member_1 = require("../models/Member");
async function handleMemberElevation(member) {
    const memberExists = await Member_1.Member.findOne({ userID: member.id });
    if (!memberExists)
        throw new Error();
    await Member_1.Member.findOneAndUpdate({
        userID: member.id
    }, {
        $set: {
            roleLvl: 1
        }
    });
}
exports.handleMemberElevation = handleMemberElevation;
async function handleMemberDemotion(member) {
    const memberExists = await Member_1.Member.findOne({ userID: member.id });
    if (!memberExists)
        throw new Error();
    await Member_1.Member.findOneAndUpdate({
        userID: member.id
    }, {
        $set: {
            roleLvl: 0
        }
    });
}
exports.handleMemberDemotion = handleMemberDemotion;
