import { GuildMember } from 'discord.js';
import { Types } from 'mongoose';

import Member from '../models/Member';

async function handleMemberCreation(member: GuildMember) {
  const memberExists = await Member.findOne({ userID: member.id });
  if (memberExists) throw new Error('Member already registered in database.');

  const newMember = new Member({
    _id: new Types.ObjectId(),
    username: member.user.tag,
    userID: member.id,
    roleLvl: 0,
    time: Date.now()
  });
  newMember.save();
}

export { handleMemberCreation };
