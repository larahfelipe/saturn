import mongoose from 'mongoose';

import { IMember } from '@/types';

const MemberSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  userId: String,
  username: String,
  userRoleLvl: Number,
  wasAddedBy: String,
  wasUpdatedBy: String,
  wasAddedAtTime: String
});

const Member = mongoose.model<IMember>('Member', MemberSchema);

export { Member };
