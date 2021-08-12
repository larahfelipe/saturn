import { GuildMember } from 'discord.js';

import Member from '../models/Member';
import { IMember } from '../types';

export async function parseMember(
  elmt: GuildMember | string,
): Promise<[IMember, string]> {
  let memberId: string;
  if (typeof elmt === 'string') {
    memberId = elmt;
  } else {
    memberId = elmt.id;
  }

  const memberExists = await Member.findOne({ userID: memberId });
  if (!memberExists) throw Error('Member was not found in database.');

  return [memberExists, memberId];
}
