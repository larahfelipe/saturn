import mongoose, { Document } from 'mongoose';

interface IMember extends Document {
  _id: string;
  username: string;
  roleLvl: number;
  time: string;
}

const MemberSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  username: String,
  userID: String,
  roleLvl: Number,
  time: String
});

const Member = mongoose.model<IMember>('Member', MemberSchema);

export { Member };
