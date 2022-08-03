import type { GeneralAppError as TGeneralAppError } from '@/types';

import { GeneralAppError } from './GeneralAppError';

export class UncaughtExceptionMonitorError extends GeneralAppError {
  constructor(props: TGeneralAppError) {
    props.name = 'UncaughtExceptionMonitorError';
    super(props);
  }
}
