/**
 * RvnSeparator - Brutalist Separator Component
 *
 * Wraps Base UI Separator with RVN styling:
 * - 3px black line (default)
 * - OR 1px muted line variant
 *
 * @example
 * ```tsx
 * // Default (3px black)
 * <RvnSeparator />
 *
 * // Muted variant (1px gray)
 * <RvnSeparator variant="muted" />
 *
 * // Vertical
 * <RvnSeparator orientation="vertical" />
 * ```
 */

import * as React from 'react'
import { Separator } from '@base-ui-components/react/separator'
import {
  RVN_COLORS,
  RVN_BORDERS,
  RVN_SPACING,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type RvnSeparatorVariant = 'default' | 'muted'
export type RvnSeparatorOrientation = 'horizontal' | 'vertical'

export interface RvnSeparatorProps extends React.ComponentProps<typeof Separator> {
  /** Visual variant */
  variant?: RvnSeparatorVariant
  /** Orientation of the separator */
  orientation?: RvnSeparatorOrientation
  /** Custom thickness */
  thickness?: string
  /** Add spacing around the separator */
  spacing?: 'none' | 'sm' | 'md' | 'lg'
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const getStyles = (
  variant: RvnSeparatorVariant,
  orientation: RvnSeparatorOrientation,
  thickness?: string,
  spacing?: 'none' | 'sm' | 'md' | 'lg'
): React.CSSProperties => {
  const isHorizontal = orientation === 'horizontal'
  const isMuted = variant === 'muted'

  const color = isMuted ? RVN_COLORS.borderMuted : RVN_COLORS.border
  const size = thickness ?? (isMuted ? '1px' : RVN_BORDERS.widthPrimary)

  const spacingMap = {
    none: '0',
    sm: RVN_SPACING.xs,
    md: RVN_SPACING.s,
    lg: RVN_SPACING.m,
  }

  const spacingValue = spacingMap[spacing ?? 'none']

  if (isHorizontal) {
    return {
      width: '100%',
      height: size,
      background: color,
      border: 'none',
      margin: `${spacingValue} 0`,
      flexShrink: 0,
    }
  }

  return {
    width: size,
    height: '100%',
    background: color,
    border: 'none',
    margin: `0 ${spacingValue}`,
    flexShrink: 0,
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const RvnSeparator = React.forwardRef<HTMLDivElement, RvnSeparatorProps>(
  (
    {
      variant = 'default',
      orientation = 'horizontal',
      thickness,
      spacing = 'none',
      style,
      ...props
    },
    ref
  ) => {
    const separatorStyle = getStyles(variant, orientation, thickness, spacing)

    return (
      <Separator
        ref={ref}
        orientation={orientation}
        style={{ ...separatorStyle, ...style }}
        data-variant={variant}
        {...props}
      />
    )
  }
)

RvnSeparator.displayName = 'RvnSeparator'

export { RvnSeparator as RvnSeparatorRoot }
