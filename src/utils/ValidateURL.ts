import { validateURL } from 'ytdl-core';

import { PLATFORMS } from '@/constants';

export const isValidURL = (
  value: string,
  platform?: keyof typeof PLATFORMS
) => {
  let isValid = false;

  switch (platform) {
    case 'YouTube':
      isValid = validateURL(value);
      break;
    case 'Spotify':
      isValid = value.includes(PLATFORMS.Spotify.baseUrl);
      break;
    default:
      isValid = value.includes('http') && value.startsWith('http');
      break;
  }

  return isValid;
};
