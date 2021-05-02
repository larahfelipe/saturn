import { GuildMember } from 'discord.js';

import { Member } from '../models/Member';
import { IMemberEssentials } from '../types';

async function handleMemberSearch (member: GuildMember): Promise<IMemberEssentials> {
  const memberExists = await Member.findOne({ userID: member.id });
  if (!memberExists) throw new Error();

  return {
    username: memberExists.username,
    userID: memberExists.userID,
    roleLvl: memberExists.roleLvl
  };
}

async function handleFetchAllMembers(): Promise<IMemberEssentials[]> {
  const fetchMembers = await Member.find({})
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

export { handleMemberSearch, handleFetchAllMembers };
