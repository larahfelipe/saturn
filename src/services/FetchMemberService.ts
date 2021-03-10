import { GuildMember } from 'discord.js';

import { Member } from '../models/Member';

export interface IMemberSimplified {
  username: string;
  roleLvl: number;
}

async function handleMemberSearch (member: GuildMember): Promise<IMemberSimplified> {
  const memberExists = await Member.findOne({ userID: member.id });
  if (!memberExists) throw new Error();

  return { username: memberExists.username, roleLvl: memberExists.roleLvl };
}

async function handleFetchAllMembers (): Promise<IMemberSimplified[]> {
  const fetchedMembers = await Member.find({})
    .then((docs) => {
      const formatMembersData = docs.map(member => {
        return { username: member.username, roleLvl: member.roleLvl };
      });
      return formatMembersData;
    })
    .catch(err => {
      throw new Error(err);
    });

  return fetchedMembers;
}

export { handleMemberSearch, handleFetchAllMembers };
