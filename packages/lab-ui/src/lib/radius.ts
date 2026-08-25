import { VANTA_BORDERS } from './vanta.js';

export const radius = {
  frame: VANTA_BORDERS.radius.none,
  statusDot: '9999px',
} as const;

export type RadiusName = keyof typeof radius;
