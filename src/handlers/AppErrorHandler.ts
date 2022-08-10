import { APP_RUNTIME_EXCEPTION } from '@/constants';
import { DatabaseCreateAppErrorReport } from '@/data/useCases/DatabaseCreateAppErrorReport';
import type { AppError } from '@/domain/models/AppError';
import { AppErrorRepository } from '@/infra/database/repositories/AppErrorRepository';
import type { Bot } from '@/structures/Bot';
import type { GeneralAppError } from '@/types';

export class AppErrorHandler {
  private static INSTANCE: AppErrorHandler;
  protected bot: Bot;
  createAppErrorReport!: DatabaseCreateAppErrorReport;

  private constructor(bot: Bot) {
    this.bot = bot;

    this.createAppErrorReport = new DatabaseCreateAppErrorReport(
      new AppErrorRepository()
    );
  }

  static getInstance(bot: Bot) {
    if (!this.INSTANCE) this.INSTANCE = new AppErrorHandler(bot);
    return this.INSTANCE;
  }

  async handle({ interaction, message, name }: GeneralAppError) {
    const triggeredBy = interaction
      ? `${interaction.user.tag} <${interaction.user.id}>`
      : APP_RUNTIME_EXCEPTION;

    let appError = {
      name: name ?? 'GeneralAppError',
      message,
      occurredAt: new Date().toLocaleString(),
      triggeredBy
    } as AppError;

    if (this.bot.databaseClient.isConnected())
      appError = await this.createAppErrorReport.create(appError);

    return appError;
  }
}
