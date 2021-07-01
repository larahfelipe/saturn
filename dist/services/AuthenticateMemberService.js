"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMemberAuth = void 0;
const Member_1 = __importDefault(require("../models/Member"));
async function handleMemberAuth(member) {
    const memberExists = await Member_1.default.findOne({ userID: member.id });
    if (!memberExists)
        throw new Error('Member was not found in database.');
    return memberExists;
}
exports.handleMemberAuth = handleMemberAuth;
