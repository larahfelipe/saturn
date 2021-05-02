"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFetchAllMembers = exports.handleMemberSearch = void 0;
const Member_1 = require("../models/Member");
async function handleMemberSearch(member) {
    const memberExists = await Member_1.Member.findOne({ userID: member.id });
    if (!memberExists)
        throw new Error();
    return {
        username: memberExists.username,
        userID: memberExists.userID,
        roleLvl: memberExists.roleLvl
    };
}
exports.handleMemberSearch = handleMemberSearch;
async function handleFetchAllMembers() {
    const fetchMembers = await Member_1.Member.find({})
        .then((docs) => {
        const formatMembersData = docs.map(member => {
            return {
                username: member.username,
                userID: member.userID,
                roleLvl: member.roleLvl
            };
        });
        return formatMembersData;
    })
        .catch(err => {
        throw new Error(err);
    });
    return fetchMembers;
}
exports.handleFetchAllMembers = handleFetchAllMembers;
