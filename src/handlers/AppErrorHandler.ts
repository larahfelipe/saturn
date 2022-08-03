import { APP_RUNTIME_EXCEPTION } from '@/constants';
import { DatabaseCreateAppErrorReport } from '@/data/useCases/DatabaseCreateAppErrorReport';
import type { AppError } from '@/domain/models/AppError';
import { AppErrorRepository } from '@/infra/database/repositories/AppErrorRepository';
import type { Bot } from '@/structures/Bot';
import type { GeneralAppError } from '@/types';

export class AppErrorHandler {
  private static INSTANCE: AppErrorHandler;
  protected bot: Bot;
  CreateAppErrorReport!: DatabaseCreateAppErrorReport;

  private constructor(bot: Bot) {
    this.bot = bot;

    this.CreateAppErrorReport = new DatabaseCreateAppErrorReport(
      new AppErrorRepository()
    );
  }

  static getInstance(bot: Bot) {
    if (!this.INSTANCE) this.INSTANCE = new AppErrorHandler(bot);
    return this.INSTANCE;
  }

  async handle({ interaction, message, name }: GeneralAppError) {
    const triggeredBy = interaction
      ? `${interaction.author.tag} <${interaction.author.id}>`
      : APP_RUNTIME_EXCEPTION;

    let appError = {
      name: name ?? 'GeneralAppError',
      message,
      occurredAt: new Date().toLocaleString(),
      triggeredBy
    } as AppError;

    if (this.bot.DatabaseClient.isConnected())
      appError = await this.CreateAppErrorReport.create(appError);

    return appError;
  }
}
