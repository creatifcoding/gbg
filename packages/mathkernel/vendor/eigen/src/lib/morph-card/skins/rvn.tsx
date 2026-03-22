/**
 * RVN MorphCard Skin
 *
 * Brutalist RVN styling for MorphCard (headless core).
 */

import type { CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import {
  RVN_BORDERS,
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SHADOWS,
  RVN_SPACING,
} from '@/lib/rvn/tokens';
import type {
  MorphCardSlots,
  MorphCardTheme,
} from '../components/MorphCard';

// -----------------------------------------------------------------------------
// Slot components
// -----------------------------------------------------------------------------

const paddingValue = (padding?: 'none' | 'sm' | 'md' | 'lg') => {
  switch (padding) {
    case 'none':
      return '0px';
    case 'sm':
      return RVN_SPACING.s;
    case 'lg':
      return RVN_SPACING.l;
    case 'md':
    default:
      return RVN_SPACING.m;
  }
};

const RvnContent = ({ padding = 'md', className, style, ...props }: HTMLAttributes<HTMLDivElement> & { padding?: 'none' | 'sm' | 'md' | 'lg' }) => (
  <div
    className={cn(className)}
    style={{ ...style, padding: paddingValue(padding) }}
    data-slot="content"
    {...props}
  />
);

const RvnHeader = ({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(className)}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: RVN_SPACING.s,
      borderBottom: `1px solid ${RVN_COLORS.borderMuted}`,
      ...style,
    }}
    data-slot="header"
    {...props}
  />
);

const RvnBody = ({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(className)}
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: RVN_SPACING.xs,
      ...style,
    }}
    data-slot="body"
    {...props}
  />
);

const RvnFooter = ({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(className)}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: RVN_SPACING.s,
      borderTop: `1px solid ${RVN_COLORS.borderMuted}`,
      ...style,
    }}
    data-slot="footer"
    {...props}
  />
);

const RvnTitle = ({ className, style, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(className)}
    style={{
      fontFamily: RVN_FONTS.sans,
      fontSize: RVN_FONT_SIZES.label,
      fontWeight: RVN_FONT_WEIGHTS.bold,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: RVN_COLORS.textMain,
      ...style,
    }}
    data-slot="title"
    {...props}
  />
);

const badgeStyle = (variant?: string): CSSProperties => {
  switch (variant) {
    case 'success':
      return { background: RVN_COLORS.surfaceHighlight, color: RVN_COLORS.textMain, border: `1px solid ${RVN_COLORS.border}` };
    case 'warning':
      return { background: RVN_COLORS.white, color: RVN_COLORS.black, border: `1px solid ${RVN_COLORS.border}` };
    case 'error':
      return { background: RVN_COLORS.black, color: RVN_COLORS.white };
    case 'info':
      return { background: 'transparent', color: RVN_COLORS.textMuted, border: `1px solid ${RVN_COLORS.borderMuted}` };
    case 'default':
    default:
      return { background: RVN_COLORS.surfaceMuted, color: RVN_COLORS.textMuted, border: `1px solid ${RVN_COLORS.borderMuted}` };
  }
};

const RvnBadge = ({ className, style, variant = 'default', ...props }: HTMLAttributes<HTMLSpanElement> & { variant?: string }) => (
  <span
    className={cn(className)}
    style={{
      fontFamily: RVN_FONTS.mono,
      fontSize: RVN_FONT_SIZES.label,
      fontWeight: RVN_FONT_WEIGHTS.bold,
      textTransform: 'uppercase',
      padding: '0 4px',
      ...badgeStyle(variant),
      ...style,
    }}
    data-slot="badge"
    data-variant={variant}
    {...props}
  />
);

const RvnActions = ({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(className)}
    style={{ display: 'flex', alignItems: 'center', gap: RVN_SPACING.xs, ...style }}
    data-slot="actions"
    {...props}
  />
);

export const rvnMorphCardSlots: MorphCardSlots = {
  Content: RvnContent,
  Header: RvnHeader,
  Body: RvnBody,
  Footer: RvnFooter,
  Title: RvnTitle,
  Badge: RvnBadge,
  Actions: RvnActions,
};

// -----------------------------------------------------------------------------
// Theme
// -----------------------------------------------------------------------------

export const rvnMorphCardTheme: MorphCardTheme = {
  styles: {
    frame: {
      background: RVN_COLORS.surface,
      border: RVN_BORDERS.card,
      borderRadius: RVN_BORDERS.radius,
      boxShadow: RVN_SHADOWS.default,
    },
  },
};
