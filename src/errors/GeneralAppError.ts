import { AppErrorHandler } from '@/handlers/AppErrorHandler';
import type { GeneralAppError as TGeneralAppError } from '@/types';

export class GeneralAppError extends Error {
  constructor(props: TGeneralAppError) {
    super(props.message);
    this.name = props.name ?? 'GeneralAppError';

    AppErrorHandler.getInstance(props.bot).handle(props);
  }
}
