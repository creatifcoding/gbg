/**
 * RvnObjectiveItem
 *
 * List item component for objectives/tasks with checkbox.
 * Features: 4px left border accent, checkbox, completion state.
 *
 * Source pattern: Brutalist task list items with accent borders
 *
 * NOTE: This is a thin wrapper. Uses RvnCard.Checkbox and RvnCard.Priority
 * compound components internally but does NOT use RvnCard root — it's a
 * list item with accent border, not a card.
 */

import * as React from 'react'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_SPACING,
} from '../tokens'
import { RvnCard, type PriorityLevel } from './RvnCard'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ObjectivePriority = 'PRIMARY' | 'SECONDARY' | 'OPTIONAL'
type ObjectiveStatus = 'PENDING' | 'ACTIVE' | 'COMPLETE' | 'FAILED'

interface RvnObjectiveItemProps {
  /** Objective label/description */
  label: string
  /** Priority level */
  priority?: ObjectivePriority
  /** Current status */
  status?: ObjectiveStatus
  /** Whether objective is checked/complete */
  checked?: boolean
  /** Change handler for checkbox */
  onCheckedChange?: (checked: boolean) => void
  /** Optional subtext/details */
  subtext?: string
  /** Click handler for the item */
  onClick?: () => void
  /** Additional class names */
  className?: string
  /** Additional inline styles */
  style?: React.CSSProperties
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: RVN_SPACING.s,
    padding: `${RVN_SPACING.s} ${RVN_SPACING.m}`,
    borderLeft: RVN_BORDERS.accent,
    background: RVN_COLORS.surface,
    cursor: 'default',
    transition: 'background 0.1s',
  },
  itemHover: {
    background: RVN_COLORS.surfaceHighlight,
  },
  checkboxWrapper: {
    marginTop: '2px',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: RVN_SPACING.xs,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: RVN_SPACING.s,
  },
  label: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.body,
    fontWeight: RVN_FONT_WEIGHTS.semibold,
    color: RVN_COLORS.textMain,
  },
  labelComplete: {
    textDecoration: 'line-through',
    color: RVN_COLORS.textMuted,
  },
  subtext: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_COLORS.textMuted,
  },
  statusIndicator: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.caption,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    marginLeft: 'auto',
  },
} as const

// -----------------------------------------------------------------------------
// Priority Mapping
// -----------------------------------------------------------------------------

function mapPriority(priority: ObjectivePriority): PriorityLevel {
  switch (priority) {
    case 'PRIMARY':
      return 'primary'
    case 'SECONDARY':
      return 'secondary'
    case 'OPTIONAL':
      return 'optional'
    default:
      return 'optional'
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getAccentColor(priority?: ObjectivePriority, status?: ObjectiveStatus): string {
  if (status === 'COMPLETE') return RVN_COLORS.textMuted
  if (status === 'FAILED') return RVN_COLORS.textMuted
  if (priority === 'PRIMARY') return RVN_COLORS.black
  if (priority === 'SECONDARY') return RVN_COLORS.textMuted
  return RVN_COLORS.black
}

function getStatusText(status?: ObjectiveStatus): string | null {
  switch (status) {
    case 'ACTIVE':
      return 'IN PROGRESS'
    case 'COMPLETE':
      return 'DONE'
    case 'FAILED':
      return 'FAILED'
    default:
      return null
  }
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

/**
 * Objective Item for task/checklist display
 *
 * @example
 * ```tsx
 * <RvnObjectiveItem
 *   label="Secure perimeter access points"
 *   priority="PRIMARY"
 *   status="ACTIVE"
 *   checked={false}
 *   onCheckedChange={(checked) => console.log(checked)}
 * />
 * ```
 */
export const RvnObjectiveItem = React.forwardRef<HTMLDivElement, RvnObjectiveItemProps>(
  function RvnObjectiveItem(
    {
      label,
      priority,
      status,
      checked = false,
      onCheckedChange,
      subtext,
      onClick,
      className,
      style,
    },
    ref
  ) {
    const [isHovered, setIsHovered] = React.useState(false)

    const isComplete = checked || status === 'COMPLETE'
    const isFailed = status === 'FAILED'
    const accentColor = getAccentColor(priority, status)
    const statusText = getStatusText(status)

    const itemStyle: React.CSSProperties = {
      ...styles.item,
      borderLeftColor: accentColor,
      ...(isHovered ? styles.itemHover : {}),
      ...(onClick ? { cursor: 'pointer' } : {}),
      ...style,
    }

    return (
      <div
        ref={ref}
        className={className}
        style={itemStyle}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        data-rvn-objective-item=""
        data-checked={checked || undefined}
        data-status={status}
      >
        {/* Checkbox */}
        {onCheckedChange && (
          <div style={styles.checkboxWrapper}>
            <RvnCard.Checkbox checked={checked} onChange={onCheckedChange} />
          </div>
        )}

        {/* Content */}
        <div style={styles.content}>
          <div style={styles.labelRow}>
            <span
              style={{
                ...styles.label,
                ...(isComplete || isFailed ? styles.labelComplete : {}),
              }}
            >
              {label}
            </span>

            {priority && (
              <RvnCard.Priority level={mapPriority(priority)}>
                {priority}
              </RvnCard.Priority>
            )}

            {statusText && (
              <span
                style={{
                  ...styles.statusIndicator,
                  color: isFailed ? RVN_COLORS.textMuted : RVN_COLORS.textMain,
                }}
              >
                [{statusText}]
              </span>
            )}
          </div>

          {subtext && <span style={styles.subtext}>{subtext}</span>}
        </div>
      </div>
    )
  }
)

RvnObjectiveItem.displayName = 'RvnObjectiveItem'

export type { RvnObjectiveItemProps, ObjectivePriority, ObjectiveStatus }
