"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFetchAllMembers = exports.handleMemberSearch = void 0;
const Member_1 = __importDefault(require("../models/Member"));
async function handleMemberSearch(member) {
    const memberExists = await Member_1.default.findOne({ userID: member.id });
    if (!memberExists)
        throw new Error('Member was not found in database.');
    return {
        username: memberExists.username,
        userID: memberExists.userID,
        roleLvl: memberExists.roleLvl,
    };
}
exports.handleMemberSearch = handleMemberSearch;
async function handleFetchAllMembers() {
    return await Member_1.default.find({})
        .then((docs) => {
        const formatMembersData = docs.map((member) => {
            return {
                username: member.username,
                userID: member.userID,
                roleLvl: member.roleLvl,
            };
        });
        return formatMembersData;
    })
        .catch((err) => {
        console.error(err);
    });
}
exports.handleFetchAllMembers = handleFetchAllMembers;
