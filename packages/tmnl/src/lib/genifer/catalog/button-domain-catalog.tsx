/**
 * Button Domain Catalog — Full taxonomy, 16 components
 *
 * Compound component architecture: 6 primitive slots + 8 named assemblies + 2 group.
 * Every renderer follows harness/vantablack design language.
 *
 * Decisions:
 *   D1: Gradient — custom gradientFrom/gradientTo, default cyan→violet
 *   D2: Cooldown — label replacement ('Wait 4s' → 'Resend')
 *   D3: Confirm — label swap + click-away cancel
 *   D4: FAB — static z-50
 *
 * @module genifer/catalog/button-domain-catalog
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Schema } from 'effect'
import type { DomainCatalog, ComponentRenderProps, CompoundRelation } from '@/lib/genifer/core/CatalogService'
import type { EntranceAnimation } from '@/lib/genifer/core/animation-schema'

// ─── Harness tokens (shared with core-domain-catalog) ───────────────────────

const H = {
  bg:        'rgba(8, 8, 8, 0.97)',
  bgSurface: 'rgba(14, 14, 14, 0.95)',
  bgHeader:  'rgba(20, 20, 20, 0.95)',
  border:    'rgba(50, 50, 50, 0.6)',
  borderSubtle: 'rgba(40, 40, 40, 0.4)',
  cyan:   'rgb(34, 211, 238)',
  green:  'rgb(34, 197, 94)',
  red:    'rgb(239, 68, 68)',
  amber:  'rgb(245, 158, 11)',
  violet: 'rgb(139, 92, 246)',
  text:     'rgb(212, 212, 212)',
  textMid:  'rgb(163, 163, 163)',
  textDim:  'rgb(115, 115, 115)',
  textGhost:'rgb(82, 82, 82)',
  xs: 'var(--tmnl-text-xs, 12px)',
  sm: 'var(--tmnl-text-sm, 14px)',
  base: 'var(--tmnl-text-base, 16px)',
} as const

// ─── Animations ─────────────────────────────────────────────────────────────

const A = {
  quick: { property: 'opacity+scale', easing: 'out-quart', duration: 'fast' } satisfies EntranceAnimation,
  pop:   { property: 'opacity+scale', easing: 'out-back', duration: 'normal' } satisfies EntranceAnimation,
  slide: { property: 'opacity+translateY', easing: 'out-cubic', duration: 'normal' } satisfies EntranceAnimation,
  fade:  { property: 'opacity', easing: 'out-quad', duration: 'fast' } satisfies EntranceAnimation,
}

// ─── Variant system ─────────────────────────────────────────────────────────

interface VariantStyle {
  bg: string
  text: string
  border: string
  hover: string
  shadow?: string
  backdrop?: string
}

const VARIANTS: Record<string, VariantStyle> = {
  solid:       { bg: 'rgb(34,211,238)',       text: 'rgb(0,0,0)',       border: 'transparent',            hover: 'rgb(22,189,216)' },
  outline:     { bg: 'transparent',           text: 'rgb(212,212,212)', border: 'rgba(64,64,64,0.6)',     hover: 'rgba(255,255,255,0.05)' },
  ghost:       { bg: 'transparent',           text: 'rgb(163,163,163)', border: 'transparent',            hover: 'rgba(255,255,255,0.05)' },
  link:        { bg: 'transparent',           text: 'rgb(34,211,238)', border: 'transparent',             hover: 'transparent' },
  subtle:      { bg: 'rgba(34,211,238,0.08)', text: 'rgb(103,232,249)',border: 'rgba(34,211,238,0.15)',   hover: 'rgba(34,211,238,0.12)' },
  gradient:    { bg: 'linear-gradient(135deg, rgb(34,211,238), rgb(139,92,246))', text: 'white', border: 'transparent', hover: 'brightness(1.1)' },
  glow:        { bg: 'rgba(34,211,238,0.1)',  text: 'rgb(34,211,238)', border: 'rgba(34,211,238,0.25)',   hover: 'rgba(34,211,238,0.15)', shadow: '0 0 12px rgba(34,211,238,0.35)' },
  glass:       { bg: 'rgba(255,255,255,0.05)',text: 'rgb(212,212,212)',border: 'rgba(255,255,255,0.1)',    hover: 'rgba(255,255,255,0.08)', backdrop: 'blur(12px)' },
  destructive: { bg: 'rgba(239,68,68,0.12)',  text: 'rgb(248,113,113)',border: 'rgba(239,68,68,0.25)',    hover: 'rgba(239,68,68,0.18)' },
  success:     { bg: 'rgba(34,197,94,0.12)',  text: 'rgb(74,222,128)', border: 'rgba(34,197,94,0.25)',    hover: 'rgba(34,197,94,0.18)' },
  warning:     { bg: 'rgba(245,158,11,0.12)', text: 'rgb(251,191,36)',border: 'rgba(245,158,11,0.25)',    hover: 'rgba(245,158,11,0.18)' },
}

const SIZES: Record<string, { height: number; px: number; fontSize: string; iconSize: number }> = {
  xs: { height: 24, px: 8,  fontSize: H.xs, iconSize: 12 },
  sm: { height: 28, px: 10, fontSize: H.xs, iconSize: 14 },
  md: { height: 32, px: 12, fontSize: H.sm, iconSize: 16 },
  lg: { height: 38, px: 16, fontSize: H.sm, iconSize: 18 },
  xl: { height: 44, px: 20, fontSize: H.base, iconSize: 20 },
}

const SHAPES: Record<string, string | number> = {
  default: 6,
  pill: 9999,
  square: 0,
  circle: '50%',
}

/** Resolve variant style, handling gradient custom colors (D1) */
function resolveVariant(props: Record<string, unknown>): VariantStyle {
  const name = (props['variant'] as string) ?? 'outline'
  const base = VARIANTS[name] ?? VARIANTS.outline

  if (name === 'gradient' && (props['gradientFrom'] || props['gradientTo'])) {
    const from = (props['gradientFrom'] as string) ?? 'rgb(34,211,238)'
    const to = (props['gradientTo'] as string) ?? 'rgb(139,92,246)'
    return { ...base, bg: `linear-gradient(135deg, ${from}, ${to})` }
  }
  return base
}

