import type { GenericApplicationError as TGenericApplicationError } from '@/types';

import { GenericApplicationError } from './GenericApplicationError';

export class UncaughtExceptionMonitorError extends GenericApplicationError {
  constructor(props: TGenericApplicationError) {
    props.name = 'UncaughtExceptionMonitorError';
    super(props);
  }
}
