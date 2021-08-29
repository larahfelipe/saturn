"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const MemberSchema = new mongoose_1.default.Schema({
    _id: mongoose_1.default.Schema.Types.ObjectId,
    userId: String,
    username: String,
    userRoleLvl: Number,
    wasAddedBy: String,
    wasUpdatedBy: String,
    wasAddedAtTime: String,
});
const Member = mongoose_1.default.model('Member', MemberSchema);
exports.default = Member;
