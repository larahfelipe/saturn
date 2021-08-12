"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberCreation = void 0;
const mongoose_1 = require("mongoose");
const Member_1 = __importDefault(require("../models/Member"));
async function handleMemberCreation(member) {
    const memberExists = await Member_1.default.findOne({ userID: member.id });
    if (memberExists)
        throw new Error('Member already registered in database.');
    const newMember = new Member_1.default({
        _id: new mongoose_1.Types.ObjectId(),
        username: member.user.tag,
        userID: member.id,
        roleLvl: 0,
        time: Date.now(),
    });
    newMember.save();
}
exports.handleMemberCreation = handleMemberCreation;
