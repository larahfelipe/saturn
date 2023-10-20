import type { GenericApplicationError as TGenericApplicationError } from '@/types';

import { GenericApplicationError } from './GenericApplicationError';

export class UnhandledPromiseRejectionError extends GenericApplicationError {
  constructor(props: TGenericApplicationError) {
    props.name = 'UnhandledPromiseRejectionError';
    super(props);
  }
}
