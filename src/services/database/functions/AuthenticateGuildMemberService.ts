import { GuildMember } from 'discord.js';

import { Member } from '@/models';
import { IMember } from '@/types';

export async function handleGuildMemberAuthenticationService(
  targetMember: GuildMember
): Promise<IMember | void> {
  const memberExists = await Member.findOne({ userId: targetMember.id });
  if (!memberExists) throw new Error('Member was not found in database.');

  return memberExists;
}
