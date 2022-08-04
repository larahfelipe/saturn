import { validateURL } from 'ytdl-core';

import { PLATFORMS } from '@/constants';

export const isValidURL = async (
  value: string,
  specificPlatform?: keyof typeof PLATFORMS
) => {
  let isValid = true;

  try {
    if (specificPlatform === PLATFORMS.YouTube) {
      validateURL(value);
    } else {
      new URL(value);
    }
  } catch (_) {
    isValid = false;
  }
  return isValid;
};
