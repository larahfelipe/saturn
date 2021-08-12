import { GuildMember } from 'discord.js';

import Member from '../models/Member';
import { IMemberEssentials } from '../types';

async function handleMemberSearch(
  member: GuildMember,
): Promise<IMemberEssentials | void> {
  const memberExists = await Member.findOne({ userID: member.id });
  if (!memberExists) throw new Error('Member was not found in database.');

  return {
    username: memberExists.username,
    userID: memberExists.userID,
    roleLvl: memberExists.roleLvl,
  };
}

async function handleFetchAllMembers(): Promise<IMemberEssentials[] | void> {
  return await Member.find({})
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

export { handleMemberSearch, handleFetchAllMembers };
