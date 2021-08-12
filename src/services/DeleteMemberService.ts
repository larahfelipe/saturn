import { User, GuildMember } from 'discord.js';

import { parseMember } from '../utils/ParseMember';
import Member from '../models/Member';

async function handleMemberDeletion(
  memberAuthor: User,
  member: GuildMember | string,
) {
  const requestAuthor = await Member.findOne({ userID: memberAuthor.id });

  try {
    const [memberExists] = await parseMember(member);
    if (requestAuthor!.roleLvl < memberExists.roleLvl) return;

    memberExists.delete();
  } catch (err) {
    console.error(err);
  }
}

export { handleMemberDeletion };
