import type { AppError } from '@/domain/models/AppError';

export interface CreateAppErrorReportRepository {
  create: (
    data: CreateAppErrorReportRepository.Params
  ) => Promise<CreateAppErrorReportRepository.Result>;
}

export namespace CreateAppErrorReportRepository {
  export type Params = Omit<AppError, 'id'>;
  export type Result = AppError;
}
