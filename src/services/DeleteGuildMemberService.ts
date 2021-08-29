import { GuildMember, Message } from 'discord.js';

import { parseMember } from '../utils/ParseMember';
import Member from '../models/Member';

async function handleGuildMemberDeletion(
  targetMember: GuildMember | string,
  msg: Message
) {
  const getRequestAuthor = await Member.findOne({ userId: msg.author.id });

  try {
    const [memberExists] = await parseMember(targetMember);
    if (getRequestAuthor!.userRoleLvl < memberExists.userRoleLvl) return;

    memberExists.delete();
  } catch (err) {
    console.error(err);
  }
}

export { handleGuildMemberDeletion };
