import { User, GuildMember } from 'discord.js';

import { parseMember } from '../utils/ParseMembers';
import { Member } from '../models/Member';

async function handleMemberDeletion (memberAuthor: User, member: GuildMember | string) {
  const requestMemberAuthor = await Member.findOne({ userID: memberAuthor.id });

  const [memberExists]: any = await parseMember(member);
  if (!memberExists) throw new Error();
  if (requestMemberAuthor!.roleLvl < memberExists.roleLvl) return;

  memberExists.delete();
}

export { handleMemberDeletion };
