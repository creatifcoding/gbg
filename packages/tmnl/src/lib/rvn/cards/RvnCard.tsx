/**
 * RvnCard — Compound Component System
 *
 * Brutalist card component with composable slots.
 * All RVN card variants (equipment, unit, intel, threat, log, objective)
 * compose from these primitives.
 *
 * Usage:
 * ```tsx
 * <RvnCard variant="equipment">
 *   <RvnCard.Header>OPTICS</RvnCard.Header>
 *   <RvnCard.Body>
 *     <RvnCard.Title>MK-IV</RvnCard.Title>
 *     <RvnCard.Status status="nominal">NOMINAL</RvnCard.Status>
 *   </RvnCard.Body>
 * </RvnCard>
 * ```
 */

import * as React from 'react'
import {
  RVN_COLORS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_BORDERS,
  RVN_SPACING,
  RVN_SHADOWS,
  RVN_PATTERNS,
} from '../tokens'

// =============================================================================
// Types
// =============================================================================

type RvnCardVariant =
  | 'default'
  | 'equipment'
  | 'unit'
  | 'intel'
  | 'threat'
  | 'log'
  | 'objective'

type StatusType = 'nominal' | 'hot' | 'alert' | 'offline' | 'standby' | 'critical'

interface RvnCardContextValue {
  variant: RvnCardVariant
  pressed: boolean
  disabled: boolean
  selected: boolean
}

// =============================================================================
// Context
// =============================================================================

const RvnCardContext = React.createContext<RvnCardContextValue>({
  variant: 'default',
  pressed: false,
  disabled: false,
  selected: false,
})

const useRvnCard = () => React.useContext(RvnCardContext)

// =============================================================================
// Root Component
// =============================================================================

interface RvnCardRootProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card variant determines styling context */
  variant?: RvnCardVariant
  /** Selected state (inverted colors) */
  selected?: boolean
  /** Disabled/offline state */
  disabled?: boolean
  /** Shadow size */
  shadow?: 'default' | 'lg' | 'none'
  /** Children */
  children: React.ReactNode
}

const RvnCardRoot = React.forwardRef<HTMLDivElement, RvnCardRootProps>(
  function RvnCardRoot(
    {
      variant = 'default',
      selected = false,
      disabled = false,
      shadow = 'default',
      onClick,
      children,
      style,
      ...props
    },
    ref
  ) {
    const [pressed, setPressed] = React.useState(false)

    const cardStyle: React.CSSProperties = {
      border: RVN_BORDERS.card,
      background: selected ? RVN_COLORS.black : RVN_COLORS.surface,
      color: selected ? RVN_COLORS.white : RVN_COLORS.textMain,
      boxShadow: pressed
        ? 'none'
        : shadow === 'none'
          ? 'none'
          : shadow === 'lg'
            ? RVN_SHADOWS.lg
            : RVN_SHADOWS.default,
      transform: pressed ? 'translate(4px, 4px)' : 'none',
      display: 'flex',
      flexDirection: 'column',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 0.1s, transform 0.1s',
      opacity: disabled ? 0.5 : 1,
      ...style,
    }

    const contextValue = React.useMemo<RvnCardContextValue>(
      () => ({ variant, pressed, disabled, selected }),
      [variant, pressed, disabled, selected]
    )

    return (
      <RvnCardContext.Provider value={contextValue}>
        <div
          ref={ref}
          style={cardStyle}
          onClick={disabled ? undefined : onClick}
          onMouseDown={() => onClick && !disabled && setPressed(true)}
          onMouseUp={() => setPressed(false)}
          onMouseLeave={() => setPressed(false)}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick && !disabled ? 0 : undefined}
          data-rvn-card=""
          data-variant={variant}
          data-selected={selected || undefined}
          data-disabled={disabled || undefined}
          {...props}
        >
          {children}
        </div>
      </RvnCardContext.Provider>
    )
  }
)

RvnCardRoot.displayName = 'RvnCard'

// =============================================================================
// Header Slot
// =============================================================================

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Classification level styling (for intel cards) */
  classification?: boolean
  children: React.ReactNode
}

