import { VANTA_TYPOGRAPHY } from './vanta.js';

export const typeFace = {
  sans: VANTA_TYPOGRAPHY.family.sans,
  mono: VANTA_TYPOGRAPHY.family.mono,
} as const;

export const typeSize = {
  micro: VANTA_TYPOGRAPHY.size.sm,
  label: VANTA_TYPOGRAPHY.size.sm,
  kicker: VANTA_TYPOGRAPHY.size.sm,
  body: VANTA_TYPOGRAPHY.size.sm,
  copy: VANTA_TYPOGRAPHY.size.md,
} as const;

export const typeTrack = {
  kicker: VANTA_TYPOGRAPHY.preset.label.letterSpacing,
  wider: VANTA_TYPOGRAPHY.tracking.wider,
  widest: VANTA_TYPOGRAPHY.tracking.widest,
  tight: VANTA_TYPOGRAPHY.tracking.tight,
} as const;

export const typeWeight = {
  regular: VANTA_TYPOGRAPHY.weight.normal,
  medium: VANTA_TYPOGRAPHY.weight.medium,
  semibold: VANTA_TYPOGRAPHY.weight.semibold,
} as const;

export type TypeSize = keyof typeof typeSize;
