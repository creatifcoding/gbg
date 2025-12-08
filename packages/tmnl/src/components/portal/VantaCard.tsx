/**
 * TMNL Vantablack Design System — VantaCard
 *
 * Compound component for rich metadata cards with vantablack aesthetic.
 * Grounded entirely in design system tokens.
 *
 * USAGE:
 * ```tsx
 * <VantaCard variant="elevated">
 *   <VantaCard.Header>
 *     <VantaCard.Title>SYSTEM STATUS</VantaCard.Title>
 *     <VantaCard.Indicator status="active" />
 *   </VantaCard.Header>
 *   <VantaCard.Subtitle>Last updated 2 minutes ago</VantaCard.Subtitle>
 *   <VantaCard.Body>
 *     All systems operational. No incidents reported.
 *   </VantaCard.Body>
 *   <VantaCard.Actions>
 *     <VantaCard.Action onClick={...}>View Details</VantaCard.Action>
 *   </VantaCard.Actions>
 * </VantaCard>
 * ```
 */

import { createContext, useContext, forwardRef, type ReactNode, type CSSProperties } from 'react'
import {
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  VANTA_SPACING,
  VANTA_BORDERS,
  VANTA_ANIMATION,
  VANTA_CARD_VARIANTS,
  type VantaCardVariant,
} from './tokens'

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

interface VantaCardContextValue {
  variant: VantaCardVariant
}

const VantaCardContext = createContext<VantaCardContextValue>({ variant: 'default' })

const useVantaCard = () => useContext(VantaCardContext)

// ─────────────────────────────────────────────────────────────────────────────
// Root Component
// ─────────────────────────────────────────────────────────────────────────────

export interface VantaCardProps {
  children: ReactNode
  variant?: VantaCardVariant
  className?: string
  style?: CSSProperties
  /** Corner decorations (brackets) */
  corners?: boolean
  /** Enable hover glow effect */
  glow?: boolean
  /** Glow accent color */
  glowColor?: 'cyan' | 'emerald' | 'amber' | 'rose'
}

const VantaCardRoot = forwardRef<HTMLDivElement, VantaCardProps>(
  (
    {
      children,
      variant = 'default',
      className = '',
      style,
      corners = false,
      glow = false,
      glowColor = 'cyan',
    },
    ref
  ) => {
    const variantTokens = VANTA_CARD_VARIANTS[variant]

    const glowShadows = {
      cyan: VANTA_BORDERS.shadow.glowCyan,
      emerald: VANTA_BORDERS.shadow.glowEmerald,
      amber: VANTA_BORDERS.shadow.glowAmber,
      rose: VANTA_BORDERS.shadow.glowRose,
    }

    const baseStyles: CSSProperties = {
      position: 'relative',
      background: variantTokens.background,
      border: variantTokens.border,
      borderRadius: variantTokens.borderRadius,
      boxShadow: variantTokens.boxShadow,
      padding: variantTokens.padding,
      transition: VANTA_ANIMATION.transition.all,
      ...style,
    }

    // Hover styles handled via CSS class
    const hoverClass = glow ? 'vanta-card-glow' : ''

    return (
      <VantaCardContext.Provider value={{ variant }}>
        <div
          ref={ref}
          className={`vanta-card ${hoverClass} ${className}`}
          style={baseStyles}
          data-variant={variant}
          data-glow-color={glowColor}
        >
          {/* Corner brackets */}
          {corners && <CornerDecorations />}

          {/* Depth gradient overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: VANTA_COLORS.gradient.depth,
              pointerEvents: 'none',
              borderRadius: variantTokens.borderRadius,
            }}
          />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>

          {/* Glow styles */}
          <style>{`
            .vanta-card-glow:hover {
              box-shadow: ${variantTokens.boxShadow}, ${glowShadows[glowColor]};
            }
            .vanta-card-glow[data-glow-color="cyan"]:hover {
              border-color: ${VANTA_COLORS.accent.cyanMuted};
            }
            .vanta-card-glow[data-glow-color="emerald"]:hover {
              border-color: ${VANTA_COLORS.accent.emeraldMuted};
            }
            .vanta-card-glow[data-glow-color="amber"]:hover {
              border-color: ${VANTA_COLORS.accent.amberMuted};
            }
            .vanta-card-glow[data-glow-color="rose"]:hover {
              border-color: ${VANTA_COLORS.accent.roseMuted};
            }
          `}</style>
        </div>
      </VantaCardContext.Provider>
    )
  }
)

