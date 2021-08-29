import { Message } from 'discord.js';

import config from '@/config';
import Command from '@/structs/Command';
import Bot from '@/structs/Bot';
import { formatSecondsToTime } from '@/utils/functions/FormatSecondsToTime';

export default class SetReminder extends Command {
  constructor(bot: Bot) {
    super(bot, {
      name: `${config.botPrefix}remind`,
      help: 'Remind you about whatever you want',
      requiredRoleLvl: 0
    });
  }

  async run(msg: Message, args: string[]) {
    const reminderMessage = args.slice(0, args.length - 1).join(' ');
    if (!reminderMessage)
      return msg.reply('You need to inform what I need to remind you about!');

    const reminderTime = args.slice(-1)[0];
    let numberTimestamp = reminderTime.slice(0, reminderTime.length - 1) as any;
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
        return msg.reply(
          'You need to inform the time in days [d], hours [h], minutes [m] or seconds [s]!'
        );
    }
    msg.reply(
      `Understood! I'll remind you about "${reminderMessage}" in ${formatSecondsToTime(
        numberTimestamp / 1000
      )}`
    );

    setTimeout(() => {
      msg.reply(`[REMINDER] ${reminderMessage}`);
    }, numberTimestamp);
  }
}