/** Build the shared inline style for any button container */
function buttonStyle(props: Record<string, unknown>, v: VariantStyle, s: typeof SIZES.md): React.CSSProperties {
  const shape = SHAPES[(props['shape'] as string) ?? 'default'] ?? 6
  const disabled = props['disabled'] as boolean
  const loading = props['loading'] as boolean
  const isGradient = (v.bg as string).startsWith('linear-gradient')

  return {
    height: s.height,
    paddingLeft: s.px,
    paddingRight: s.px,
    fontSize: s.fontSize,
    borderRadius: shape,
    background: isGradient ? undefined : v.bg,
    backgroundImage: isGradient ? v.bg : undefined,
    color: v.text,
    border: v.border !== 'transparent' ? `1px solid ${v.border}` : 'none',
    opacity: disabled ? 0.3 : 1,
    pointerEvents: disabled || loading ? 'none' : 'auto',
    cursor: disabled ? 'default' : 'pointer',
    boxShadow: v.shadow,
    backdropFilter: v.backdrop,
    transition: 'all 150ms ease',
    position: 'relative',
  }
}

const CN = Schema.optional(Schema.String)
const VariantLiteral = Schema.optional(Schema.Literal('solid', 'outline', 'ghost', 'link', 'subtle', 'gradient', 'glow', 'glass', 'destructive', 'success', 'warning'))
const SizeLiteral = Schema.optional(Schema.Literal('xs', 'sm', 'md', 'lg', 'xl'))
const ShapeLiteral = Schema.optional(Schema.Literal('default', 'pill', 'square', 'circle'))

// =============================================================================
// 1. PRIMITIVE SLOTS
// =============================================================================

