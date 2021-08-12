"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = __importDefault(require("../../config"));
const Command_1 = __importDefault(require("../../structs/Command"));
const FormatSecondsToTime_1 = require("../../utils/FormatSecondsToTime");
class SetReminder extends Command_1.default {
    constructor(bot) {
        super(bot, {
            name: `${config_1.default.botPrefix}remind`,
            help: 'Remind you about whatever you want',
            permissionLvl: 0,
        });
    }
    async run(msg, args) {
        const reminderMessage = args.slice(0, args.length - 1).join(' ');
        if (!reminderMessage)
            return msg.reply('You need to inform what I need to remind you about!');
        const reminderTime = args.slice(-1)[0];
        let numberTimestamp = reminderTime.slice(0, reminderTime.length - 1);
        const charTimestamp = reminderTime.slice(-1)[0];
        switch (charTimestamp) {
            case 'd':
                numberTimestamp *= 60 * 60 * 24 * 1000;
                break;
            case 'h':
                numberTimestamp *= 60 * 60 * 1000;
                break;
            case 'm':
                numberTimestamp *= 60 * 1000;
                break;
            case 's':
                numberTimestamp *= 1000;
                break;
            default:
                return msg.reply('You need to inform the time in days [d], hours [h], minutes [m] or seconds [s]!');
        }
        msg.reply(`Understood! I'll remind you about "${reminderMessage}" in ${FormatSecondsToTime_1.formatSecondsToTime(numberTimestamp / 1000)}`);
        setTimeout(() => {
            msg.reply(`[REMINDER] ${reminderMessage}`);
        }, numberTimestamp);
    }
}
exports.default = SetReminder;
