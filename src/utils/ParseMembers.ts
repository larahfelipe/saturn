import { GuildMember } from 'discord.js';

import { Member } from '../models/Member';

export async function parseMember (elmt: GuildMember | string) {
  let memberId: string;
  if (typeof elmt === 'string') {
    memberId = elmt;
  } else {
    memberId = elmt.id;
  }
  return [await Member.findOne({ userID: memberId }), memberId];
}
