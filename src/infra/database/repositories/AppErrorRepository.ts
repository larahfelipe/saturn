import type { CreateAppErrorReportRepository } from '@/data/protocols/database/CreateAppErrorReportRepository';
import { PrismaClient } from '@/infra/PrismaClient';

export class AppErrorRepository implements CreateAppErrorReportRepository {
  async create(data: CreateAppErrorReportRepository.Params) {
    const { appError: appErrorCollection } = PrismaClient.getInstance();

    const newAppError = await appErrorCollection.create({ data });

    return newAppError;
  }
}
