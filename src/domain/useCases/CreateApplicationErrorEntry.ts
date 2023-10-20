import type { ApplicationError } from '../models/ApplicationError';

export interface CreateApplicationErrorEntry {
  create: (
    error: CreateApplicationErrorEntry.Request
  ) => Promise<CreateApplicationErrorEntry.Response>;
}

export namespace CreateApplicationErrorEntry {
  export type Request = Omit<ApplicationError, 'id'>;
  export type Response = ApplicationError;
}