const Header = React.forwardRef<HTMLDivElement, HeaderProps>(
  function Header({ classification = false, children, style, ...props }, ref) {
    const { selected } = useRvnCard()

    const headerStyle: React.CSSProperties = classification
      ? {
          background: RVN_COLORS.black,
          color: RVN_COLORS.white,
          fontFamily: RVN_FONTS.mono,
          fontSize: RVN_FONT_SIZES.label,
          fontWeight: RVN_FONT_WEIGHTS.bold,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          padding: `${RVN_SPACING.xs} ${RVN_SPACING.s}`,
          ...style,
        }
      : {
          borderBottom: `1px solid ${selected ? RVN_COLORS.white : RVN_COLORS.borderMuted}`,
          padding: RVN_SPACING.s,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          ...style,
        }

    return (
      <div ref={ref} style={headerStyle} data-rvn-card-header="" {...props}>
        {children}
      </div>
    )
  }
)

Header.displayName = 'RvnCard.Header'

// =============================================================================
// Body Slot
// =============================================================================

interface BodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Body = React.forwardRef<HTMLDivElement, BodyProps>(
  function Body({ children, style, ...props }, ref) {
    const { disabled } = useRvnCard()

    const bodyStyle: React.CSSProperties = {
      padding: RVN_SPACING.s,
      display: 'flex',
      flexDirection: 'column',
      gap: RVN_SPACING.xs,
      opacity: disabled ? 0.5 : 1,
      ...style,
    }

    return (
      <div ref={ref} style={bodyStyle} data-rvn-card-body="" {...props}>
        {children}
      </div>
    )
  }
)

Body.displayName = 'RvnCard.Body'

// =============================================================================
// Title Slot
// =============================================================================

interface TitleProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Title = React.forwardRef<HTMLDivElement, TitleProps>(
  function Title({ children, style, ...props }, ref) {
    const { selected } = useRvnCard()

    const titleStyle: React.CSSProperties = {
      fontFamily: RVN_FONTS.mono,
      fontSize: RVN_FONT_SIZES.bodyLg,
      fontWeight: RVN_FONT_WEIGHTS.bold,
      color: selected ? RVN_COLORS.white : RVN_COLORS.textMain,
      ...style,
    }

    return (
      <div ref={ref} style={titleStyle} data-rvn-card-title="" {...props}>
        {children}
      </div>
    )
  }
)

Title.displayName = 'RvnCard.Title'

// =============================================================================
// Subtitle Slot
// =============================================================================

interface SubtitleProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Subtitle = React.forwardRef<HTMLDivElement, SubtitleProps>(
  function Subtitle({ children, style, ...props }, ref) {
    const { selected } = useRvnCard()

    const subtitleStyle: React.CSSProperties = {
      fontFamily: RVN_FONTS.sans,
      fontSize: RVN_FONT_SIZES.body,
      fontWeight: RVN_FONT_WEIGHTS.regular,
      color: selected ? RVN_COLORS.textSubtle : RVN_COLORS.textMuted,
      lineHeight: 1.4,
      ...style,
    }

    return (
      <div ref={ref} style={subtitleStyle} data-rvn-card-subtitle="" {...props}>
        {children}
      </div>
    )
  }
)

Subtitle.displayName = 'RvnCard.Subtitle'

// =============================================================================
// Category Slot
// =============================================================================

interface CategoryProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Category = React.forwardRef<HTMLDivElement, CategoryProps>(
  function Category({ children, style, ...props }, ref) {
    const { selected } = useRvnCard()

    const categoryStyle: React.CSSProperties = {
      fontFamily: RVN_FONTS.mono,
      fontSize: RVN_FONT_SIZES.label,
      fontWeight: RVN_FONT_WEIGHTS.regular,
      color: selected ? RVN_COLORS.textSubtle : RVN_COLORS.textMuted,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      ...style,
    }

    return (
      <div ref={ref} style={categoryStyle} data-rvn-card-category="" {...props}>
        {children}
      </div>
    )
  }
)

Category.displayName = 'RvnCard.Category'

// =============================================================================
// Status Slot
// =============================================================================

interface StatusProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: StatusType
  children: React.ReactNode
}

