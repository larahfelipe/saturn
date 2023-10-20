import { ApplicationErrorHandler } from '@/handlers/ApplicationErrorHandler';
import type { GenericApplicationError as TGenericApplicationError } from '@/types';

export class GenericApplicationError extends Error {
  constructor(props: TGenericApplicationError) {
    const { bot, message, name = 'GenericApplicationError' } = props;

    super(message);
    this.name = name;
    ApplicationErrorHandler.getInstance(bot).handle(props);
  }
}
