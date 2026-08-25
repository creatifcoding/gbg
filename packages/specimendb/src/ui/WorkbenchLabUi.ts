import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  Kicker,
  Label,
  Mono,
  Pill,
  Sans,
  Socket,
} from '@gbg/lab-ui';

export {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  Kicker,
  Label,
  Mono,
  Pill,
  Sans,
  Socket,
};

export const labTextPaint = { color: VANTA_COLORS.text.muted } as const;
export const labBoxPaint = {
  color: VANTA_COLORS.text.primary,
  background: VANTA_COLORS.surface.void,
  borderColor: VANTA_COLORS.surface.border,
} as const;
