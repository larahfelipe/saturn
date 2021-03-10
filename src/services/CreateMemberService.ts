import { GuildMember } from 'discord.js';

import { Member } from '../models/Member';
import mongoose from 'mongoose';

async function handleMemberCreation (member: GuildMember) {
  const memberExists = await Member.findOne({ userID: member.id });
  if (memberExists) throw new Error();

  const createMember = new Member({
    _id: new mongoose.Types.ObjectId(),
    username: member.user.tag,
    userID: member.id,
    roleLvl: 0,
    time: Date.now()
  });
  createMember.save();
}

export { handleMemberCreation };
