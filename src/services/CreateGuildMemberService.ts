import { GuildMember, Message } from 'discord.js';
import { Types } from 'mongoose';

import Member from '@/models/Member';

async function handleGuildMemberCreation(
  targetMember: GuildMember,
  msg: Message
) {
  const memberExists = await Member.findOne({ userId: targetMember.id });
  if (memberExists) throw new Error('Member already registered in database.');

  const newMember = new Member({
    _id: new Types.ObjectId(),
    userId: targetMember.id,
    username: targetMember.user.tag,
    userRoleLvl: 0,
    wasAddedBy: msg.author.tag,
    wasUpdatedBy: msg.author.tag,
    wasAddedAtTime: msg.createdAt
  });
  newMember.save();
}

export { handleGuildMemberCreation };
