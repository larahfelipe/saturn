import { GuildMember } from 'discord.js';

import Member from '../models/Member';
import { IMember } from '../types';

async function handleGuildMemberAuth(
  targetMember: GuildMember
): Promise<IMember | void> {
  const memberExists = await Member.findOne({ userId: targetMember.id });
  if (!memberExists) throw new Error('Member was not found in database.');

  return memberExists;
}

export { handleGuildMemberAuth };
