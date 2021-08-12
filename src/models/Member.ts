import mongoose from 'mongoose';

import { IMember } from '../types';

const MemberSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  username: String,
  userID: String,
  roleLvl: Number,
  time: String,
});

const Member = mongoose.model<IMember>('Member', MemberSchema);

export default Member;
