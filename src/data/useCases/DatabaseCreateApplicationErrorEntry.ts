import type { CreateApplicationErrorEntry } from '@/domain/useCases/CreateApplicationErrorEntry';
import type { ApplicationErrorRepository } from '@/infra/database/repositories/ApplicationErrorRepository';

export class DatabaseCreateApplicationErrorEntry
  implements CreateApplicationErrorEntry
{
  protected readonly applicationErrorRepository: ApplicationErrorRepository;

  constructor(applicationErrorRepository: ApplicationErrorRepository) {
    this.applicationErrorRepository = applicationErrorRepository;
  }

  async create(error: CreateApplicationErrorEntry.Request) {
    const newError = await this.applicationErrorRepository.create(error);

    return newError;
  }
}