const primitiveSlots: Record<string, any> = {
  ButtonRoot: {
    schema: Schema.Struct({
      variant: VariantLiteral,
      size: SizeLiteral,
      shape: ShapeLiteral,
      disabled: Schema.optional(Schema.Boolean),
      loading: Schema.optional(Schema.Boolean),
      pressed: Schema.optional(Schema.Boolean),
      pulse: Schema.optional(Schema.Boolean),
      gradientFrom: CN,
      gradientTo: CN,
      'aria-label': CN,
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const v = resolveVariant(element.props as Record<string, unknown>)
      const s = SIZES[(element.props['size'] as string) ?? 'md'] ?? SIZES.md
      const pressed = element.props['pressed'] as boolean
      const pulse = element.props['pulse'] as boolean

      return (
        <button
          type="button"
          disabled={element.props['disabled'] as boolean || element.props['loading'] as boolean}
          aria-label={element.props['aria-label'] as string}
          aria-pressed={pressed}
          className={[
            'inline-flex items-center justify-center gap-1.5 font-mono whitespace-nowrap transition-all active:scale-[0.97]',
            pulse ? 'animate-pulse' : '',
            element.props['className'] as string ?? '',
          ].filter(Boolean).join(' ')}
          style={{
            ...buttonStyle(element.props as Record<string, unknown>, v, s),
            ...(pressed ? { background: `${v.text}10`, boxShadow: `inset 0 1px 3px rgba(0,0,0,0.3)` } : {}),
          }}
        >
          {children}
        </button>
      )
    },
    description: 'Button container shell. The fundamental building block. Accepts variant (solid|outline|ghost|link|subtle|gradient|glow|glass|destructive|success|warning), size (xs|sm|md|lg|xl), shape (default|pill|square|circle). Interactive states: disabled, loading, pressed, pulse. Gradient variant supports gradientFrom/gradientTo for custom color pairs. Children: ButtonIcon, ButtonLabel, ButtonBadge, ButtonSpinner, ButtonProgress.',
    hasChildren: true,
    defaultEntrance: A.quick,
    tier: 'core' as const,
    domains: ['ui'],
    compound: { parent: 'ButtonRoot', slots: ['ButtonIcon', 'ButtonLabel', 'ButtonBadge', 'ButtonSpinner', 'ButtonProgress'], strict: false } as CompoundRelation,
  },

  ButtonIcon: {
    schema: Schema.Struct({
      glyph: Schema.String,
      position: Schema.optional(Schema.Literal('leading', 'trailing')),
      className: CN,
    }),
    renderer: ({ element }: ComponentRenderProps) => (
      <span
        className={element.props['className'] as string ?? 'flex-shrink-0'}
        style={{ fontSize: 'inherit', lineHeight: 1, order: element.props['position'] === 'trailing' ? 1 : 0 }}
        aria-hidden="true"
      >
        {element.props['glyph'] as string}
      </span>
    ),
    description: 'Icon glyph inside a button. position: leading (default, before label) or trailing (after label). Use emoji or single character.',
    hasChildren: false,
    defaultEntrance: A.quick,
    tier: 'core' as const,
    domains: ['ui'],
  },

  ButtonLabel: {
    schema: Schema.Struct({ text: Schema.String, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <span className={element.props['className'] as string ?? 'font-mono truncate'}>
        {element.props['text'] as string}
      </span>
    ),
    description: 'Text label inside a button.',
    hasChildren: false,
    defaultEntrance: A.quick,
    tier: 'core' as const,
    domains: ['ui'],
  },

  ButtonBadge: {
    schema: Schema.Struct({
      count: Schema.optional(Schema.Number),
      max: Schema.optional(Schema.Number),
      dot: Schema.optional(Schema.Boolean),
      className: CN,
    }),
    renderer: ({ element }: ComponentRenderProps) => {
      const count = element.props['count'] as number ?? 0
      const max = element.props['max'] as number ?? 99
      const dot = element.props['dot'] as boolean
      const display = dot ? '' : (count > max ? `${max}+` : String(count))

      return (
        <span
          className={element.props['className'] as string ?? 'absolute font-mono font-medium flex items-center justify-center'}
          style={{
            top: -4, right: -4,
            minWidth: dot ? 8 : 16, height: dot ? 8 : 16,
            borderRadius: 9999,
            background: H.red,
            color: 'white',
            fontSize: '10px',
            padding: dot ? 0 : '0 4px',
            boxShadow: `0 0 6px rgba(239,68,68,0.4)`,
          }}
        >
          {display}
        </span>
      )
    },
    description: 'Count/notification badge overlaid on a button (absolute positioned). Props: count, max (default 99), dot (boolean for dot-only mode).',
    hasChildren: false,
    defaultEntrance: A.pop,
    tier: 'core' as const,
    domains: ['ui'],
  },

  ButtonSpinner: {
    schema: Schema.Struct({ active: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      if (!(element.props['active'] as boolean)) return null
      return (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" className={element.props['className'] as string ?? 'animate-spin flex-shrink-0'}>
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    description: 'Loading spinner inside a button. Only renders when active=true. Replaces or supplements label to indicate processing.',
    hasChildren: false,
    defaultEntrance: A.fade,
    tier: 'core' as const,
    domains: ['ui'],
  },

  ButtonProgress: {
    schema: Schema.Struct({ value: Schema.optional(Schema.Number), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const value = Math.min(100, Math.max(0, (element.props['value'] as number) ?? 0))
      return (
        <div
          className={element.props['className'] as string ?? 'absolute inset-0 overflow-hidden'}
          style={{ borderRadius: 'inherit', pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'absolute', left: 0, top: 0, bottom: 0,
              width: `${value}%`,
              background: 'rgba(34,211,238,0.15)',
              transition: 'width 200ms ease',
            }}
          />
        </div>
      )
    },
    description: 'Progress bar overlay inside a button. value: 0-100. Renders behind content as a subtle fill.',
    hasChildren: false,
    defaultEntrance: A.fade,
    tier: 'core' as const,
    domains: ['ui'],
  },
}

// =============================================================================
// 2. NAMED ASSEMBLIES
// =============================================================================

const namedAssemblies: Record<string, any> = {
  ActionButton: {
    schema: Schema.Struct({
      variant: VariantLiteral,
      size: SizeLiteral,
      shape: ShapeLiteral,
      loading: Schema.optional(Schema.Boolean),
      successFlash: Schema.optional(Schema.Boolean),
      disabled: Schema.optional(Schema.Boolean),
      gradientFrom: CN,
      gradientTo: CN,
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const v = resolveVariant(element.props as Record<string, unknown>)
      const s = SIZES[(element.props['size'] as string) ?? 'md'] ?? SIZES.md
      const loading = element.props['loading'] as boolean
      const flash = element.props['successFlash'] as boolean

      // Success flash overrides variant
      const effectiveV = flash
        ? { ...VARIANTS.success, shadow: '0 0 12px rgba(34,197,94,0.4)' }
        : v

      return (
        <button
          type="button"
          disabled={element.props['disabled'] as boolean || loading}
          className={[
            'inline-flex items-center justify-center gap-1.5 font-mono whitespace-nowrap transition-all active:scale-[0.97]',
            element.props['className'] as string ?? '',
          ].filter(Boolean).join(' ')}
          style={buttonStyle(element.props as Record<string, unknown>, effectiveV, s)}
        >
          {loading ? (
            <svg width={s.iconSize - 2} height={s.iconSize - 2} viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : flash ? (
            <span style={{ fontSize: s.iconSize - 2 }}>✓</span>
          ) : null}
          {!loading && children}
        </button>
      )
    },
    description: 'Primary action button with loading→success flow. When loading=true, shows spinner and dims label. When successFlash=true, briefly shows green ✓. Use for Submit, Save, Send actions.',
    hasChildren: true,
    defaultEntrance: A.quick,
    tier: 'core' as const,
    domains: ['ui'],
    compound: { parent: 'ActionButton', slots: ['ButtonIcon', 'ButtonLabel', 'ButtonSpinner'], strict: false } as CompoundRelation,
  },

  ConfirmButton: {
    schema: Schema.Struct({
      variant: VariantLiteral,
      size: SizeLiteral,
      shape: ShapeLiteral,
      confirmText: Schema.optional(Schema.String),
      loading: Schema.optional(Schema.Boolean),
      successFlash: Schema.optional(Schema.Boolean),
      disabled: Schema.optional(Schema.Boolean),
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const [pending, setPending] = useState(false)
      const ref = useRef<HTMLButtonElement>(null)
      const v = resolveVariant(element.props as Record<string, unknown>)
      const s = SIZES[(element.props['size'] as string) ?? 'md'] ?? SIZES.md
      const confirmText = (element.props['confirmText'] as string) ?? 'Are you sure?'
      const loading = element.props['loading'] as boolean
      const flash = element.props['successFlash'] as boolean

      // D3: Click-away cancel
      useEffect(() => {
        if (!pending) return
        const handler = (e: MouseEvent) => {
          if (ref.current && !ref.current.contains(e.target as Node)) setPending(false)
        }
        const keyHandler = (e: KeyboardEvent) => {
          if (e.key === 'Escape') setPending(false)
        }
        document.addEventListener('mousedown', handler)
        document.addEventListener('keydown', keyHandler)
        return () => {
          document.removeEventListener('mousedown', handler)
          document.removeEventListener('keydown', keyHandler)
        }
      }, [pending])

      // Destructive tint when pending
      const effectiveV = flash
        ? { ...VARIANTS.success, shadow: '0 0 12px rgba(34,197,94,0.4)' }
        : pending
          ? VARIANTS.destructive
          : v

      return (
        <button
          ref={ref}
          type="button"
          disabled={element.props['disabled'] as boolean || loading}
          className={[
            'inline-flex items-center justify-center gap-1.5 font-mono whitespace-nowrap transition-all active:scale-[0.97]',
            element.props['className'] as string ?? '',
          ].filter(Boolean).join(' ')}
          style={buttonStyle(element.props as Record<string, unknown>, effectiveV, s)}
          onClick={() => {
            if (!pending) { setPending(true) } else { setPending(false) /* action fires via @action:confirm binding */ }
          }}
        >
          {loading ? (
            <svg width={s.iconSize - 2} height={s.iconSize - 2} viewBox="0 0 24 24" fill="none" className="animate-spin">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : flash ? (
            <span style={{ fontSize: s.iconSize - 2 }}>✓</span>
          ) : pending ? (
            <span className="font-mono">{confirmText}</span>
          ) : (
            children
          )}
        </button>
      )
    },
    description: 'Two-step confirm button (D3). First click: label swaps to confirmText (default "Are you sure?"), variant tints destructive. Second click: executes. Click-away or Escape cancels. Use for irreversible/destructive actions.',
    hasChildren: true,
    defaultEntrance: A.quick,
    tier: 'domain' as const,
    domains: ['ui', 'forms'],
    compound: { parent: 'ConfirmButton', slots: ['ButtonIcon', 'ButtonLabel'], strict: false } as CompoundRelation,
  },

  CooldownButton: {
    schema: Schema.Struct({
      variant: VariantLiteral,
      size: SizeLiteral,
      shape: ShapeLiteral,
      cooldownMs: Schema.optional(Schema.Number),
      disabled: Schema.optional(Schema.Boolean),
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const [remaining, setRemaining] = useState(0)
      const v = resolveVariant(element.props as Record<string, unknown>)
      const s = SIZES[(element.props['size'] as string) ?? 'md'] ?? SIZES.md
      const cooldownMs = (element.props['cooldownMs'] as number) ?? 5000
      const cooling = remaining > 0

      const handleClick = useCallback(() => {
        if (cooling) return
        setRemaining(Math.ceil(cooldownMs / 1000))
      }, [cooling, cooldownMs])

      // D2: Label replacement countdown
      useEffect(() => {
        if (remaining <= 0) return
        const t = setTimeout(() => setRemaining(r => r - 1), 1000)
        return () => clearTimeout(t)
      }, [remaining])

      return (
        <button
          type="button"
          disabled={element.props['disabled'] as boolean || cooling}
          className={[
            'inline-flex items-center justify-center gap-1.5 font-mono whitespace-nowrap transition-all active:scale-[0.97]',
            element.props['className'] as string ?? '',
          ].filter(Boolean).join(' ')}
          style={{
            ...buttonStyle(element.props as Record<string, unknown>, v, s),
            opacity: cooling ? 0.5 : element.props['disabled'] ? 0.3 : 1,
          }}
          onClick={handleClick}
        >
          {cooling ? (
            <span className="font-mono tabular-nums">Wait {remaining}s</span>
          ) : (
            children
          )}
        </button>
      )
    },
    description: 'Button with cooldown timer (D2). After click, label replaces with countdown ("Wait 4s" → "3s" → re-enables). Props: cooldownMs (default 5000). Use for rate-limited actions like resend codes.',
    hasChildren: true,
    defaultEntrance: A.quick,
    tier: 'domain' as const,
    domains: ['ui', 'forms'],
    compound: { parent: 'CooldownButton', slots: ['ButtonIcon', 'ButtonLabel'], strict: false } as CompoundRelation,
  },

  PulseButton: {
    schema: Schema.Struct({
      variant: VariantLiteral,
      size: SizeLiteral,
      shape: ShapeLiteral,
      pulse: Schema.optional(Schema.Boolean),
      disabled: Schema.optional(Schema.Boolean),
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const v = resolveVariant(element.props as Record<string, unknown>)
      const s = SIZES[(element.props['size'] as string) ?? 'md'] ?? SIZES.md
      const pulse = element.props['pulse'] as boolean ?? true

      return (
        <button
          type="button"
          disabled={element.props['disabled'] as boolean}
          className={[
            'inline-flex items-center justify-center gap-1.5 font-mono whitespace-nowrap transition-all active:scale-[0.97]',
            element.props['className'] as string ?? '',
          ].filter(Boolean).join(' ')}
          style={{
            ...buttonStyle(element.props as Record<string, unknown>, v, s),
            animation: pulse ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
          }}
        >
          {children}
        </button>
      )
    },
    description: 'Attention-seeking button with CSS pulse animation. pulse: true (default) enables the animation. Use for CTAs, onboarding nudges, primary actions that need to stand out.',
    hasChildren: true,
    defaultEntrance: A.pop,
    tier: 'domain' as const,
    domains: ['ui'],
    compound: { parent: 'PulseButton', slots: ['ButtonIcon', 'ButtonLabel'], strict: false } as CompoundRelation,
  },

  SplitButton: {
    schema: Schema.Struct({
      variant: VariantLiteral,
      size: SizeLiteral,
      disabled: Schema.optional(Schema.Boolean),
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const v = resolveVariant(element.props as Record<string, unknown>)
      const s = SIZES[(element.props['size'] as string) ?? 'md'] ?? SIZES.md
      const childArray = React.Children.toArray(children)

      return (
        <div
          className={element.props['className'] as string ?? 'inline-flex items-stretch'}
          style={{ borderRadius: 6, overflow: 'hidden' }}
        >
          {/* Primary action */}
          <button
            type="button"
            disabled={element.props['disabled'] as boolean}
            className="inline-flex items-center justify-center gap-1.5 font-mono whitespace-nowrap transition-all active:scale-[0.97]"
            style={{
              ...buttonStyle(element.props as Record<string, unknown>, v, s),
              borderRadius: 0,
              borderTopLeftRadius: 6,
              borderBottomLeftRadius: 6,
              borderRight: 'none',
            }}
          >
            {childArray.slice(0, -1)}
          </button>
          {/* Separator */}
          <div style={{ width: 1, background: v.border !== 'transparent' ? v.border : 'rgba(0,0,0,0.2)', alignSelf: 'stretch' }} />
          {/* Dropdown trigger */}
          <button
            type="button"
            disabled={element.props['disabled'] as boolean}
            className="inline-flex items-center justify-center font-mono transition-all active:scale-[0.97]"
            style={{
              ...buttonStyle(element.props as Record<string, unknown>, v, s),
              borderRadius: 0,
              borderTopRightRadius: 6,
              borderBottomRightRadius: 6,
              borderLeft: 'none',
              paddingLeft: 6,
              paddingRight: 6,
            }}
            aria-label="More options"
          >
            {childArray.length > 0 ? childArray[childArray.length - 1] : <span>▾</span>}
          </button>
        </div>
      )
    },
    description: 'Split button: primary action + dropdown trigger separated by a divider. Last child becomes the dropdown trigger (typically ButtonIcon with ▾). All other children go in the primary section.',
    hasChildren: true,
    defaultEntrance: A.slide,
    tier: 'domain' as const,
    domains: ['ui'],
    compound: { parent: 'SplitButton', slots: ['ButtonIcon', 'ButtonLabel'], strict: false } as CompoundRelation,
  },

  FloatingActionButton: {
    schema: Schema.Struct({
      variant: VariantLiteral,
      size: SizeLiteral,
      position: Schema.optional(Schema.Literal('bottom-right', 'bottom-left', 'top-right', 'top-left')),
      disabled: Schema.optional(Schema.Boolean),
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const v = resolveVariant(element.props as Record<string, unknown>)
      const s = SIZES[(element.props['size'] as string) ?? 'lg'] ?? SIZES.lg
      const pos = (element.props['position'] as string) ?? 'bottom-right'
      const posStyle: React.CSSProperties = {
        position: 'fixed',
        zIndex: 50, // D4: static z-50
        ...(pos.includes('bottom') ? { bottom: 24 } : { top: 24 }),
        ...(pos.includes('right') ? { right: 24 } : { left: 24 }),
      }

      return (
        <button
          type="button"
          disabled={element.props['disabled'] as boolean}
          className={[
            'inline-flex items-center justify-center font-mono transition-all active:scale-[0.97]',
            element.props['className'] as string ?? '',
          ].filter(Boolean).join(' ')}
          style={{
            ...buttonStyle(element.props as Record<string, unknown>, v, s),
            ...posStyle,
            width: s.height + 8,
            height: s.height + 8,
            borderRadius: '50%',
            boxShadow: `${v.shadow ?? ''} 0 4px 16px rgba(0,0,0,0.4)`.trim(),
          }}
        >
          {children}
        </button>
      )
    },
    description: 'Floating action button (D4). Fixed position, circular, z-50. position: bottom-right (default), bottom-left, top-right, top-left. Use for mobile-style primary actions. Default size is lg.',
    hasChildren: true,
    defaultEntrance: A.pop,
    tier: 'domain' as const,
    domains: ['ui'],
    compound: { parent: 'FloatingActionButton', slots: ['ButtonIcon'], strict: false } as CompoundRelation,
  },

  LinkButton: {
    schema: Schema.Struct({
      text: Schema.String,
      external: Schema.optional(Schema.Boolean),
      size: SizeLiteral,
      disabled: Schema.optional(Schema.Boolean),
      className: CN,
    }),
    renderer: ({ element }: ComponentRenderProps) => {
      const s = SIZES[(element.props['size'] as string) ?? 'md'] ?? SIZES.md
      const external = element.props['external'] as boolean
      return (
        <button
          type="button"
          disabled={element.props['disabled'] as boolean}
          className={element.props['className'] as string ?? 'inline-flex items-center gap-1 font-mono transition-colors active:scale-[0.97]'}
          style={{
            fontSize: s.fontSize,
            color: H.cyan,
            background: 'transparent',
            border: 'none',
            borderBottom: `1px solid rgba(34,211,238,0.3)`,
            padding: '2px 0',
            cursor: element.props['disabled'] ? 'default' : 'pointer',
            opacity: element.props['disabled'] ? 0.3 : 1,
            transition: 'all 150ms ease',
          }}
        >
          {element.props['text'] as string}
          {external && <span style={{ fontSize: H.xs, opacity: 0.5 }}>↗</span>}
        </button>
      )
    },
    description: 'Text-only button with cyan underline. Looks like a link, behaves like a button. external: shows ↗ glyph.',
    hasChildren: false,
    defaultEntrance: A.quick,
    tier: 'core' as const,
    domains: ['ui'],
  },

  GhostButton: {
    schema: Schema.Struct({
      size: SizeLiteral,
      shape: ShapeLiteral,
      pressed: Schema.optional(Schema.Boolean),
      disabled: Schema.optional(Schema.Boolean),
      'aria-label': CN,
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const s = SIZES[(element.props['size'] as string) ?? 'md'] ?? SIZES.md
      const shape = SHAPES[(element.props['shape'] as string) ?? 'default'] ?? 6
      const pressed = element.props['pressed'] as boolean

      return (
        <button
          type="button"
          disabled={element.props['disabled'] as boolean}
          aria-label={element.props['aria-label'] as string}
          aria-pressed={pressed}
          className={[
            'inline-flex items-center justify-center gap-1.5 font-mono whitespace-nowrap transition-all active:scale-[0.97]',
            element.props['className'] as string ?? '',
          ].filter(Boolean).join(' ')}
          style={{
            height: s.height,
            paddingLeft: s.px, paddingRight: s.px,
            fontSize: s.fontSize,
            borderRadius: shape,
            background: pressed ? 'rgba(34,211,238,0.08)' : 'transparent',
            color: pressed ? H.cyan : H.textMid,
            border: pressed ? `1px solid rgba(34,211,238,0.2)` : '1px solid transparent',
            opacity: element.props['disabled'] ? 0.3 : 1,
            pointerEvents: element.props['disabled'] ? 'none' : 'auto',
            cursor: element.props['disabled'] ? 'default' : 'pointer',
            transition: 'all 150ms ease',
          }}
        >
          {children}
        </button>
      )
    },
    description: 'Transparent button, reveals on hover. When pressed=true, shows cyan tint and border. Use for toolbar buttons, secondary actions, toggle states.',
    hasChildren: true,
    defaultEntrance: A.quick,
    tier: 'core' as const,
    domains: ['ui'],
    compound: { parent: 'GhostButton', slots: ['ButtonIcon', 'ButtonLabel'], strict: false } as CompoundRelation,
  },
}

// =============================================================================
// 3. GROUP COMPONENTS
// =============================================================================

const groupComponents: Record<string, any> = {
  ButtonGroup: {
    schema: Schema.Struct({
      orientation: Schema.optional(Schema.Literal('row', 'column')),
      attached: Schema.optional(Schema.Boolean),
      className: CN,
    }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const dir = (element.props['orientation'] as string) ?? 'row'
      const attached = element.props['attached'] as boolean

      return (
        <div
          role="group"
          className={element.props['className'] as string ?? `inline-flex ${dir === 'column' ? 'flex-col' : 'flex-row'} ${attached ? '' : 'gap-1'}`}
          style={attached ? {
            display: 'inline-flex',
            flexDirection: dir === 'column' ? 'column' : 'row',
            // attached: merge borders via CSS override
          } : undefined}
        >
          {children}
        </div>
      )
    },
    description: 'Horizontal or vertical button strip. orientation: row (default) or column. attached: true merges borders between buttons. Children: any button type + ButtonGroupSeparator.',
    hasChildren: true,
    defaultEntrance: A.slide,
    tier: 'core' as const,
    domains: ['ui', 'layout'],
    compound: {
      parent: 'ButtonGroup',
      slots: ['ButtonRoot', 'ActionButton', 'GhostButton', 'ConfirmButton', 'CooldownButton', 'PulseButton', 'LinkButton', 'ButtonGroupSeparator'],
      strict: false,
    } as CompoundRelation,
  },

  ButtonGroupSeparator: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div
        className={element.props['className'] as string}
        style={{
          width: 1,
          alignSelf: 'stretch',
          background: H.border,
          margin: '4px 0',
        }}
      />
    ),
    description: 'Visual divider between buttons in a ButtonGroup.',
    hasChildren: false,
    defaultEntrance: A.fade,
    tier: 'core' as const,
    domains: ['ui', 'layout'],
  },
}

// =============================================================================
// EXPORT
// =============================================================================

export const buttonDomainCatalog: DomainCatalog = {
  name: 'TMNL Buttons',
  defaultTier: 'core',
  defaultDomains: ['ui'],
  components: {
    ...primitiveSlots,
    ...namedAssemblies,
    ...groupComponents,
  },
}
