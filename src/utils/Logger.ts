import { AxiosError } from 'axios';
import { DiscordAPIError, HTTPError } from 'discord.js';

import Bot from '@/structs/Bot';

export default class Logger {
  bot: Bot;

  constructor(bot: Bot) {
    this.bot = bot;
  }

  async handleErrorEvent(error: unknown) {
    const errorType = error as Error | DiscordAPIError | HTTPError | AxiosError;
    const errorCode = 'code' in errorType ? errorType.code : 'N/A';
    const httpStatus = 'httpStatus' in errorType ? errorType.httpStatus : 'N/A';
    let errorStackMsg = errorType.stack || error;

    try {
      if (typeof errorStackMsg === 'string' && errorStackMsg.length > 2048) {
        console.error(errorStackMsg);
        errorStackMsg =
          'An error occurred during the app execution. Check your console to see more details.';
      }

      const parsedError = {
        errorTypeName: errorType.name,
        errorStackMsg: errorStackMsg,
        errorCode: errorCode!.toString(),
        httpStatus: httpStatus.toString()
      };

      return parsedError && console.log(parsedError);
    } catch (err) {
      console.error(err);
    }
  }
}
