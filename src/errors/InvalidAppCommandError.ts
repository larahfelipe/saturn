import type { GeneralAppError as TGeneralAppError } from '@/types';

import { GeneralAppError } from './GeneralAppError';

export class InvalidAppCommandError extends GeneralAppError {
  constructor(props: TGeneralAppError) {
    props.name = 'InvalidAppCommandError';
    super(props);
  }
}
