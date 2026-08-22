import {
  Kicker,
  Label,
  Mono,
  Pill,
  Sans,
  Socket,
  radius,
  space,
  typeFace,
  typeSize,
  typeTrack,
  typeWeight,
} from '@gbg/lab-ui';

export { Kicker, Label, Mono, Pill, Sans, Socket };

export const labFont = typeFace;
export const labType = {
  size: typeSize,
  tracking: typeTrack,
  weight: typeWeight,
} as const;
export const labSpace = space;
export const labRadius = radius;

export const labTextPaint = { color: 'inherit' } as const;
export const labBoxPaint = {
  color: 'inherit',
  background: 'transparent',
  borderColor: 'currentColor',
} as const;
