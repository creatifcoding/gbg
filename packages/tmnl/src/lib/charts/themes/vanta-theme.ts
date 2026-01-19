/**
 * VANTA G2 Theme
 *
 * Maps TMNL Vantablack design tokens to G2/AntV chart theming.
 * Provides dark and light variants that match the overall design system.
 *
 * @module charts/themes/vanta-theme
 */

import { VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal/tokens';
import type { CSSProperties } from 'react';

// =============================================================================
// G2 Theme Config Type
// =============================================================================

/**
 * G2-compatible theme configuration.
 * This structure is based on G2's theme system as used by Ant Design Charts.
 *
 * @see https://g2.antv.antgroup.com/manual/core/bindingTheme
 */
export interface G2ThemeConfig {
  /** Theme variant identifier */
  type: 'light' | 'dark';

  /** Primary color for single-series charts */
  color: string;

  /** 10-color categorical palette */
  category10: string[];

  /** 20-color extended categorical palette */
  category20: string[];

  /** Background colors */
  view: {
    /** Overall view background */
    viewFill: string;
    /** Plot area background */
    plotFill: string;
  };

  /** Axis styling */
  axis: {
    /** Axis label text color */
    labelFill: string;
    /** Axis label font family */
    labelFontFamily: string;
    /** Axis label font size */
    labelFontSize: number;
    /** Grid line stroke color */
    gridStroke: string;
    /** Grid line stroke opacity */
    gridStrokeOpacity: number;
    /** Axis line stroke color */
    lineStroke: string;
    /** Axis tick stroke color */
    tickStroke: string;
    /** Axis title text color */
    titleFill: string;
    /** Axis title font family */
    titleFontFamily: string;
    /** Axis title font size */
    titleFontSize: number;
  };

  /** Legend styling */
  legend: {
    /** Legend label text color */
    labelFill: string;
    /** Legend label font family */
    labelFontFamily: string;
    /** Legend label font size */
    labelFontSize: number;
    /** Legend title text color */
    titleFill: string;
    /** Legend marker stroke color */
    markerStroke: string;
    /** Legend background fill */
    backgroundFill: string;
    /** Legend background opacity */
    backgroundFillOpacity: number;
  };

  /** Tooltip CSS styling */
  tooltip: {
    /** Tooltip container CSS */
    css: Record<string, CSSProperties>;
  };

  /** Annotation styling */
  annotation: {
    /** Text annotation color */
    textFill: string;
    /** Line annotation stroke */
    lineStroke: string;
    /** Region annotation fill */
    regionFill: string;
    /** Region annotation fill opacity */
    regionFillOpacity: number;
  };

  /** Default geometry styling */
  geometry: {
    /** Default stroke color for lines */
    lineStroke: string;
    /** Default stroke width */
    lineStrokeWidth: number;
    /** Default point fill */
    pointFill: string;
    /** Default area fill opacity */
    areaFillOpacity: number;
  };
}

// =============================================================================
// Color Palettes
// =============================================================================

/**
 * VANTA 10-color categorical palette.
 * Optimized for dark backgrounds with high contrast.
 */
const VANTA_CATEGORY_10: string[] = [
  VANTA_COLORS.accent.cyan,       // Primary accent
  VANTA_COLORS.accent.emerald,    // Success/positive
  VANTA_COLORS.accent.amber,      // Warning/attention
  VANTA_COLORS.accent.rose,       // Error/negative
  VANTA_COLORS.accent.violet,     // Secondary accent
  VANTA_COLORS.accent.cyanMuted,  // Muted cyan
  VANTA_COLORS.accent.emeraldMuted,
  VANTA_COLORS.accent.amberMuted,
  VANTA_COLORS.accent.roseMuted,
  VANTA_COLORS.accent.violetMuted,
];

/**
 * VANTA 20-color extended categorical palette.
 * Includes primary colors plus variations and neutrals.
 */
const VANTA_CATEGORY_20: string[] = [
  ...VANTA_CATEGORY_10,
  // Extended palette with opacity variations
  'rgba(34, 211, 238, 0.7)',   // cyan 70%
  'rgba(52, 211, 153, 0.7)',   // emerald 70%
  'rgba(251, 191, 36, 0.7)',   // amber 70%
  'rgba(251, 113, 133, 0.7)',  // rose 70%
  'rgba(167, 139, 250, 0.7)',  // violet 70%
  VANTA_COLORS.text.secondary,
  VANTA_COLORS.text.tertiary,
  VANTA_COLORS.text.muted,
  VANTA_COLORS.accent.neutral,
  VANTA_COLORS.accent.neutralMuted,
];

// =============================================================================
// Theme Factory
// =============================================================================

/**
 * Creates a VANTA G2 theme configuration.
 *
 * @param variant - 'dark' (default) or 'light'
 * @returns G2-compatible theme configuration
 *
 * @example
 * ```tsx
 * import { createVantaG2Theme } from '@/lib/charts/themes'
 *
 * const darkTheme = createVantaG2Theme('dark')
 * <Line theme={darkTheme} data={...} />
 * ```
 */
export function createVantaG2Theme(variant: 'dark' | 'light' = 'dark'): G2ThemeConfig {
  const isDark = variant === 'dark';

  // Surface colors based on variant
  const surfaces = isDark
    ? {
        viewFill: VANTA_COLORS.surface.void,
        plotFill: VANTA_COLORS.surface.base,
        gridStroke: 'rgba(255, 255, 255, 0.05)',
        lineStroke: VANTA_COLORS.surface.border,
        tickStroke: VANTA_COLORS.surface.border,
      }
    : {
        viewFill: '#ffffff',
        plotFill: '#fafafa',
        gridStroke: 'rgba(0, 0, 0, 0.08)',
        lineStroke: 'rgba(0, 0, 0, 0.15)',
        tickStroke: 'rgba(0, 0, 0, 0.15)',
      };

  // Text colors based on variant
  const textColors = isDark
    ? {
        primary: VANTA_COLORS.text.primary,
        secondary: VANTA_COLORS.text.secondary,
        tertiary: VANTA_COLORS.text.tertiary,
      }
    : {
        primary: '#1f1f1f',
        secondary: '#525252',
        tertiary: '#737373',
      };

  // Tooltip background based on variant
  const tooltipBg = isDark ? VANTA_COLORS.surface.elevated : '#ffffff';
  const tooltipBorder = isDark ? VANTA_COLORS.surface.border : 'rgba(0, 0, 0, 0.1)';

  return {
    type: variant,

    // Primary color
    color: VANTA_COLORS.accent.cyan,

    // Categorical palettes
    category10: VANTA_CATEGORY_10,
    category20: VANTA_CATEGORY_20,

    // View backgrounds
    view: {
      viewFill: surfaces.viewFill,
      plotFill: surfaces.plotFill,
    },

    // Axis styling
    axis: {
      labelFill: textColors.secondary,
      labelFontFamily: VANTA_TYPOGRAPHY.family.mono,
      labelFontSize: 11,
      gridStroke: surfaces.gridStroke,
      gridStrokeOpacity: 1,
      lineStroke: surfaces.lineStroke,
      tickStroke: surfaces.tickStroke,
      titleFill: textColors.primary,
      titleFontFamily: VANTA_TYPOGRAPHY.family.grotesk,
      titleFontSize: 12,
    },

    // Legend styling
    legend: {
      labelFill: textColors.secondary,
      labelFontFamily: VANTA_TYPOGRAPHY.family.mono,
      labelFontSize: 11,
      titleFill: textColors.primary,
      markerStroke: 'transparent',
      backgroundFill: surfaces.plotFill,
      backgroundFillOpacity: isDark ? 0.8 : 0.95,
    },

    // Tooltip styling
    tooltip: {
      css: {
        '.g2-tooltip': {
          backgroundColor: tooltipBg,
          border: `1px solid ${tooltipBorder}`,
          borderRadius: '4px',
          boxShadow: isDark
            ? '0 4px 16px rgba(0, 0, 0, 0.4)'
            : '0 4px 16px rgba(0, 0, 0, 0.1)',
          fontFamily: VANTA_TYPOGRAPHY.family.mono,
          fontSize: '12px',
          color: textColors.primary,
          padding: '8px 12px',
        },
        '.g2-tooltip-title': {
          color: textColors.secondary,
          fontSize: '11px',
          fontWeight: '500',
          marginBottom: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        },
        '.g2-tooltip-list-item': {
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '2px 0',
        },
        '.g2-tooltip-marker': {
          borderRadius: '2px',
        },
        '.g2-tooltip-name': {
          color: textColors.secondary,
        },
        '.g2-tooltip-value': {
          color: textColors.primary,
          fontWeight: '500',
        },
      },
    },

    // Annotation styling
    annotation: {
      textFill: textColors.secondary,
      lineStroke: VANTA_COLORS.accent.cyan,
      regionFill: VANTA_COLORS.accent.cyanGlow,
      regionFillOpacity: 0.3,
    },

    // Geometry defaults
    geometry: {
      lineStroke: VANTA_COLORS.accent.cyan,
      lineStrokeWidth: 2,
      pointFill: VANTA_COLORS.accent.cyan,
      areaFillOpacity: 0.15,
    },
  };
}

// =============================================================================
// Preset Themes
// =============================================================================

/**
 * Pre-built VANTA dark theme.
 * Use this for most dark-mode chart rendering.
 */
export const VANTA_G2_THEME_DARK = createVantaG2Theme('dark');

/**
 * Pre-built VANTA light theme.
 * Use this for light-mode chart rendering.
 */
export const VANTA_G2_THEME_LIGHT = createVantaG2Theme('light');

// =============================================================================
// Type Exports
// =============================================================================

export type G2ThemeVariant = 'dark' | 'light';
