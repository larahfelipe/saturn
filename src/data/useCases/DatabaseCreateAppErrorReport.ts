import type { CreateAppErrorReport } from '@/domain/useCases/CreateAppErrorReport';
import type { AppErrorRepository } from '@/infra/database/repositories/AppErrorRepository';

export class DatabaseCreateAppErrorReport implements CreateAppErrorReport {
  protected readonly appErrorRepository: AppErrorRepository;

  constructor(appErrorRepository: AppErrorRepository) {
    this.appErrorRepository = appErrorRepository;
  }

  async create(error: CreateAppErrorReport.Request) {
    const result = await this.appErrorRepository.create(error);
    return result;
  }
}
