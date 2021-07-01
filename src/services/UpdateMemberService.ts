import { GuildMember } from 'discord.js';

import { parseMember } from '../utils/ParseMember';
import Member from '../models/Member';

async function handleMemberElevation(member: GuildMember | string) {
  const [memberExists, memberId] = await parseMember(member);

  await Member.findOneAndUpdate({
    userID: memberId
  }, {
    $set: {
      roleLvl: 1
    }
  });
}

async function handleMemberDemotion(member: GuildMember | string) {
  const [memberExists, memberId] = await parseMember(member);

  await Member.findOneAndUpdate({
    userID: memberId
  }, {
    $set: {
      roleLvl: 0
    }
  });
}

export { handleMemberElevation, handleMemberDemotion };
