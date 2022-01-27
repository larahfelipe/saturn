import { GuildMember } from 'discord.js';

import { Member } from '@/models';
import { MemberEssentials } from '@/types';

export async function handleGuildMemberFetchService(
  targetMember?: GuildMember
): Promise<MemberEssentials | MemberEssentials[] | void> {
  if (targetMember) {
    const memberExists = await Member.findOne({ userId: targetMember.id });
    if (!memberExists) throw new Error('Member was not found in database.');

    return {
      userId: memberExists.userId,
      username: memberExists.username,
      userRoleLvl: memberExists.userRoleLvl,
      wasAddedBy: memberExists.wasAddedBy,
      wasUpdatedBy: memberExists.wasUpdatedBy
    };
  }

  return await Member.find({})
    .then((docs) => {
      return docs.map((member) => {
        return {
          userId: member.userId,
          username: member.username,
          userRoleLvl: member.userRoleLvl,
          wasAddedBy: member.wasAddedBy,
          wasUpdatedBy: member.wasUpdatedBy
        };
      });
    })
    .catch((err) => {
      console.error(err);
    });
}
