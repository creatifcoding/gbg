/**
 * PanelWrapper - Unified panel container primitive
 *
 * Consistent styling for panel components with:
 * - Header with title and optional trailing content
 * - Configurable padding and background
 * - Footer slot
 *
 * @module primitives/panel
 */

import { type ReactNode } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export interface PanelWrapperProps {
  /** Panel title */
  title?: string
  /** Content to render in header (right side) */
  headerTrailing?: ReactNode
  /** Main content */
  children: ReactNode
  /** Footer content */
  footer?: ReactNode
  /** Additional className for outer container */
  className?: string
  /** Background opacity variant */
  bgOpacity?: '30' | '50' | '80'
  /** Padding variant */
  padding?: 'sm' | 'md' | 'lg'
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BG_OPACITY_CLASSES = {
  '30': 'bg-neutral-900/30',
  '50': 'bg-neutral-900/50',
  '80': 'bg-neutral-900/80',
}

const PADDING_CLASSES = {
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Unified panel container with consistent styling.
 *
 * @example Basic usage
 * ```tsx
 * <PanelWrapper title="Throughput">
 *   <Chart data={data} />
 * </PanelWrapper>
 * ```
 *
 * @example With header trailing and footer
 * ```tsx
 * <PanelWrapper
 *   title="Latency"
 *   headerTrailing={<MetricBadge label="Avg" value={2.5} unit="ms" />}
 *   footer={<span>Total: 1,234 samples</span>}
 * >
 *   <Histogram data={samples} />
 * </PanelWrapper>
 * ```
 */
export function PanelWrapper({
  title,
  headerTrailing,
  children,
  footer,
  className = '',
  bgOpacity = '30',
  padding = 'md',
}: PanelWrapperProps) {
  const hasHeader = title || headerTrailing

  return (
    <div
      className={`
        ${BG_OPACITY_CLASSES[bgOpacity]}
        ${PADDING_CLASSES[padding]}
        rounded-lg border border-neutral-800
        ${className}
      `}
    >
      {/* Header */}
      {hasHeader && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3
              className="font-mono uppercase tracking-wider text-neutral-300"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              {title}
            </h3>
          )}
          {headerTrailing && (
            <div className="flex items-center gap-4">
              {headerTrailing}
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      {children}

      {/* Footer */}
      {footer && (
        <div
          className="flex items-center justify-between mt-2 text-neutral-500 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {footer}
        </div>
      )}
    </div>
  )
}

// =============================================================================
// COMPOUND COMPONENTS
// =============================================================================

export interface PanelHeaderProps {
  /** Panel title */
  title: string
  /** Optional trailing content */
  trailing?: ReactNode
  /** Additional className */
  className?: string
}

/**
 * Standalone panel header for custom compositions.
 */
export function PanelHeader({ title, trailing, className = '' }: PanelHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <h3
        className="font-mono uppercase tracking-wider text-neutral-300"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {title}
      </h3>
      {trailing && <div className="flex items-center gap-4">{trailing}</div>}
    </div>
  )
}

export interface PanelFooterProps {
  /** Footer content (left side) */
  children: ReactNode
  /** Optional trailing content (right side) */
  trailing?: ReactNode
  /** Additional className */
  className?: string
  /** Show top border */
  bordered?: boolean
}

/**
 * Standalone panel footer for custom compositions.
 */
export function PanelFooter({
  children,
  trailing,
  className = '',
  bordered = false,
}: PanelFooterProps) {
  return (
    <div
      className={`
        flex items-center justify-between text-neutral-500 font-mono
        ${bordered ? 'mt-4 pt-3 border-t border-neutral-800' : 'mt-2'}
        ${className}
      `}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <span>{children}</span>
      {trailing && <span>{trailing}</span>}
    </div>
  )
}

export default PanelWrapper
