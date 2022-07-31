import Vibrant from 'node-vibrant';

import { InvalidParameterError } from '@/errors/InvalidParameterError';

import { isValidURL } from './ValidateURL';

type RGBVector = [number, number, number];

type Palette = {
  Vibrant: string | RGBVector | undefined;
  Muted: string | RGBVector | undefined;
  DarkVibrant: string | RGBVector | undefined;
  DarkMuted: string | RGBVector | undefined;
  LightVibrant: string | RGBVector | undefined;
  LightMuted: string | RGBVector | undefined;
};

const PaletteColors: Palette = {
  Vibrant: undefined,
  Muted: undefined,
  DarkVibrant: undefined,
  DarkMuted: undefined,
  LightVibrant: undefined,
  LightMuted: undefined
};

export const getImagePaletteColors = async (imageUrl: string) => {
  const isValid = await isValidURL(imageUrl);
  if (!isValid) throw new InvalidParameterError('imageUrl must be a valid URL');

  const rawPalette = await Vibrant.from(imageUrl).getPalette();
  if (!rawPalette) throw new Error('Could not get palette');

  Object.keys(rawPalette).forEach((key) => {
    if (Object.keys(PaletteColors).includes(key)) {
      PaletteColors[key as keyof Palette] = rawPalette[key]?.hex
        ? rawPalette[key]?.hex
        : rawPalette[key]?.rgb;
    }
  });

  return PaletteColors;
};
