import type { GenericApplicationError as TGenericApplicationError } from '@/types';

import { GenericApplicationError } from './GenericApplicationError';

export class InvalidCommandError extends GenericApplicationError {
  constructor(props: TGenericApplicationError) {
    super(props);
    props.name = 'InvalidCommandError';
  }
}
