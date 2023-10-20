import { APP_RUNTIME_EXCEPTION } from '@/constants';
import { DatabaseCreateApplicationErrorEntry } from '@/data/useCases/DatabaseCreateApplicationErrorEntry';
import type { ApplicationError } from '@/domain/models/ApplicationError';
import { ApplicationErrorRepository } from '@/infra/database/repositories/ApplicationErrorRepository';
import type { Bot } from '@/structures/Bot';
import type { GenericApplicationError } from '@/types';

export class ApplicationErrorHandler {
  private static INSTANCE: ApplicationErrorHandler;
  private createApplicationErrorEntry!: DatabaseCreateApplicationErrorEntry;
  private bot: Bot;

  private constructor(bot: Bot) {
    this.bot = bot;

    this.createApplicationErrorEntry = new DatabaseCreateApplicationErrorEntry(
      new ApplicationErrorRepository()
    );
  }

  static getInstance(bot: Bot) {
    if (!this.INSTANCE) this.INSTANCE = new ApplicationErrorHandler(bot);
    return this.INSTANCE;
  }

  async handle({
    interaction,
    message,
    name = 'GenericApplicationError'
  }: GenericApplicationError) {
    const triggeredBy = interaction
      ? interaction.user.username
      : APP_RUNTIME_EXCEPTION;

    let data = {
      name,
      message,
      triggeredBy,
      occurredAt: new Date().toLocaleString()
    } as ApplicationError;

    if (this.bot.databaseClient.isConnected())
      data = await this.createApplicationErrorEntry.create(data);

    return data;
  }
}
