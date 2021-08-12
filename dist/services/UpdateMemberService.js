"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberDemotion = exports.handleMemberElevation = void 0;
const ParseMember_1 = require("../utils/ParseMember");
const Member_1 = __importDefault(require("../models/Member"));
async function handleMemberElevation(member) {
    const [memberExists, memberId] = await ParseMember_1.parseMember(member);
    await Member_1.default.findOneAndUpdate({
        userID: memberId,
    }, {
        $set: {
            roleLvl: 1,
        },
    });
}
exports.handleMemberElevation = handleMemberElevation;
async function handleMemberDemotion(member) {
    const [memberExists, memberId] = await ParseMember_1.parseMember(member);
    await Member_1.default.findOneAndUpdate({
        userID: memberId,
    }, {
        $set: {
            roleLvl: 0,
        },
    });
}
exports.handleMemberDemotion = handleMemberDemotion;
