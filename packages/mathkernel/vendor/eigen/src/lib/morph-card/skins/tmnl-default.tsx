/**
 * TMNL Default MorphCard Skin
 *
 * Recreates the original MorphCard styling (pre-headless refactor).
 * Use explicitly — MorphCard is now headless by default.
 */

import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type {
  MorphCardSlots,
  MorphCardTheme,
} from '../components/MorphCard';
import type { MorphCardConfig } from '../schemas/animation-config';
import { DEFAULT_CARD_CONFIG } from '../schemas/animation-config';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const titleSizeClass = (size?: 'sm' | 'md' | 'lg') => {
  switch (size) {
    case 'sm':
      return 'text-xs';
    case 'lg':
      return 'text-base';
    case 'md':
    default:
      return 'text-sm';
  }
};

const badgeVariantClass = (variant?: 'default' | 'success' | 'warning' | 'error' | 'info') => {
  switch (variant) {
    case 'success':
      return 'bg-emerald-900/50 text-emerald-400';
    case 'warning':
      return 'bg-amber-900/50 text-amber-400';
    case 'error':
      return 'bg-red-900/50 text-red-400';
    case 'info':
      return 'bg-cyan-900/50 text-cyan-400';
    case 'default':
    default:
      return 'bg-neutral-800 text-neutral-300';
  }
};

const paddingClass = (padding?: 'none' | 'sm' | 'md' | 'lg') => {
  switch (padding) {
    case 'none':
      return '';
    case 'sm':
      return 'p-2';
    case 'lg':
      return 'p-6';
    case 'md':
    default:
      return 'p-4';
  }
};

export const tmnlBorderGlow = (intensity: number) => `
  inset 0 0 0 1px rgba(255,255,255,${intensity}),
  inset 0 1px 0 rgba(255,255,255,${intensity * 0.8}),
  0 0 0 1px rgba(255,255,255,${intensity * 0.3}),
  0 2px 8px rgba(0,0,0,0.4),
  0 0 20px rgba(0,0,0,0.2)
`;

// -----------------------------------------------------------------------------
// Slots (original TMNL styling)
// -----------------------------------------------------------------------------

const TmnlContent = ({ padding = 'md', className, ...props }: HTMLAttributes<HTMLDivElement> & { padding?: 'none' | 'sm' | 'md' | 'lg' }) => (
  <div className={cn('w-full h-full', paddingClass(padding), className)} {...props} />
);

const TmnlHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between px-4 py-2 border-b border-white/5', className)} {...props} />
);

const TmnlBody = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex-1 overflow-hidden', className)} {...props} />
);

const TmnlFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between px-4 py-2 border-t border-white/5', className)} {...props} />
);

const TmnlTitle = ({ className, size = 'md', ...props }: HTMLAttributes<HTMLSpanElement> & { size?: 'sm' | 'md' | 'lg' }) => (
  <span className={cn('font-mono font-medium text-neutral-200 tracking-wide uppercase', titleSizeClass(size), className)} {...props} />
);

const TmnlBadge = ({ className, variant = 'default', ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'success' | 'warning' | 'error' | 'info' }) => (
  <span
    className={cn('px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider', badgeVariantClass(variant), className)}
    data-variant={variant}
    {...props}
  />
);

const TmnlActions = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center gap-2', className)} {...props} />
);

export const tmnlMorphCardSlots: MorphCardSlots = {
  Content: TmnlContent,
  Header: TmnlHeader,
  Body: TmnlBody,
  Footer: TmnlFooter,
  Title: TmnlTitle,
  Badge: TmnlBadge,
  Actions: TmnlActions,
};

// -----------------------------------------------------------------------------
// Theme (frame styling)
// -----------------------------------------------------------------------------

export const createTmnlMorphCardTheme = (
  config: Partial<MorphCardConfig> = {}
): MorphCardTheme => {
  const borderRadius = config.borderRadius ?? DEFAULT_CARD_CONFIG.borderRadius;
  const intensity = config.borderIntensity ?? DEFAULT_CARD_CONFIG.borderIntensity;

  return {
    styles: {
      frame: {
        backgroundColor: 'oklch(0.08 0.005 280)',
        borderRadius,
        boxShadow: tmnlBorderGlow(intensity),
      } as CSSProperties,
    },
  };
};

export const tmnlMorphCardTheme = createTmnlMorphCardTheme();
