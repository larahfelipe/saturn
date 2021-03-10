import { GuildMember } from 'discord.js';

import { Member } from '../models/Member';

async function handleMemberElevation (member: GuildMember) {
  const memberExists = await Member.findOne({ userID: member.id });
  if (!memberExists) throw new Error();
  
  await Member.findOneAndUpdate({
    userID: member.id
  }, {
    $set: {
      roleLvl: 1
    }
  });
}

async function handleMemberDemotion (member: GuildMember) {
  const memberExists = await Member.findOne({ userID: member.id });
  if (!memberExists) throw new Error();

  await Member.findOneAndUpdate({
    userID: member.id
  }, {
    $set: {
      roleLvl: 0
    }
  });
}

export { handleMemberElevation, handleMemberDemotion };
