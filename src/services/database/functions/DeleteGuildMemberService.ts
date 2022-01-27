import { GuildMember, Message } from 'discord.js';

import { Member } from '@/models';
import { parseMember } from '@/utils';

export async function handleGuildMemberDeletionService(
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
