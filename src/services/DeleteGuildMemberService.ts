import { GuildMember, Message } from 'discord.js';

import Member from '@/models/Member';
import { parseMember } from '@/utils/functions/ParseMember';

async function handleGuildMemberDeletion(
  targetMember: GuildMember | string,
  msg: Message
) {
  const getRequestAuthor = await Member.findOne({ userId: msg.author.id });
  if (!getRequestAuthor) throw new Error('Member was not found in database.');

  try {
    const [memberExists] = await parseMember(targetMember);
    if (getRequestAuthor!.userRoleLvl < memberExists.userRoleLvl)
      throw new Error('Cannot delete a member that has higher permissions.');

    memberExists.delete();
  } catch (err) {
    console.error(err);
  }
}

export { handleGuildMemberDeletion };
