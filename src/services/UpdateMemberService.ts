import { GuildMember } from 'discord.js';

import { parseMember } from '../utils/ParseMembers';
import { Member } from '../models/Member';

async function handleMemberElevation (member: GuildMember | string) {
  const [memberExists, memberId] = await parseMember(member);
  if (!memberExists) throw new Error();
  
  await Member.findOneAndUpdate({
    userID: <string>memberId
  }, {
    $set: {
      roleLvl: 1
    }
  });
}

async function handleMemberDemotion (member: GuildMember | string) {
  const [memberExists, memberId] = await parseMember(member);
  if (!memberExists) throw new Error();

  await Member.findOneAndUpdate({
    userID: <string>memberId
  }, {
    $set: {
      roleLvl: 0
    }
  });
}

export { handleMemberElevation, handleMemberDemotion };
