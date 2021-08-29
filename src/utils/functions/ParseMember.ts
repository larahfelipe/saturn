import { GuildMember } from 'discord.js';

import Member from '@/models/Member';
import { IMember } from '@/types';

export async function parseMember(
  member: GuildMember | string
): Promise<[IMember, string]> {
  const memberId = typeof member === 'string' ? member : member.id;

  const memberExists = await Member.findOne({ userId: memberId });
  if (!memberExists) throw Error('Member was not found in database.');

  return [memberExists, memberId];
}