function getStatusStyle(status: StatusType, selected: boolean): React.CSSProperties {
  if (selected) {
    return {
      background: RVN_COLORS.white,
      color: RVN_COLORS.black,
    }
  }

  switch (status) {
    case 'nominal':
    case 'hot':
      return {
        background: RVN_COLORS.black,
        color: RVN_COLORS.white,
        fontWeight: status === 'hot' ? RVN_FONT_WEIGHTS.black : RVN_FONT_WEIGHTS.bold,
      }
    case 'alert':
      return {
        background: RVN_COLORS.white,
        color: RVN_COLORS.black,
        border: `2px solid ${RVN_COLORS.black}`,
      }
    case 'critical':
      return {
        background: RVN_PATTERNS.criticalStripe,
        color: RVN_COLORS.black,
        border: `2px solid ${RVN_COLORS.black}`,
      }
    case 'offline':
      return {
        background: RVN_COLORS.surfaceHighlight,
        color: RVN_COLORS.textMuted,
      }
    case 'standby':
      return {
        background: RVN_COLORS.surfaceHighlight,
        color: RVN_COLORS.textMain,
        border: `1px solid ${RVN_COLORS.border}`,
      }
    default:
      return {
        background: RVN_COLORS.black,
        color: RVN_COLORS.white,
      }
  }
}

const Status = React.forwardRef<HTMLSpanElement, StatusProps>(
  function Status({ status = 'nominal', children, style, ...props }, ref) {
    const { selected } = useRvnCard()

    const statusStyle: React.CSSProperties = {
      fontSize: RVN_FONT_SIZES.label,
      fontWeight: RVN_FONT_WEIGHTS.bold,
      padding: '2px 6px',
      display: 'inline-block',
      textTransform: 'uppercase',
      alignSelf: 'flex-start',
      ...getStatusStyle(status, selected),
      ...style,
    }

    return (
      <span ref={ref} style={statusStyle} data-rvn-card-status={status} {...props}>
        {children}
      </span>
    )
  }
)

Status.displayName = 'RvnCard.Status'

// =============================================================================
// Telemetry Slot (Progress Bar)
// =============================================================================

interface TelemetryProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Progress value 0-100 */
  value: number
  /** Whether value is critical (below 30) */
  critical?: boolean
  /** Optional label */
  label?: string
  children?: React.ReactNode
}

