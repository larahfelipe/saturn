import type { CreateAppErrorReportRepository } from '@/data/protocols/database/CreateAppErrorReportRepository';
import { AppError } from '@/domain/models/AppError';
import { PrismaClient } from '@/infra/PrismaClient';

export class AppErrorRepository implements CreateAppErrorReportRepository {
  async create(data: CreateAppErrorReportRepository.Params) {
    const appErrorCollection = PrismaClient.getInstance().appError;

    const appError: AppError = await appErrorCollection.create({
      data: {
        ...data
      }
    });
    return appError;
  }
}
