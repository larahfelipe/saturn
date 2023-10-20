import type { ApplicationError } from '@/domain/models/ApplicationError';

export interface CreateApplicationErrorEntryRepository {
  create: (
    data: CreateApplicationErrorEntryRepository.Params
  ) => Promise<CreateApplicationErrorEntryRepository.Result>;
}

export namespace CreateApplicationErrorEntryRepository {
  export type Params = Omit<ApplicationError, 'id'>;
  export type Result = ApplicationError;
}
