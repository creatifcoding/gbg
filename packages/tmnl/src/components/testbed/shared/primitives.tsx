/**
 * Testbed Primitives
 *
 * Core UI components shared across all testbed pages.
 * These are the building blocks for consistent testbed layout.
 *
 * @provenance
 * ────────────────────────────────────────────────────────────────────────────
 * COMPONENT              │ EXTRACTED FROM                     │ DATE
 * ────────────────────────────────────────────────────────────────────────────
 * SectionLabel           │ EffectAtomTestbed.tsx:251-259      │ 2025-12-02
 *                        │ VantaCardTestbed.tsx (gradient)    │
 *                        │ ChartingTestbed.tsx                │
 *                        │ 6+ implementations consolidated    │
 * ────────────────────────────────────────────────────────────────────────────
 * TestCard               │ CapabilityTestbed.tsx              │ 2025-12-02
 *                        │ TraitTestbed.tsx                   │
 *                        │ BaseModalTestbed.tsx               │
 *                        │ 4+ implementations consolidated    │
 * ────────────────────────────────────────────────────────────────────────────
 * CollapsiblePanel       │ EffectAtomTestbed.tsx:546-594      │ 2025-12-02
 *                        │ DataManagerTestbed.tsx             │
 * ────────────────────────────────────────────────────────────────────────────
 * Button                 │ EffectAtomTestbed.tsx:286-314      │ 2025-12-02
 *                        │ Used across all testbeds           │
 * ────────────────────────────────────────────────────────────────────────────
 * StatusIndicator        │ EffectAtomTestbed.tsx:319-343      │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 * ValueDisplay           │ EffectAtomTestbed.tsx:265-281      │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 * DemoSection            │ SliderTestbed.tsx                  │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 * TestbedHeader          │ Multiple testbeds (pattern)        │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 * VersionBadge           │ DataManagerTestbed.tsx             │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 * ControlGroup           │ SliderTestbed.tsx                  │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 * CodeBlock              │ TraitTestbed.tsx                   │ 2025-12-02
 * ────────────────────────────────────────────────────────────────────────────
 *
 * RATIONALE:
 * These primitives were duplicated ad-hoc across 6+ testbed files. Each had
 * slight variations in typography (Tailwind classes vs CSS variables) and
 * spacing. This extraction:
 *
 * 1. Enforces 12px minimum typography floor via CSS variables
 * 2. Consolidates visual patterns into canonical implementations
 * 3. Provides AI-navigable component inventory (llm.txt compliance)
 * 4. Serves as springboard for promotion to TMNL design system
 *
 * TYPOGRAPHY PATTERN:
 * All components use `style={{ fontSize: 'var(--tmnl-text-*, fallback)' }}`
 * rather than Tailwind `text-*` classes. This enables ScaleProvider scaling.
 *
 * @see ScaleProvider for CSS variable injection
 * @see VANTA_TYPOGRAPHY for token definitions
 */

