import type { GeneralAppError as TGeneralAppError } from '@/types';

import { GeneralAppError } from './GeneralAppError';

export class VCWebSocketCloseError extends GeneralAppError {
  constructor(props: TGeneralAppError) {
    props.name = 'VoiceChannelWebSocketCloseError';
    super(props);
  }
}