VantaCardRoot.displayName = 'VantaCard'

// ─────────────────────────────────────────────────────────────────────────────
// Corner Decorations
// ─────────────────────────────────────────────────────────────────────────────

function CornerDecorations() {
  const cornerStyle: CSSProperties = {
    position: 'absolute',
    width: '8px',
    height: '8px',
    borderColor: VANTA_COLORS.surface.border,
    borderStyle: 'solid',
    borderWidth: 0,
  }

  return (
    <>
      <div style={{ ...cornerStyle, top: 0, left: 0, borderTopWidth: '1px', borderLeftWidth: '1px' }} />
      <div style={{ ...cornerStyle, top: 0, right: 0, borderTopWidth: '1px', borderRightWidth: '1px' }} />
      <div style={{ ...cornerStyle, bottom: 0, left: 0, borderBottomWidth: '1px', borderLeftWidth: '1px' }} />
      <div style={{ ...cornerStyle, bottom: 0, right: 0, borderBottomWidth: '1px', borderRightWidth: '1px' }} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

function Header({ children, className = '', style }: HeaderProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: VANTA_SPACING['3'],
        marginBottom: VANTA_SPACING['2'],
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Title
// ─────────────────────────────────────────────────────────────────────────────

interface TitleProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

function Title({ children, className = '', style }: TitleProps) {
  return (
    <h3
      className={className}
      style={{
        margin: 0,
        color: VANTA_COLORS.text.primary,
        ...VANTA_TYPOGRAPHY.preset.cardTitle,
        ...style,
      }}
    >
      {children}
    </h3>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtitle
// ─────────────────────────────────────────────────────────────────────────────

interface SubtitleProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

function Subtitle({ children, className = '', style }: SubtitleProps) {
  return (
    <p
      className={className}
      style={{
        margin: 0,
        marginBottom: VANTA_SPACING['3'],
        color: VANTA_COLORS.text.tertiary,
        ...VANTA_TYPOGRAPHY.preset.cardSubtitle,
        ...style,
      }}
    >
      {children}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Body
// ─────────────────────────────────────────────────────────────────────────────

interface BodyProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

function Body({ children, className = '', style }: BodyProps) {
  return (
    <div
      className={className}
      style={{
        color: VANTA_COLORS.text.secondary,
        ...VANTA_TYPOGRAPHY.preset.cardBody,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Indicator
// ─────────────────────────────────────────────────────────────────────────────

type IndicatorStatus = 'active' | 'pending' | 'inactive' | 'idle' | 'error'

interface IndicatorProps {
  status: IndicatorStatus
  label?: string
  pulse?: boolean
  className?: string
  style?: CSSProperties
}

function Indicator({ status, label, pulse = true, className = '', style }: IndicatorProps) {
  const statusColors: Record<IndicatorStatus, { dot: string; text: string; glow: string }> = {
    active: {
      dot: VANTA_COLORS.accent.emerald,
      text: VANTA_COLORS.accent.emerald,
      glow: VANTA_COLORS.accent.emeraldGlow,
    },
    pending: {
      dot: VANTA_COLORS.accent.amber,
      text: VANTA_COLORS.accent.amber,
      glow: VANTA_COLORS.accent.amberGlow,
    },
    inactive: {
      dot: VANTA_COLORS.text.muted,
      text: VANTA_COLORS.text.muted,
      glow: 'transparent',
    },
    idle: {
      dot: VANTA_COLORS.text.tertiary,
      text: VANTA_COLORS.text.tertiary,
      glow: 'transparent',
    },
    error: {
      dot: VANTA_COLORS.accent.rose,
      text: VANTA_COLORS.accent.rose,
      glow: VANTA_COLORS.accent.roseGlow,
    },
  }

  const colors = statusColors[status]

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['2'],
        ...style,
      }}
    >
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          backgroundColor: colors.dot,
          boxShadow: `0 0 8px ${colors.glow}`,
          animation: pulse && status !== 'inactive' && status !== 'idle' ? 'vanta-pulse 2s ease-in-out infinite' : undefined,
        }}
      />
      {label && (
        <span
          style={{
            color: colors.text,
            ...VANTA_TYPOGRAPHY.preset.label,
          }}
        >
          {label}
        </span>
      )}
      <style>{`
        @keyframes vanta-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Actions Container
// ─────────────────────────────────────────────────────────────────────────────

interface ActionsProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

function Actions({ children, className = '', style }: ActionsProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: VANTA_SPACING['2'],
        marginTop: VANTA_SPACING['4'],
        paddingTop: VANTA_SPACING['3'],
        borderTop: VANTA_BORDERS.style.subtle,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Action Button
// ─────────────────────────────────────────────────────────────────────────────

interface ActionProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'ghost'
  disabled?: boolean
  className?: string
  style?: CSSProperties
}

function Action({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  className = '',
  style,
}: ActionProps) {
  const variantStyles: Record<string, CSSProperties> = {
    default: {
      background: 'transparent',
      border: VANTA_BORDERS.style.subtle,
      color: VANTA_COLORS.text.secondary,
    },
    primary: {
      background: VANTA_COLORS.accent.cyanGlow,
      border: `1px solid ${VANTA_COLORS.accent.cyanMuted}`,
      color: VANTA_COLORS.accent.cyan,
    },
    ghost: {
      background: 'transparent',
      border: 'none',
      color: VANTA_COLORS.text.tertiary,
    },
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`vanta-action vanta-action-${variant} ${className}`}
      style={{
        padding: `${VANTA_SPACING['2']} ${VANTA_SPACING['3']}`,
        borderRadius: VANTA_BORDERS.radius.sm,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: VANTA_ANIMATION.transition.colors,
        ...VANTA_TYPOGRAPHY.preset.label,
        ...variantStyles[variant],
        ...style,
      }}
    >
      {children}
      <style>{`
        .vanta-action:hover:not(:disabled) {
          color: ${VANTA_COLORS.text.primary};
          border-color: ${VANTA_COLORS.surface.border};
        }
        .vanta-action-primary:hover:not(:disabled) {
          color: ${VANTA_COLORS.accent.cyan};
          border-color: ${VANTA_COLORS.accent.cyan};
          background: ${VANTA_COLORS.accent.cyanGlow};
        }
        .vanta-action-ghost:hover:not(:disabled) {
          color: ${VANTA_COLORS.text.secondary};
        }
      `}</style>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Label / Value Pair (for metrics)
// ─────────────────────────────────────────────────────────────────────────────

interface LabelValueProps {
  label: string
  value: ReactNode
  accent?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'neutral'
  className?: string
  style?: CSSProperties
}

function LabelValue({ label, value, accent = 'neutral', className = '', style }: LabelValueProps) {
  const accentColors: Record<string, string> = {
    cyan: VANTA_COLORS.accent.cyan,
    emerald: VANTA_COLORS.accent.emerald,
    amber: VANTA_COLORS.accent.amber,
    rose: VANTA_COLORS.accent.rose,
    neutral: VANTA_COLORS.text.primary,
  }

  return (
    <div className={className} style={style}>
      <div
        style={{
          color: VANTA_COLORS.text.muted,
          marginBottom: VANTA_SPACING['1'],
          ...VANTA_TYPOGRAPHY.preset.label,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: accentColors[accent],
          ...VANTA_TYPOGRAPHY.preset.value,
        }}
      >
        {value}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Divider
// ─────────────────────────────────────────────────────────────────────────────

interface DividerProps {
  className?: string
  style?: CSSProperties
}

function Divider({ className = '', style }: DividerProps) {
  return (
    <div
      className={className}
      style={{
        height: '1px',
        background: `linear-gradient(90deg, transparent, ${VANTA_COLORS.surface.border}, transparent)`,
        margin: `${VANTA_SPACING['3']} 0`,
        ...style,
      }}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Compound Export
// ─────────────────────────────────────────────────────────────────────────────

export const VantaCard = Object.assign(VantaCardRoot, {
  Header,
  Title,
  Subtitle,
  Body,
  Indicator,
  Actions,
  Action,
  LabelValue,
  Divider,
})

export type { VantaCardProps, IndicatorStatus }
