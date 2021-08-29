"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFetchAllMembersInDatabase = exports.handleSearchGuildMember = void 0;
const Member_1 = __importDefault(require("../models/Member"));
async function handleSearchGuildMember(targetMember) {
    const memberExists = await Member_1.default.findOne({ userId: targetMember.id });
    if (!memberExists)
        throw new Error('Member was not found in database.');
    return {
        userId: memberExists.userId,
        username: memberExists.username,
        userRoleLvl: memberExists.userRoleLvl,
        wasAddedBy: memberExists.wasAddedBy,
        wasUpdatedBy: memberExists.wasUpdatedBy,
    };
}
exports.handleSearchGuildMember = handleSearchGuildMember;
async function handleFetchAllMembersInDatabase() {
    return await Member_1.default.find({})
        .then((docs) => {
        const formatMembersData = docs.map((member) => {
            return {
                userId: member.userId,
                username: member.username,
                userRoleLvl: member.userRoleLvl,
                wasAddedBy: member.wasAddedBy,
                wasUpdatedBy: member.wasUpdatedBy,
            };
        });
        return formatMembersData;
    })
        .catch((err) => {
        console.error(err);
    });
}
exports.handleFetchAllMembersInDatabase = handleFetchAllMembersInDatabase;
