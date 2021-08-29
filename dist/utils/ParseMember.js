"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMember = void 0;
const Member_1 = __importDefault(require("../models/Member"));
async function parseMember(elmt) {
    let memberId;
    if (typeof elmt === 'string') {
        memberId = elmt;
    }
    else {
        memberId = elmt.id;
    }
    const memberExists = await Member_1.default.findOne({ userId: memberId });
    if (!memberExists)
        throw Error('Member was not found in database.');
    return [memberExists, memberId];
}
exports.parseMember = parseMember;
