/**
 * RVN Feedback Components
 *
 * User feedback and notification components for the brutalist design system.
 * These components wrap Base UI for accessibility while maintaining RVN styling.
 *
 * Components:
 * - RvnToast - Toast notifications with Provider/Viewport/Root pattern
 * - RvnAlert - Inline alerts with Title/Description/Icon pattern
 * - RvnTooltip - Hover tooltips with Portal/Positioner/Popup pattern
 * - RvnPopover - Click-triggered popovers with full compound pattern
 * - RvnProgressBar - Progress indicators with Track/Indicator pattern
 *
 * @example Toast with provider
 * ```tsx
 * import { RvnToast, useRvnToast } from '@/lib/rvn/feedback'
 *
 * function App() {
 *   return (
 *     <RvnToast.Provider>
 *       <Content />
 *       <RvnToast.Viewport position="bottom-right" />
 *     </RvnToast.Provider>
 *   )
 * }
 *
 * function Content() {
 *   const { toast } = useRvnToast()
 *   return <button onClick={() => toast({ title: 'Done!' })}>Click</button>
 * }
 * ```
 */

// =============================================================================
// Toast - from baseui/overlays
// =============================================================================

export {
  RvnToast,
  useRvnToast,
  type RvnToastVariant,
  type RvnToastRootProps,
  type RvnToastViewportProps,
  type RvnToastTitleProps,
  type RvnToastDescriptionProps,
  type RvnToastCloseProps,
  type RvnToastActionProps,
} from '../baseui/overlays'

// =============================================================================
// Tooltip - from baseui/overlays
// =============================================================================

export {
  RvnTooltip,
  type RvnTooltipPopupProps,
  type RvnTooltipArrowProps,
} from '../baseui/overlays'

// Re-export position type for backwards compatibility
export type RvnTooltipPosition = 'top' | 'bottom' | 'left' | 'right'

// =============================================================================
// Popover - from baseui/overlays
// =============================================================================

export {
  RvnPopover,
  type RvnPopoverPopupProps,
  type RvnPopoverArrowProps,
  type RvnPopoverTitleProps,
  type RvnPopoverDescriptionProps,
  type RvnPopoverBodyProps,
  type RvnPopoverCloseProps,
} from '../baseui/overlays'

// Re-export position type for backwards compatibility
export type RvnPopoverPosition = 'top' | 'bottom' | 'left' | 'right'

// =============================================================================
// Alert - Inline alerts (distinct from AlertDialog)
// =============================================================================

// Import Alert from the local file which wraps AlertDialog for inline use
// but with a simpler API focused on inline alerts vs modal dialogs
export {
  RvnAlert,
  useRvnAlert,
  type RvnAlertVariant,
  type RvnAlertProps,
  type RvnAlertTitleProps,
  type RvnAlertDescriptionProps,
  type RvnAlertIconProps,
} from './RvnAlert'

// =============================================================================
// ProgressBar - from baseui/utility (aliased as RvnProgressBar)
// =============================================================================

// Re-export Progress as ProgressBar for backwards compatibility
import { RvnProgress } from '../baseui/utility'

/**
 * RvnProgressBar - Brutalist progress bar
 *
 * Compound pattern wrapping Base UI Progress:
 * - Root: Container with value/max props
 * - Track: The background track
 * - Indicator: The fill indicator
 * - Label: Optional percentage label
 *
 * @example
 * ```tsx
 * <RvnProgressBar.Root value={75}>
 *   <RvnProgressBar.Track>
 *     <RvnProgressBar.Indicator />
 *   </RvnProgressBar.Track>
 *   <RvnProgressBar.Label />
 * </RvnProgressBar.Root>
 * ```
 */
export const RvnProgressBar = {
  Root: RvnProgress.Root,
  Track: RvnProgress.Track,
  Indicator: RvnProgress.Indicator,
  Label: RvnProgress.Label,
}

export type {
  RvnProgressVariant as RvnProgressBarVariant,
  RvnProgressRootProps as RvnProgressBarRootProps,
  RvnProgressTrackProps as RvnProgressBarTrackProps,
  RvnProgressIndicatorProps as RvnProgressBarIndicatorProps,
  RvnProgressLabelProps as RvnProgressBarLabelProps,
} from '../baseui/utility'

// Legacy type alias
export type RvnProgressBarProps = {
  value?: number
  max?: number
  variant?: 'default' | 'critical'
  showLabel?: boolean
  label?: string
  height?: string
  indeterminate?: boolean
  style?: React.CSSProperties
}
