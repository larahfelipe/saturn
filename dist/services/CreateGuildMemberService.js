"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGuildMemberCreation = void 0;
const mongoose_1 = require("mongoose");
const Member_1 = __importDefault(require("../models/Member"));
async function handleGuildMemberCreation(targetMember, msg) {
    const memberExists = await Member_1.default.findOne({ userId: targetMember.id });
    if (memberExists)
        throw new Error('Member already registered in database.');
    const newMember = new Member_1.default({
        _id: new mongoose_1.Types.ObjectId(),
        userId: targetMember.id,
        username: targetMember.user.tag,
        userRoleLvl: 0,
        wasAddedBy: msg.author.tag,
        wasUpdatedBy: msg.author.tag,
        wasAddedAtTime: msg.createdAt,
    });
    newMember.save();
}
exports.handleGuildMemberCreation = handleGuildMemberCreation;
