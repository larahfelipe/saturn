import { GuildMember } from 'discord.js';

import { Member } from '../models/Member';

async function handleMemberAuth (member: GuildMember) {
  const memberExists = await Member.findOne({ userID: member.id });
  if (!memberExists) throw new Error();

  return memberExists;
}

export { handleMemberAuth };
