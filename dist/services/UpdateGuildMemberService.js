"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildMemberDemotion = exports.handleGuildMemberElevation = void 0;
const ParseMember_1 = require("../utils/ParseMember");
const Member_1 = __importDefault(require("../models/Member"));
async function handleGuildMemberElevation(targetMember, msg) {
    const [_, memberId] = await ParseMember_1.parseMember(targetMember);
    await Member_1.default.findOneAndUpdate({
        userId: memberId,
    }, {
        $set: {
            userRoleLvl: 1,
            wasUpdatedBy: msg.author.tag,
        },
    });
}
exports.handleGuildMemberElevation = handleGuildMemberElevation;
async function handleGuildMemberDemotion(targetMember, msg) {
    const [_, memberId] = await ParseMember_1.parseMember(targetMember);
    await Member_1.default.findOneAndUpdate({
        userId: memberId,
    }, {
        $set: {
            userRoleLvl: 0,
            wasUpdatedBy: msg.author.tag,
        },
    });
}
exports.handleGuildMemberDemotion = handleGuildMemberDemotion;
