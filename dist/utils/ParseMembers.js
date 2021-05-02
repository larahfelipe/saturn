"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMember = void 0;
const Member_1 = require("../models/Member");
async function parseMember(elmt) {
    let memberId;
    if (typeof elmt === 'string') {
        memberId = elmt;
    }
    else {
        memberId = elmt.id;
    }
    return [await Member_1.Member.findOne({ userID: memberId }), memberId];
}
exports.parseMember = parseMember;
