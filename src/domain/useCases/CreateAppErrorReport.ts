import type { AppError } from '../models/AppError';

export interface CreateAppErrorReport {
  create: (
    error: CreateAppErrorReport.Request
  ) => Promise<CreateAppErrorReport.Response>;
}

export namespace CreateAppErrorReport {
  export type Request = Omit<AppError, 'id'>;
  export type Response = AppError;
}
