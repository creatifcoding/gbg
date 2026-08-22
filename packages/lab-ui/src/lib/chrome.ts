import { color } from './color.js';
import { radius } from './radius.js';
import { space } from './space.js';
import { typeFace, typeSize, typeTrack, typeWeight } from './type.js';

export const chrome = {
  color,
  font: typeFace,
  type: {
    size: typeSize,
    tracking: typeTrack,
    weight: typeWeight,
  },
  space,
  radius,
} as const;

export type Chrome = typeof chrome;
