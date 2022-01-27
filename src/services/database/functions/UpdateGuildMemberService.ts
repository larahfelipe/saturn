import { GuildMember, Message } from 'discord.js';

import { Member } from '@/models';
import { UpdateGuildMemberActions } from '@/types';
import { parseMember } from '@/utils';

export async function handleGuildMemberUpdateService(
  targetMember: GuildMember | string,
  targetAction: UpdateGuildMemberActions,
  msg: Message
) {
  const [_, memberId] = await parseMember(targetMember);

  await Member.findOneAndUpdate(
    {
      userId: memberId
    },
    {
      $set: {
        userRoleLvl: targetAction === 'PROMOTE' ? 1 : 0,
        wasUpdatedBy: msg.author.tag
      }
    }
  );
}
