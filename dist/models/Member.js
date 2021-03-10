"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Member = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const MemberSchema = new mongoose_1.default.Schema({
    _id: mongoose_1.default.Schema.Types.ObjectId,
    username: String,
    userID: String,
    roleLvl: Number,
    time: String
});
const Member = mongoose_1.default.model('Member', MemberSchema);
exports.Member = Member;
