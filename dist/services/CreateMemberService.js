"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberCreation = void 0;
const Member_1 = require("../models/Member");
const mongoose_1 = __importDefault(require("mongoose"));
async function handleMemberCreation(member) {
    const memberExists = await Member_1.Member.findOne({ userID: member.id });
    if (memberExists)
        throw new Error();
    const createMember = new Member_1.Member({
        _id: new mongoose_1.default.Types.ObjectId(),
        username: member.user.tag,
        userID: member.id,
        roleLvl: 0,
        time: Date.now()
    });
    createMember.save();
}
exports.handleMemberCreation = handleMemberCreation;
