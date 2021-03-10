import { User, GuildMember } from 'discord.js';

import { Member } from '../models/Member';

async function handleMemberDeletion(memberAuthor: User, member: GuildMember) {
  const requestMemberAuthor = await Member.findOne({ userID: memberAuthor.id });
  const memberExists = await Member.findOne({ userID: member.id });
  if (!memberExists) throw new Error();
  if (requestMemberAuthor!.roleLvl < memberExists.roleLvl) return;

  memberExists.delete();
}

export { handleMemberDeletion };
