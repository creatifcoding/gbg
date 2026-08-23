import { VANTA_COLORS } from './vanta.js';

export const color = {
  void: VANTA_COLORS.surface.void,
  base: VANTA_COLORS.surface.base,
  elevated: VANTA_COLORS.surface.elevated,
  raised: VANTA_COLORS.surface.raised,
  border: VANTA_COLORS.surface.border,
  primary: VANTA_COLORS.text.primary,
  secondary: VANTA_COLORS.text.secondary,
  tertiary: VANTA_COLORS.text.tertiary,
  muted: VANTA_COLORS.text.muted,
  cyan: VANTA_COLORS.accent.cyan,
  cyanMuted: VANTA_COLORS.accent.cyanMuted,
  cyanGlow: VANTA_COLORS.accent.cyanGlow,
  emerald: VANTA_COLORS.accent.emerald,
  emeraldMuted: VANTA_COLORS.accent.emeraldMuted,
  emeraldGlow: VANTA_COLORS.accent.emeraldGlow,
  amber: VANTA_COLORS.accent.amber,
  amberMuted: VANTA_COLORS.accent.amberMuted,
  amberGlow: VANTA_COLORS.accent.amberGlow,
  rose: VANTA_COLORS.accent.rose,
  roseMuted: VANTA_COLORS.accent.roseMuted,
  roseGlow: VANTA_COLORS.accent.roseGlow,
} as const;

export type ColorName = keyof typeof color;
