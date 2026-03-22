/**
 * RvnTooltip - Brutalist Tooltip (Base UI Wrapper)
 *
 * Wraps Base UI Tooltip with RVN brutalist styling:
 * - Black bg, white text
 * - 1px border
 * - Monospace 11px (exception to 12px floor for tooltips)
 *
 * @example
 * ```tsx
 * <RvnTooltip.Root>
 *   <RvnTooltip.Trigger>
 *     <button>TX-99</button>
 *   </RvnTooltip.Trigger>
 *   <RvnTooltip.Portal>
 *     <RvnTooltip.Positioner>
 *       <RvnTooltip.Popup>
 *         <RvnTooltip.Arrow />
 *         UNIT STATUS: ACTIVE
 *       </RvnTooltip.Popup>
 *     </RvnTooltip.Positioner>
 *   </RvnTooltip.Portal>
 * </RvnTooltip.Root>
 * ```
 */

import * as React from 'react'
import { Tooltip } from '@base-ui-components/react/tooltip'
import {
  RVN_BORDERS,
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_WEIGHTS,
} from '../../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnTooltipPopupProps
  extends React.ComponentPropsWithoutRef<typeof Tooltip.Popup> {
  maxWidth?: string
}

export interface RvnTooltipArrowProps
  extends React.ComponentPropsWithoutRef<typeof Tooltip.Arrow> {}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  popup: {
    background: RVN_COLORS.black,
    color: RVN_COLORS.white,
    border: `1px solid ${RVN_COLORS.black}`,
    borderRadius: RVN_BORDERS.radius,
    padding: '8px 10px',
    fontFamily: RVN_FONTS.mono,
    fontSize: '11px', // Exception: tooltips use 11px
    fontWeight: RVN_FONT_WEIGHTS.regular,
    lineHeight: 1.3,
    zIndex: 10000,
    pointerEvents: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  arrow: {
    width: '8px',
    height: '8px',
    background: RVN_COLORS.black,
    transform: 'rotate(45deg)',
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

function Popup({
  style,
  maxWidth = '300px',
  children,
  ...props
}: RvnTooltipPopupProps) {
  return (
    <Tooltip.Popup
      style={{ ...styles.popup, maxWidth, ...style }}
      data-rvn-tooltip-popup=""
      {...props}
    >
      {children}
    </Tooltip.Popup>
  )
}

function Arrow({ style, ...props }: RvnTooltipArrowProps) {
  return (
    <Tooltip.Arrow
      style={{ ...styles.arrow, ...style }}
      data-rvn-tooltip-arrow=""
      {...props}
    />
  )
}

// -----------------------------------------------------------------------------
// Display Names
// -----------------------------------------------------------------------------

Popup.displayName = 'RvnTooltip.Popup'
Arrow.displayName = 'RvnTooltip.Arrow'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnTooltip = {
  Provider: Tooltip.Provider,
  Root: Tooltip.Root,
  Trigger: Tooltip.Trigger,
  Portal: Tooltip.Portal,
  Positioner: Tooltip.Positioner,
  Popup,
  Arrow,
}

export type {
  RvnTooltipPopupProps as PopupProps,
  RvnTooltipArrowProps as ArrowProps,
}