import { useState, type ReactNode, type CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { VANTA_COLORS, VANTA_TYPOGRAPHY } from '@/components/portal'

// =============================================================================
// SECTION LABEL
// =============================================================================

export interface SectionLabelProps {
  children: ReactNode
  /** Visual variant */
  variant?: 'default' | 'gradient' | 'minimal'
  className?: string
}

/**
 * Section label with optional gradient lines.
 * Use `variant="gradient"` for VantaCard-style decorative lines.
 */
export function SectionLabel({
  children,
  variant = 'default',
  className = '',
}: SectionLabelProps) {
  if (variant === 'gradient') {
    return (
      <div className={`flex items-center gap-3 mb-6 ${className}`}>
        <div className="h-px flex-1 bg-gradient-to-r from-neutral-800 to-transparent" />
        <span
          style={{
            ...VANTA_TYPOGRAPHY.preset.label,
            color: VANTA_COLORS.text.muted,
          }}
        >
          {children}
        </span>
        <div className="h-px flex-1 bg-gradient-to-l from-neutral-800 to-transparent" />
      </div>
    )
  }

  if (variant === 'minimal') {
    return (
      <h2
        className={`font-mono uppercase tracking-widest text-neutral-400 mb-4 ${className}`}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {children}
      </h2>
    )
  }

  // Default: border-bottom style
  return (
    <h2
      className={`font-mono uppercase tracking-widest text-neutral-400 mb-4 border-b border-neutral-800 pb-2 ${className}`}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
    >
      {children}
    </h2>
  )
}

// =============================================================================
// TEST CARD
// =============================================================================

export interface TestCardProps {
  /** Title text (preferred) */
  title?: string
  /** Alias for title - use either title OR label */
  label?: string
  /** Description text below title */
  description?: string
  /** Optional actions slot (right-aligned in header) */
  actions?: ReactNode
  children: ReactNode
  className?: string
  /**
   * Visual variant:
   * - 'full' (default): bordered card with header/body separation
   * - 'compact': minimal spacing, no border, inline header
   */
  variant?: 'full' | 'compact'
}

/**
 * Card wrapper for individual test cases.
 *
 * Supports two usage patterns:
 * 1. Full card: `<TestCard title="Test" description="...">...</TestCard>`
 * 2. Compact: `<TestCard label="Test" actions={<Button />}>...</TestCard>`
 *
 * @provenance
 * - 'full' variant: CapabilityTestbed, TraitTestbed, BaseModalTestbed
 * - 'compact' variant: DataGridTestbed (label/actions pattern)
 */
export function TestCard({
  title,
  label,
  description,
  actions,
  children,
  className = '',
  variant = 'full',
}: TestCardProps) {
  const displayTitle = title ?? label ?? 'Untitled'

  if (variant === 'compact') {
    return (
      <div className={`space-y-2 ${className}`}>
        <div className="flex items-center justify-between">
          <div
            className="font-mono uppercase tracking-widest text-neutral-600"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {displayTitle}
          </div>
          {actions}
        </div>
        {children}
      </div>
    )
  }

  // Default: full variant
  return (
    <div className={`border border-neutral-800 rounded-lg overflow-hidden ${className}`}>
      <div className="px-4 py-3 bg-neutral-900/50 border-b border-neutral-800 flex items-center justify-between">
        <div>
          <h3 className="font-mono text-neutral-200" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
            {displayTitle}
          </h3>
          {description && (
            <p className="text-neutral-500 mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// =============================================================================
// COLLAPSIBLE PANEL
// =============================================================================

export interface CollapsiblePanelProps {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  badge?: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Expandable/collapsible container for grouping content.
 */
export function CollapsiblePanel({
  title,
  subtitle,
  defaultOpen = false,
  badge,
  children,
  className = '',
}: CollapsiblePanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={`border border-neutral-800 bg-neutral-900/50 rounded ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 text-left flex items-center justify-between hover:bg-neutral-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div>
            <h3
              className="font-mono tracking-wide text-neutral-200"
              style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-neutral-500 mt-1" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                {subtitle}
              </p>
            )}
          </div>
          {badge}
        </div>
        <span
          className="text-neutral-500 font-mono"
          style={{ fontSize: 'var(--tmnl-text-xl, 20px)' }}
        >
          {isOpen ? '−' : '+'}
        </span>
      </button>
      {isOpen && (
        <div className="border-t border-neutral-800 p-4">{children}</div>
      )}
    </div>
  )
}

// =============================================================================
// BUTTON
// =============================================================================

export interface ButtonProps {
  children: ReactNode
  onClick?: () => void
  variant?: 'default' | 'primary' | 'danger' | 'ghost'
  disabled?: boolean
  className?: string
  style?: CSSProperties
}

/**
 * Standard testbed button with variants.
 */
export function Button({
  children,
  onClick,
  variant = 'default',
  disabled = false,
  className = '',
  style,
}: ButtonProps) {
  const variantClasses = {
    default: 'bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700',
    primary: 'bg-cyan-900/50 text-cyan-400 border-cyan-800 hover:bg-cyan-800/50',
    danger: 'bg-red-900/50 text-red-400 border-red-800 hover:bg-red-800/50',
    ghost: 'bg-transparent text-neutral-400 border-transparent hover:text-neutral-200',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 font-mono uppercase tracking-wider transition-colors border rounded ${variantClasses[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      style={{ fontSize: 'var(--tmnl-text-sm, 14px)', ...style }}
    >
      {children}
    </button>
  )
}

// =============================================================================
// STATUS INDICATOR
// =============================================================================

export interface StatusIndicatorProps {
  status: 'success' | 'warning' | 'error' | 'neutral' | 'pending'
  label: string
  pulse?: boolean
  className?: string
}

/**
 * Status dot with label.
 */
export function StatusIndicator({
  status,
  label,
  pulse = false,
  className = '',
}: StatusIndicatorProps) {
  const statusColors = {
    success: { dot: 'bg-green-400', text: 'text-green-400' },
    warning: { dot: 'bg-amber-400', text: 'text-amber-400' },
    error: { dot: 'bg-red-400', text: 'text-red-400' },
    neutral: { dot: 'bg-neutral-500', text: 'text-neutral-400' },
    pending: { dot: 'bg-cyan-400', text: 'text-cyan-400' },
  }

  const colors = statusColors[status]

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`w-2 h-2 rounded-full ${colors.dot} ${pulse ? 'animate-pulse' : ''}`}
      />
      <span
        className={`font-mono uppercase tracking-wider ${colors.text}`}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {label}
      </span>
    </div>
  )
}

// =============================================================================
// VALUE DISPLAY
// =============================================================================

export interface ValueDisplayProps {
  label: string
  value: ReactNode
  unit?: string
  accent?: 'cyan' | 'amber' | 'green' | 'rose' | 'neutral'
  size?: 'sm' | 'base' | 'lg'
  className?: string
}

/**
 * Label/value pair display.
 */
export function ValueDisplay({
  label,
  value,
  unit,
  accent = 'neutral',
  size = 'base',
  className = '',
}: ValueDisplayProps) {
  const accentColors = {
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    green: 'text-green-400',
    rose: 'text-rose-400',
    neutral: 'text-neutral-100',
  }

  const sizeStyles = {
    sm: 'var(--tmnl-text-sm, 14px)',
    base: 'var(--tmnl-text-base, 16px)',
    lg: 'var(--tmnl-text-lg, 18px)',
  }

  return (
    <div
      className={`flex items-center gap-3 font-mono ${className}`}
      style={{ fontSize: sizeStyles[size] }}
    >
      <span className="text-neutral-500">{label}:</span>
      <span className={accentColors[accent]}>
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit && <span className="text-neutral-600 ml-1">{unit}</span>}
      </span>
    </div>
  )
}

// =============================================================================
// DEMO SECTION
// =============================================================================

export interface DemoSectionProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/**
 * Container for demo content within test cards.
 */
export function DemoSection({
  title,
  description,
  children,
  className = '',
}: DemoSectionProps) {
  return (
    <div className={`p-4 bg-neutral-900/50 rounded-lg border border-neutral-800 ${className}`}>
      <h4
        className="font-mono font-bold text-neutral-100 mb-1"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {title}
      </h4>
      {description && (
        <p className="text-neutral-400 mb-3" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {description}
        </p>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  )
}

// =============================================================================
// TESTBED HEADER
// =============================================================================

export interface TestbedHeaderProps {
  title: string
  subtitle?: string
  backLink?: string
  actions?: ReactNode
}

/**
 * Standard testbed page header with back link.
 */
export function TestbedHeader({
  title,
  subtitle,
  backLink = '/',
  actions,
}: TestbedHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between">
        <div>
          <Link
            to={backLink}
            className="text-cyan-400 hover:underline mb-4 block"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-mono font-bold mb-2">{title}</h1>
          {subtitle && <p className="text-neutral-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}

// =============================================================================
// VERSION BADGE
// =============================================================================

export interface VersionBadgeProps {
  version: string
  status?: 'active' | 'legacy' | 'new' | 'experimental'
}

/**
 * Version indicator badge.
 */
export function VersionBadge({ version, status = 'active' }: VersionBadgeProps) {
  const statusColors = {
    active: 'bg-emerald-900/50 text-emerald-400 border-emerald-700',
    legacy: 'bg-neutral-800 text-neutral-400 border-neutral-600',
    new: 'bg-cyan-900/50 text-cyan-400 border-cyan-700',
    experimental: 'bg-amber-900/50 text-amber-400 border-amber-700',
  }

  return (
    <span
      className={`px-2 py-0.5 font-mono rounded border ${statusColors[status]}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {version.toUpperCase()}
      {status === 'new' && ' ✦'}
      {status === 'experimental' && ' ⚗'}
    </span>
  )
}

// =============================================================================
// CONTROL GROUP
// =============================================================================

export interface ControlGroupProps {
  label: string
  children: ReactNode
  className?: string
}

/**
 * Label + control inline layout.
 */
export function ControlGroup({ label, children, className = '' }: ControlGroupProps) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <label
        className="text-neutral-400 w-24 shrink-0"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {label}
      </label>
      <div className="flex-1">{children}</div>
    </div>
  )
}

// =============================================================================
// CODE BLOCK
// =============================================================================

export interface CodeBlockProps {
  children: string
  language?: string
  className?: string
}

/**
 * Formatted code display.
 */
export function CodeBlock({ children, className = '' }: CodeBlockProps) {
  return (
    <pre
      className={`p-3 bg-neutral-900 border border-neutral-800 rounded font-mono text-neutral-300 overflow-x-auto ${className}`}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      <code>{children}</code>
    </pre>
  )
}
