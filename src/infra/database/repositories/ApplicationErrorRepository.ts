import type { CreateApplicationErrorEntryRepository } from '@/data/protocols/database/CreateApplicationErrorEntryRepository';
import { PrismaClient } from '@/infra/PrismaClient';

export class ApplicationErrorRepository
  implements CreateApplicationErrorEntryRepository
{
  async create(data: CreateApplicationErrorEntryRepository.Params) {
    const { applicationError: applicationErrorCollection } =
      PrismaClient.getInstance();

    const newError = await applicationErrorCollection.create({ data });

    return newError;
  }
}