const Telemetry = React.forwardRef<HTMLDivElement, TelemetryProps>(
  function Telemetry({ value, critical, label, children, style, ...props }, ref) {
    const { selected } = useRvnCard()
    const isCritical = critical ?? value < 30

    return (
      <div ref={ref} style={style} data-rvn-card-telemetry="" {...props}>
        {(label || children) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: RVN_SPACING.xs,
            }}
          >
            <span
              style={{
                fontSize: RVN_FONT_SIZES.label,
                color: selected ? RVN_COLORS.textSubtle : RVN_COLORS.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {label || children}
            </span>
            <span
              style={{
                fontFamily: RVN_FONTS.mono,
                fontSize: RVN_FONT_SIZES.label,
                fontWeight: RVN_FONT_WEIGHTS.bold,
                color: selected ? RVN_COLORS.white : RVN_COLORS.textMain,
              }}
            >
              {value}%
            </span>
          </div>
        )}
        <div
          style={{
            height: '12px',
            background: RVN_COLORS.surface,
            border: `2px solid ${RVN_COLORS.black}`,
            width: '100%',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${value}%`,
              background: isCritical ? RVN_PATTERNS.criticalStripe : RVN_COLORS.black,
              transition: 'width 0.2s ease-out',
            }}
          />
        </div>
      </div>
    )
  }
)

Telemetry.displayName = 'RvnCard.Telemetry'

// =============================================================================
// Stat Slot (Label/Value Pair)
// =============================================================================

interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: string | number
  /** Optional unit suffix */
  unit?: string
  /** Layout orientation */
  orientation?: 'horizontal' | 'vertical'
}

const Stat = React.forwardRef<HTMLDivElement, StatProps>(
  function Stat(
    { label, value, unit, orientation = 'horizontal', style, ...props },
    ref
  ) {
    const { selected } = useRvnCard()

    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: orientation === 'horizontal' ? 'row' : 'column',
      justifyContent: orientation === 'horizontal' ? 'space-between' : 'flex-start',
      alignItems: orientation === 'horizontal' ? 'center' : 'flex-start',
      gap: orientation === 'horizontal' ? RVN_SPACING.m : RVN_SPACING.xs,
      ...style,
    }

    return (
      <div ref={ref} style={containerStyle} data-rvn-card-stat="" {...props}>
        <span
          style={{
            fontSize: RVN_FONT_SIZES.label,
            color: selected ? RVN_COLORS.textSubtle : RVN_COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: RVN_FONTS.mono,
            fontSize: RVN_FONT_SIZES.label,
            fontWeight: RVN_FONT_WEIGHTS.bold,
            color: selected ? RVN_COLORS.white : RVN_COLORS.textMain,
          }}
        >
          {value}
          {unit && (
            <span style={{ color: RVN_COLORS.textMuted, marginLeft: '2px' }}>
              {unit}
            </span>
          )}
        </span>
      </div>
    )
  }
)

Stat.displayName = 'RvnCard.Stat'

// =============================================================================
// StatGroup Slot
// =============================================================================

interface StatGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of columns (default 2) */
  columns?: number
  children: React.ReactNode
}

const StatGroup = React.forwardRef<HTMLDivElement, StatGroupProps>(
  function StatGroup({ columns = 2, children, style, ...props }, ref) {
    const groupStyle: React.CSSProperties = {
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: RVN_SPACING.s,
      ...style,
    }

    return (
      <div ref={ref} style={groupStyle} data-rvn-card-stat-group="" {...props}>
        {children}
      </div>
    )
  }
)

StatGroup.displayName = 'RvnCard.StatGroup'

// =============================================================================
// Indicator Slot (Status Dot)
// =============================================================================

interface IndicatorProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: 'active' | 'alert' | 'offline' | 'nominal'
}

const Indicator = React.forwardRef<HTMLSpanElement, IndicatorProps>(
  function Indicator({ status = 'nominal', style, ...props }, ref) {
    const colorMap: Record<string, string> = {
      active: RVN_COLORS.black,
      alert: RVN_COLORS.black,
      offline: RVN_COLORS.textMuted,
      nominal: RVN_COLORS.black,
    }

    const indicatorStyle: React.CSSProperties = {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: colorMap[status],
      display: 'inline-block',
      ...style,
    }

    return (
      <span
        ref={ref}
        style={indicatorStyle}
        data-rvn-card-indicator={status}
        {...props}
      />
    )
  }
)

Indicator.displayName = 'RvnCard.Indicator'

// =============================================================================
// Actions Slot
// =============================================================================

interface ActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Actions = React.forwardRef<HTMLDivElement, ActionsProps>(
  function Actions({ children, style, ...props }, ref) {
    const { selected } = useRvnCard()

    const actionsStyle: React.CSSProperties = {
      borderTop: `1px solid ${selected ? RVN_COLORS.white : RVN_COLORS.borderMuted}`,
      padding: RVN_SPACING.s,
      display: 'flex',
      gap: RVN_SPACING.s,
      ...style,
    }

    return (
      <div ref={ref} style={actionsStyle} data-rvn-card-actions="" {...props}>
        {children}
      </div>
    )
  }
)

Actions.displayName = 'RvnCard.Actions'

// =============================================================================
// Action Button Slot
// =============================================================================

interface ActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

const Action = React.forwardRef<HTMLButtonElement, ActionProps>(
  function Action({ children, onClick, style, ...props }, ref) {
    const { selected, disabled } = useRvnCard()
    const [pressed, setPressed] = React.useState(false)

    const buttonStyle: React.CSSProperties = {
      background: selected ? RVN_COLORS.white : 'transparent',
      border: RVN_BORDERS.primary,
      borderColor: selected ? RVN_COLORS.white : RVN_COLORS.black,
      color: selected ? RVN_COLORS.black : RVN_COLORS.textMain,
      padding: '8px 12px',
      fontFamily: RVN_FONTS.sans,
      fontWeight: RVN_FONT_WEIGHTS.bold,
      fontSize: RVN_FONT_SIZES.label,
      textTransform: 'uppercase',
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: pressed ? 'none' : RVN_SHADOWS.default,
      transform: pressed ? 'translate(4px, 4px)' : 'none',
      transition: 'all 0.1s',
      opacity: disabled ? 0.5 : 1,
      ...style,
    }

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation()
      onClick?.(e)
    }

    return (
      <button
        ref={ref}
        style={buttonStyle}
        onClick={handleClick}
        onMouseDown={() => !disabled && setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        disabled={disabled}
        data-rvn-card-action=""
        {...props}
      >
        {children}
      </button>
    )
  }
)

Action.displayName = 'RvnCard.Action'

// =============================================================================
// Footer Slot
// =============================================================================

interface FooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Footer = React.forwardRef<HTMLDivElement, FooterProps>(
  function Footer({ children, style, ...props }, ref) {
    const footerStyle: React.CSSProperties = {
      borderTop: `1px solid ${RVN_COLORS.borderMuted}`,
      padding: `${RVN_SPACING.xs} ${RVN_SPACING.s}`,
      fontFamily: RVN_FONTS.mono,
      fontSize: RVN_FONT_SIZES.caption,
      color: RVN_COLORS.textMuted,
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      ...style,
    }

    return (
      <div ref={ref} style={footerStyle} data-rvn-card-footer="" {...props}>
        {children}
      </div>
    )
  }
)

Footer.displayName = 'RvnCard.Footer'

// =============================================================================
// Divider Slot
// =============================================================================

interface DividerProps extends React.HTMLAttributes<HTMLSpanElement> {}

const Divider = React.forwardRef<HTMLSpanElement, DividerProps>(
  function Divider({ style, ...props }, ref) {
    return (
      <span
        ref={ref}
        style={{ color: RVN_COLORS.textMuted, ...style }}
        data-rvn-card-divider=""
        {...props}
      >
        *
      </span>
    )
  }
)

Divider.displayName = 'RvnCard.Divider'

// =============================================================================
// Meter Slot (Threat Level)
// =============================================================================

type MeterLevel = 'minimal' | 'low' | 'moderate' | 'high' | 'critical'

interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  level: MeterLevel
  showLabel?: boolean
}

const LEVEL_COLORS: Record<MeterLevel, string> = {
  minimal: '#00ff00',
  low: '#88ff00',
  moderate: '#ffff00',
  high: '#ff8800',
  critical: '#ff0000',
}

const LEVEL_PERCENTAGES: Record<MeterLevel, number> = {
  minimal: 20,
  low: 40,
  moderate: 60,
  high: 80,
  critical: 100,
}

const CRITICAL_STRIPE =
  'repeating-linear-gradient(45deg, #ff0000, #ff0000 5px, #000000 5px, #000000 10px)'

const Meter = React.forwardRef<HTMLDivElement, MeterProps>(
  function Meter({ level, showLabel = true, style, ...props }, ref) {
    const percentage = LEVEL_PERCENTAGES[level]
    const isCritical = level === 'critical'

    return (
      <div
        ref={ref}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          ...style,
        }}
        data-rvn-card-meter={level}
        {...props}
      >
        {showLabel && (
          <span
            style={{
              fontFamily: RVN_FONTS.mono,
              fontSize: RVN_FONT_SIZES.caption,
              fontWeight: RVN_FONT_WEIGHTS.bold,
              textTransform: 'uppercase',
              color: RVN_COLORS.textMuted,
            }}
          >
            {level}
          </span>
        )}
        <div
          style={{
            width: '60px',
            height: '10px',
            background: RVN_COLORS.surfaceHighlight,
            border: `1px solid ${RVN_COLORS.black}`,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              background: isCritical ? CRITICAL_STRIPE : LEVEL_COLORS[level],
              transition: 'width 0.2s ease-out',
            }}
          />
        </div>
      </div>
    )
  }
)

Meter.displayName = 'RvnCard.Meter'

// =============================================================================
// Badge Slot (Log Level)
// =============================================================================

type BadgeLevel = 'info' | 'alert' | 'warning' | 'error' | 'success' | 'debug'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level?: BadgeLevel
  children: React.ReactNode
}

function getBadgeStyle(level: BadgeLevel): React.CSSProperties {
  switch (level) {
    case 'alert':
    case 'error':
      return {
        background: RVN_COLORS.black,
        color: RVN_COLORS.white,
      }
    case 'warning':
      return {
        background: RVN_COLORS.white,
        color: RVN_COLORS.black,
        border: `1px solid ${RVN_COLORS.black}`,
      }
    case 'success':
      return {
        background: RVN_COLORS.surfaceHighlight,
        color: RVN_COLORS.textMain,
        border: `1px solid ${RVN_COLORS.black}`,
      }
    case 'debug':
      return {
        background: RVN_COLORS.surfaceMuted,
        color: RVN_COLORS.textMuted,
      }
    case 'info':
    default:
      return {
        background: 'transparent',
        color: RVN_COLORS.textMuted,
        border: `1px solid ${RVN_COLORS.borderMuted}`,
      }
  }
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge({ level = 'info', children, style, ...props }, ref) {
    const badgeStyle: React.CSSProperties = {
      fontSize: RVN_FONT_SIZES.caption,
      fontWeight: RVN_FONT_WEIGHTS.bold,
      padding: '0 4px',
      textTransform: 'uppercase',
      flexShrink: 0,
      ...getBadgeStyle(level),
      ...style,
    }

    return (
      <span ref={ref} style={badgeStyle} data-rvn-card-badge={level} {...props}>
        {children}
      </span>
    )
  }
)

Badge.displayName = 'RvnCard.Badge'

// =============================================================================
// Checkbox Slot
// =============================================================================

interface CheckboxProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean
  onChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLDivElement, CheckboxProps>(
  function Checkbox({ checked = false, onChange, style, ...props }, ref) {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      onChange?.(!checked)
    }

    const checkboxStyle: React.CSSProperties = {
      width: '16px',
      height: '16px',
      border: `2px solid ${RVN_COLORS.black}`,
      background: checked ? RVN_COLORS.black : RVN_COLORS.surface,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }

    return (
      <div
        ref={ref}
        style={checkboxStyle}
        onClick={handleClick}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        data-rvn-card-checkbox=""
        {...props}
      >
        {checked && (
          <span
            style={{
              fontSize: '12px',
              fontWeight: RVN_FONT_WEIGHTS.black,
              lineHeight: 1,
              color: RVN_COLORS.white,
            }}
          >
            X
          </span>
        )}
      </div>
    )
  }
)

Checkbox.displayName = 'RvnCard.Checkbox'

// =============================================================================
// Priority Badge Slot
// =============================================================================

type PriorityLevel = 'primary' | 'secondary' | 'optional' | 'low' | 'medium' | 'high' | 'critical'

interface PriorityProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: PriorityLevel
  children?: React.ReactNode
}

function getPriorityStyle(level: PriorityLevel): React.CSSProperties {
  switch (level) {
    case 'primary':
    case 'high':
    case 'critical':
      return {
        background: RVN_COLORS.black,
        color: RVN_COLORS.white,
      }
    case 'secondary':
    case 'medium':
      return {
        background: RVN_COLORS.surfaceHighlight,
        color: RVN_COLORS.textMain,
        border: `1px solid ${RVN_COLORS.black}`,
      }
    case 'optional':
    case 'low':
    default:
      return {
        background: 'transparent',
        color: RVN_COLORS.textMuted,
        border: `1px solid ${RVN_COLORS.borderMuted}`,
      }
  }
}

const Priority = React.forwardRef<HTMLSpanElement, PriorityProps>(
  function Priority({ level, children, style, ...props }, ref) {
    const priorityStyle: React.CSSProperties = {
      fontFamily: RVN_FONTS.mono,
      fontSize: RVN_FONT_SIZES.label,
      fontWeight: RVN_FONT_WEIGHTS.bold,
      padding: '1px 4px',
      textTransform: 'uppercase',
      ...getPriorityStyle(level),
      ...style,
    }

    return (
      <span ref={ref} style={priorityStyle} data-rvn-card-priority={level} {...props}>
        {children || level.toUpperCase()}
      </span>
    )
  }
)

Priority.displayName = 'RvnCard.Priority'

// =============================================================================
// Export Compound Component
// =============================================================================

export const RvnCard = Object.assign(RvnCardRoot, {
  Header,
  Body,
  Title,
  Subtitle,
  Category,
  Status,
  Telemetry,
  Stat,
  StatGroup,
  Indicator,
  Actions,
  Action,
  Footer,
  Divider,
  Meter,
  Badge,
  Checkbox,
  Priority,
})

export { useRvnCard }
export type {
  RvnCardVariant,
  RvnCardContextValue,
  StatusType,
  MeterLevel,
  BadgeLevel,
  PriorityLevel,
}
