/**
 * Core Domain Catalog — Full component inventory, TMNL Harness aesthetic
 *
 * Vantablack terminal chrome. Every renderer matches the harness design language:
 *   - Near-black backgrounds, neutral-800 borders
 *   - font-mono, uppercase tracking-wider labels
 *   - Accent colors: cyan (data), green (success), amber (warn), red (error), violet (meta)
 *   - var(--tmnl-text-xs, 12px) minimum, var(--tmnl-text-sm, 14px) body
 *   - active:scale-[0.97] on interactive, transition-all on hover
 *
 * @module genifer/catalog/core-domain-catalog
 */

import { Schema } from 'effect'
import type { DomainCatalog, ComponentRenderProps, CompoundRelation } from '@/lib/genifer/core/CatalogService'
import type { EntranceAnimation } from '@/lib/genifer/core/animation-schema'

// ─── shadcn/ui (functional guts — we override visuals) ──────────────────────

import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Slider } from '@/components/ui/slider'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// =============================================================================
// Harness Design Tokens
// =============================================================================

const H = {
  // Backgrounds — vantablack gradient
  bg:        'rgba(8, 8, 8, 0.97)',
  bgSurface: 'rgba(14, 14, 14, 0.95)',
  bgHeader:  'rgba(20, 20, 20, 0.95)',
  bgHover:   'rgba(255, 255, 255, 0.03)',
  bgInput:   'rgba(10, 10, 10, 0.8)',

  // Borders
  border:       'rgba(50, 50, 50, 0.6)',
  borderSubtle: 'rgba(40, 40, 40, 0.4)',
  borderFocus:  'rgba(34, 211, 238, 0.5)',

  // Accents
  cyan:   'rgb(34, 211, 238)',
  green:  'rgb(34, 197, 94)',
  red:    'rgb(239, 68, 68)',
  amber:  'rgb(245, 158, 11)',
  violet: 'rgb(139, 92, 246)',
  rose:   'rgb(244, 63, 94)',

  // Neutrals
  text:     'rgb(212, 212, 212)',   // neutral-300
  textMid:  'rgb(163, 163, 163)',   // neutral-400
  textDim:  'rgb(115, 115, 115)',   // neutral-500
  textGhost:'rgb(82, 82, 82)',      // neutral-600

  // Font sizes via CSS vars
  xs: 'var(--tmnl-text-xs, 12px)',
  sm: 'var(--tmnl-text-sm, 14px)',
  base: 'var(--tmnl-text-base, 16px)',
} as const

// =============================================================================
// Animations
// =============================================================================

const A = {
  fade:  { property: 'opacity', easing: 'out-quad', duration: 'fast' } satisfies EntranceAnimation,
  slide: { property: 'opacity+translateY', easing: 'out-cubic', duration: 'normal' } satisfies EntranceAnimation,
  pop:   { property: 'opacity+scale', easing: 'out-back', duration: 'normal' } satisfies EntranceAnimation,
  quick: { property: 'opacity+scale', easing: 'out-quart', duration: 'fast' } satisfies EntranceAnimation,
}

// =============================================================================
// Shared prop fragments
// =============================================================================

const CN = Schema.optional(Schema.String)

/** Harness container shell — the dark chrome wrapper */
function Shell({ children, className, border }: { children: React.ReactNode; className?: string; border?: string }) {
  return (
    <div
      className={className}
      style={{
        background: H.bgSurface,
        border: `1px solid ${border ?? H.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

/** Header bar — slightly lighter strip with label */
function HeaderBar({ children, accent, className }: { children: React.ReactNode; accent?: string; className?: string }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 ${className ?? ''}`}
      style={{
        background: H.bgHeader,
        borderBottom: `1px solid ${H.border}`,
        ...(accent ? { borderLeft: `2px solid ${accent}` } : {}),
      }}
    >
      {children}
    </div>
  )
}

/** Monospace label — uppercase, tracking, dimmed */
function HLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="font-mono uppercase tracking-wider"
      style={{ fontSize: H.xs, color: color ?? H.textDim, letterSpacing: '0.05em' }}
    >
      {children}
    </span>
  )
}

/** Status dot — tiny colored indicator with glow */
function Dot({ color, size = 6 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 ${size}px ${color}66`,
        flexShrink: 0,
      }}
    />
  )
}

// =============================================================================
// 1. CORE — Typography
// =============================================================================

const coreComponents: Record<string, any> = {
  Code: {
    schema: Schema.Struct({ text: Schema.String, variant: Schema.optional(Schema.Literal('inline', 'block')), language: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const v = element.props['variant'] as string ?? 'inline'
      const text = element.props['text'] as string
      if (v === 'block') {
        return (
          <Shell className={element.props['className'] as string}>
            {element.props['language'] && (
              <HeaderBar><HLabel>{element.props['language'] as string}</HLabel></HeaderBar>
            )}
            <pre className="px-3 py-2.5 font-mono overflow-x-auto" style={{ fontSize: H.xs, color: H.text, lineHeight: 1.6 }}>
              <code>{text}</code>
            </pre>
          </Shell>
        )
      }
      return (
        <code
          className={element.props['className'] as string ?? 'font-mono px-1.5 py-0.5 rounded'}
          style={{ fontSize: H.xs, background: 'rgba(255,255,255,0.06)', color: H.cyan, border: `1px solid ${H.borderSubtle}` }}
        >
          {text}
        </code>
      )
    },
    description: 'Code text. variant: inline (default, cyan accent) or block (dark shell with language header).',
    hasChildren: false, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui'],
  },

  Blockquote: {
    schema: Schema.Struct({ text: Schema.String, cite: CN, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <div
        className={element.props['className'] as string}
        style={{
          borderLeft: `2px solid ${H.cyan}40`,
          paddingLeft: 16,
          margin: '8px 0',
        }}
      >
        <p className="font-mono italic" style={{ fontSize: H.sm, color: H.textMid, lineHeight: 1.6 }}>
          {element.props['text'] as string}
        </p>
        {element.props['cite'] && (
          <span className="font-mono block mt-2" style={{ fontSize: H.xs, color: H.textDim }}>
            — {element.props['cite'] as string}
          </span>
        )}
        {children}
      </div>
    ),
    description: 'Blockquote with cyan left border and optional citation.',
    hasChildren: true, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui'],
  },

  List: {
    schema: Schema.Struct({ variant: Schema.optional(Schema.Literal('ordered', 'unordered', 'description')), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const v = element.props['variant'] as string ?? 'unordered'
      const Tag = v === 'ordered' ? 'ol' : 'ul'
      return (
        <Tag
          className={element.props['className'] as string ?? 'space-y-1 pl-4 font-mono'}
          style={{ fontSize: H.sm, color: H.textMid, listStyleType: v === 'ordered' ? 'decimal' : 'none' }}
        >
          {children}
        </Tag>
      )
    },
    description: 'List container. Monospace, dimmed text.',
    hasChildren: true, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui'],
    compound: { parent: 'List', slots: ['ListItem'], strict: true } as CompoundRelation,
  },

  ListItem: {
    schema: Schema.Struct({ text: CN, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <li className={element.props['className'] as string ?? 'flex items-start gap-2'} style={{ fontSize: H.sm, color: H.textMid }}>
        <span style={{ color: H.textGhost, marginTop: 2, flexShrink: 0 }}>›</span>
        <span>
          {element.props['text'] as string}
          {children}
        </span>
      </li>
    ),
    description: 'List item with › glyph prefix.',
    hasChildren: true, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui'],
  },
}

// =============================================================================
// 2. PRIMITIVES
// =============================================================================

const primitiveComponents: Record<string, any> = {
  Box: {
    schema: Schema.Struct({ as: Schema.optional(Schema.Literal('div', 'section', 'article', 'aside', 'main', 'nav')), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const Tag = (element.props['as'] as string ?? 'div') as any
      return <Tag className={element.props['className'] as string}>{children}</Tag>
    },
    description: 'Pure layout div. className is the only styling.',
    hasChildren: true, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui', 'layout'],
  },

  IconButton: {
    schema: Schema.Struct({ icon: Schema.String, label: Schema.String, variant: Schema.optional(Schema.Literal('default', 'destructive', 'outline', 'ghost')), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <button
        type="button"
        aria-label={element.props['label'] as string}
        className={element.props['className'] as string ?? 'inline-flex items-center justify-center rounded transition-all active:scale-[0.97]'}
        style={{
          width: 32, height: 32,
          background: 'transparent',
          border: `1px solid ${H.borderSubtle}`,
          color: H.textMid,
          fontSize: H.sm,
        }}
      >
        {element.props['icon'] as string}
      </button>
    ),
    description: 'Icon-only button. label: aria-label (required a11y).',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'core' as const, domains: ['ui'],
  },

  ButtonGroup: {
    schema: Schema.Struct({ orientation: Schema.optional(Schema.Literal('row', 'column')), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const dir = element.props['orientation'] as string ?? 'row'
      return (
        <div className={element.props['className'] as string ?? `flex ${dir === 'column' ? 'flex-col' : 'flex-row'} gap-1.5`}>
          {children}
        </div>
      )
    },
    description: 'Group of buttons.',
    hasChildren: true, defaultEntrance: A.quick,
    tier: 'core' as const, domains: ['ui'],
  },

  Image: {
    schema: Schema.Struct({ src: Schema.String, alt: Schema.String, width: Schema.optional(Schema.Number), height: Schema.optional(Schema.Number), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div style={{ background: H.bg, border: `1px solid ${H.border}`, borderRadius: 8, overflow: 'hidden', display: 'inline-block' }}>
        <img
          src={element.props['src'] as string}
          alt={element.props['alt'] as string}
          width={element.props['width'] as number}
          height={element.props['height'] as number}
          className={element.props['className'] as string}
          style={{ display: 'block', maxWidth: '100%' }}
        />
      </div>
    ),
    description: 'Image wrapped in dark chrome border.',
    hasChildren: false, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui', 'media'],
  },

  Avatar: {
    schema: Schema.Struct({ src: CN, alt: CN, initials: CN, size: Schema.optional(Schema.Literal('xs', 'sm', 'md', 'lg', 'xl')), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const sizeMap: Record<string, number> = { xs: 24, sm: 28, md: 36, lg: 44, xl: 56 }
      const sz = sizeMap[(element.props['size'] as string) ?? 'md'] ?? 36
      const src = element.props['src'] as string
      const initials = element.props['initials'] as string ?? '?'
      return (
        <div
          className={element.props['className'] as string}
          style={{
            width: sz, height: sz, borderRadius: '50%',
            background: src ? 'transparent' : `${H.cyan}15`,
            border: `1px solid ${H.border}`,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0,
          }}
        >
          {src ? (
            <img src={src} alt={element.props['alt'] as string ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span className="font-mono uppercase" style={{ fontSize: sz < 32 ? H.xs : H.sm, color: H.cyan }}>{initials}</span>
          )}
        </div>
      )
    },
    description: 'Circular avatar. Cyan initials fallback.',
    hasChildren: false, defaultEntrance: A.pop,
    tier: 'core' as const, domains: ['ui', 'media'],
  },

  Link: {
    schema: Schema.Struct({ href: Schema.String, text: Schema.String, external: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <a
        href={element.props['href'] as string}
        className={element.props['className'] as string ?? 'font-mono transition-colors'}
        style={{ fontSize: H.sm, color: H.cyan, textDecoration: 'none', borderBottom: `1px solid ${H.cyan}30` }}
        target={element.props['external'] ? '_blank' : undefined}
        rel={element.props['external'] ? 'noopener noreferrer' : undefined}
      >
        {element.props['text'] as string}
        {element.props['external'] && <span style={{ fontSize: H.xs, marginLeft: 4, opacity: 0.5 }}>↗</span>}
      </a>
    ),
    description: 'Cyan monospace hyperlink. External shows ↗ glyph.',
    hasChildren: false, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui'],
  },

  Skeleton: {
    schema: Schema.Struct({ variant: Schema.optional(Schema.Literal('text', 'circle', 'rect')), width: Schema.optional(Schema.Union(Schema.String, Schema.Number)), height: Schema.optional(Schema.Union(Schema.String, Schema.Number)), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const v = element.props['variant'] as string ?? 'rect'
      return (
        <div
          className={element.props['className'] as string ?? 'animate-pulse'}
          style={{
            width: element.props['width'] as any ?? '100%',
            height: element.props['height'] as any ?? (v === 'text' ? 14 : 40),
            borderRadius: v === 'circle' ? '50%' : 4,
            background: `linear-gradient(90deg, ${H.bgHeader} 25%, rgba(255,255,255,0.04) 50%, ${H.bgHeader} 75%)`,
            backgroundSize: '200% 100%',
          }}
        />
      )
    },
    description: 'Loading skeleton. Subtle shimmer on vantablack.',
    hasChildren: false, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui', 'feedback'],
  },

  Spinner: {
    schema: Schema.Struct({ size: Schema.optional(Schema.Literal('sm', 'md', 'lg')), label: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const sizeMap: Record<string, number> = { sm: 14, md: 18, lg: 24 }
      const sz = sizeMap[(element.props['size'] as string) ?? 'md'] ?? 18
      return (
        <span className={element.props['className'] as string ?? 'inline-flex items-center gap-2'}>
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" className="animate-spin">
            <circle cx="12" cy="12" r="10" stroke={H.textGhost} strokeWidth="2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke={H.cyan} strokeWidth="2" strokeLinecap="round" />
          </svg>
          {element.props['label'] && <span className="font-mono" style={{ fontSize: H.xs, color: H.textDim }}>{element.props['label'] as string}</span>}
        </span>
      )
    },
    description: 'Spinning loader. Cyan arc on ghost track.',
    hasChildren: false, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui', 'feedback'],
  },

  ScrollArea: {
    schema: Schema.Struct({ maxHeight: Schema.optional(Schema.Number), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <div
        className={element.props['className'] as string ?? 'overflow-y-auto'}
        style={{
          maxHeight: element.props['maxHeight'] as number ?? 400,
          scrollbarWidth: 'thin',
          scrollbarColor: `${H.textGhost} transparent`,
        }}
      >
        {children}
      </div>
    ),
    description: 'Scrollable area with thin styled scrollbar.',
    hasChildren: true, defaultEntrance: A.fade,
    tier: 'core' as const, domains: ['ui', 'layout'],
  },
}

// =============================================================================
// 3. FORMS
// =============================================================================

const formsComponents: Record<string, any> = {
  Textarea: {
    schema: Schema.Struct({ placeholder: CN, label: CN, rows: Schema.optional(Schema.Number), value: CN, disabled: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div className="space-y-1.5">
        {element.props['label'] && <HLabel>{element.props['label'] as string}</HLabel>}
        <Textarea
          placeholder={element.props['placeholder'] as string}
          rows={element.props['rows'] as number ?? 3}
          defaultValue={element.props['value'] as string}
          disabled={element.props['disabled'] as boolean}
          className={element.props['className'] as string ?? 'font-mono border-neutral-800 bg-[rgba(10,10,10,0.8)] text-neutral-300 placeholder:text-neutral-600 focus:border-cyan-500/50 focus:ring-cyan-500/20 resize-none'}
          style={{ fontSize: H.sm }}
        />
      </div>
    ),
    description: 'Multi-line text input. Dark bg, cyan focus ring.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms'],
  },

  Checkbox: {
    schema: Schema.Struct({ id: CN, label: CN, checked: Schema.optional(Schema.Boolean), disabled: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const id = element.props['id'] as string ?? element.key
      return (
        <div className={element.props['className'] as string ?? 'flex items-center gap-2.5'}>
          <Checkbox
            id={id}
            defaultChecked={element.props['checked'] as boolean}
            disabled={element.props['disabled'] as boolean}
            className="border-neutral-700 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
          />
          {element.props['label'] && (
            <label htmlFor={id} className="font-mono cursor-pointer" style={{ fontSize: H.sm, color: H.textMid }}>
              {element.props['label'] as string}
            </label>
          )}
        </div>
      )
    },
    description: 'Checkbox. Cyan fill when checked.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms'],
  },

  Select: {
    schema: Schema.Struct({ placeholder: CN, label: CN, options: Schema.Array(Schema.Struct({ value: Schema.String, label: Schema.String })), value: CN, disabled: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const opts = (element.props['options'] as Array<{ value: string; label: string }>) ?? []
      return (
        <div className="space-y-1.5">
          {element.props['label'] && <HLabel>{element.props['label'] as string}</HLabel>}
          <Select defaultValue={element.props['value'] as string} disabled={element.props['disabled'] as boolean}>
            <SelectTrigger className={element.props['className'] as string ?? 'font-mono border-neutral-800 bg-[rgba(10,10,10,0.8)] text-neutral-300 focus:ring-cyan-500/20'} style={{ fontSize: H.sm }}>
              <SelectValue placeholder={element.props['placeholder'] as string ?? 'Select…'} />
            </SelectTrigger>
            <SelectContent className="bg-neutral-950 border-neutral-800 font-mono" style={{ fontSize: H.sm }}>
              {opts.map(o => <SelectItem key={o.value} value={o.value} className="text-neutral-300 focus:bg-cyan-500/10 focus:text-cyan-300">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )
    },
    description: 'Dropdown select. Dark dropdown, cyan highlight.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms'],
  },

  RadioGroup: {
    schema: Schema.Struct({ value: CN, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => <RadioGroup defaultValue={element.props['value'] as string} className={element.props['className'] as string ?? 'space-y-2'}>{children}</RadioGroup>,
    description: 'Radio group container.',
    hasChildren: true, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms'],
    compound: { parent: 'RadioGroup', slots: ['RadioItem'], strict: true } as CompoundRelation,
  },

  RadioItem: {
    schema: Schema.Struct({ value: Schema.String, label: Schema.String, disabled: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const id = `radio-${element.props['value']}`
      return (
        <div className={element.props['className'] as string ?? 'flex items-center gap-2.5'}>
          <RadioGroupItem value={element.props['value'] as string} id={id} disabled={element.props['disabled'] as boolean} className="border-neutral-700 text-cyan-500" />
          <label htmlFor={id} className="font-mono cursor-pointer" style={{ fontSize: H.sm, color: H.textMid }}>
            {element.props['label'] as string}
          </label>
        </div>
      )
    },
    description: 'Radio option. Cyan fill.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms'],
  },

  Slider: {
    schema: Schema.Struct({ min: Schema.optional(Schema.Number), max: Schema.optional(Schema.Number), step: Schema.optional(Schema.Number), value: Schema.optional(Schema.Number), label: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div className="space-y-2">
        {element.props['label'] && (
          <div className="flex items-center justify-between">
            <HLabel>{element.props['label'] as string}</HLabel>
            <span className="font-mono" style={{ fontSize: H.xs, color: H.cyan }}>{element.props['value'] as number ?? '—'}</span>
          </div>
        )}
        <Slider
          min={element.props['min'] as number ?? 0} max={element.props['max'] as number ?? 100}
          step={element.props['step'] as number ?? 1} defaultValue={[element.props['value'] as number ?? 50]}
          className={element.props['className'] as string}
        />
      </div>
    ),
    description: 'Range slider with label + cyan value readout.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms'],
  },

  FileInput: {
    schema: Schema.Struct({ accept: CN, multiple: Schema.optional(Schema.Boolean), label: CN, description: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div className="space-y-1.5">
        {element.props['label'] && <HLabel>{element.props['label'] as string}</HLabel>}
        <label
          className={element.props['className'] as string ?? 'flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer font-mono transition-all'}
          style={{
            background: H.bgInput, border: `1px dashed ${H.textGhost}`,
            fontSize: H.sm, color: H.textDim,
          }}
        >
          <span style={{ color: H.textGhost }}>⬆</span>
          <span>Choose file…</span>
          <input type="file" accept={element.props['accept'] as string} multiple={element.props['multiple'] as boolean} className="sr-only" />
        </label>
        {element.props['description'] && <p className="font-mono" style={{ fontSize: H.xs, color: H.textGhost }}>{element.props['description'] as string}</p>}
      </div>
    ),
    description: 'File upload. Dashed border, ghost text.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms'],
  },

  DateInput: {
    schema: Schema.Struct({ value: CN, placeholder: CN, min: CN, max: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <Input
        type="date"
        defaultValue={element.props['value'] as string}
        min={element.props['min'] as string} max={element.props['max'] as string}
        className={element.props['className'] as string ?? 'font-mono border-neutral-800 bg-[rgba(10,10,10,0.8)] text-neutral-300 focus:border-cyan-500/50'}
        style={{ fontSize: H.sm, colorScheme: 'dark' }}
      />
    ),
    description: 'Date input. Dark scheme.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms'],
  },
}

// =============================================================================
// 4. CARDS — Harness metric cards
// =============================================================================

const cardsComponents: Record<string, any> = {
  InfoCard: {
    schema: Schema.Struct({ title: Schema.String, value: Schema.String, description: CN, trend: Schema.optional(Schema.Literal('up', 'down', 'flat')), trendValue: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const trend = element.props['trend'] as string
      const trendColor = trend === 'up' ? H.green : trend === 'down' ? H.red : H.textDim
      const trendGlyph = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'
      return (
        <Shell className={element.props['className'] as string}>
          <div className="px-3 py-2.5 space-y-1">
            <HLabel>{element.props['title'] as string}</HLabel>
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-semibold" style={{ fontSize: 'var(--tmnl-text-lg, 20px)', color: H.text }}>
                {element.props['value'] as string}
              </span>
              {element.props['trendValue'] && (
                <span className="font-mono flex items-center gap-1" style={{ fontSize: H.xs, color: trendColor }}>
                  {trendGlyph} {element.props['trendValue'] as string}
                </span>
              )}
            </div>
            {element.props['description'] && (
              <p className="font-mono" style={{ fontSize: H.xs, color: H.textGhost }}>{element.props['description'] as string}</p>
            )}
          </div>
        </Shell>
      )
    },
    description: 'Stat card with value + trend indicator. For KPI dashboards.',
    hasChildren: false, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'cards', 'data'],
  },

  MetricCard: {
    schema: Schema.Struct({ label: Schema.String, value: Schema.String, unit: CN, delta: CN, deltaType: Schema.optional(Schema.Literal('positive', 'negative', 'neutral')), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const dt = element.props['deltaType'] as string
      const deltaColor = dt === 'positive' ? H.green : dt === 'negative' ? H.red : H.textDim
      return (
        <Shell className={element.props['className'] as string}>
          <HeaderBar accent={dt === 'positive' ? H.green : dt === 'negative' ? H.red : undefined}>
            <HLabel>{element.props['label'] as string}</HLabel>
            {element.props['delta'] && <span className="font-mono" style={{ fontSize: H.xs, color: deltaColor }}>{element.props['delta'] as string}</span>}
          </HeaderBar>
          <div className="px-3 py-3 flex items-baseline gap-1.5">
            <span className="font-mono font-semibold" style={{ fontSize: 'var(--tmnl-text-lg, 20px)', color: H.text }}>{element.props['value'] as string}</span>
            {element.props['unit'] && <span className="font-mono" style={{ fontSize: H.xs, color: H.textGhost }}>{element.props['unit'] as string}</span>}
          </div>
        </Shell>
      )
    },
    description: 'Metric card with header bar, accent border for delta direction.',
    hasChildren: false, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'cards', 'data'],
  },
}

// =============================================================================
// 5. DATA DISPLAY
// =============================================================================

const dataComponents: Record<string, any> = {
  DataTable: {
    schema: Schema.Struct({ columns: Schema.Array(Schema.Struct({ key: Schema.String, header: Schema.String, className: CN })), rows: Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const cols = (element.props['columns'] as Array<{ key: string; header: string; className?: string }>) ?? []
      const rows = (element.props['rows'] as Array<Record<string, unknown>>) ?? []
      return (
        <Shell className={element.props['className'] as string}>
          <div className="overflow-x-auto">
            <table className="w-full font-mono" style={{ fontSize: H.xs, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: H.bgHeader }}>
                  {cols.map(c => (
                    <th key={c.key} className={`text-left px-3 py-2 uppercase tracking-wider ${c.className ?? ''}`} style={{ color: H.textDim, fontWeight: 500, borderBottom: `1px solid ${H.border}`, fontSize: H.xs }}>
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${H.borderSubtle}` }} className="transition-colors hover:bg-white/[0.02]">
                    {cols.map(c => (
                      <td key={c.key} className="px-3 py-1.5" style={{ color: H.textMid }}>
                        {String(row[c.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Shell>
      )
    },
    description: 'Data table. Dark shell, monospace cells, uppercase column headers.',
    hasChildren: false, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'data'],
  },

  KeyValue: {
    schema: Schema.Struct({ label: Schema.String, value: Schema.String, variant: Schema.optional(Schema.Literal('inline', 'stacked')), accent: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const stacked = element.props['variant'] === 'stacked'
      return (
        <div className={element.props['className'] as string ?? `${stacked ? 'space-y-0.5' : 'flex items-center justify-between'} font-mono`}>
          <span style={{ fontSize: H.xs, color: H.textDim }}>{element.props['label'] as string}</span>
          <span style={{ fontSize: H.sm, color: (element.props['accent'] as string) ?? H.text }}>{element.props['value'] as string}</span>
        </div>
      )
    },
    description: 'Key-value display. Monospace, dim label → bright value.',
    hasChildren: false, defaultEntrance: A.fade,
    tier: 'domain' as const, domains: ['ui', 'data'],
  },

  Stat: {
    schema: Schema.Struct({ label: Schema.String, value: Schema.String, helpText: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div className={element.props['className'] as string ?? 'text-center space-y-0.5'}>
        <p className="font-mono font-semibold" style={{ fontSize: 'var(--tmnl-text-lg, 20px)', color: H.text }}>{element.props['value'] as string}</p>
        <HLabel>{element.props['label'] as string}</HLabel>
        {element.props['helpText'] && <p className="font-mono" style={{ fontSize: H.xs, color: H.textGhost }}>{element.props['helpText'] as string}</p>}
      </div>
    ),
    description: 'Centered stat: big value, uppercase label.',
    hasChildren: false, defaultEntrance: A.pop,
    tier: 'domain' as const, domains: ['ui', 'data'],
  },

  StatGroup: {
    schema: Schema.Struct({ columns: Schema.optional(Schema.Literal('2', '3', '4')), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const n = element.props['columns'] as string ?? '3'
      return (
        <div className={element.props['className'] as string} style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 12 }}>
          {children}
        </div>
      )
    },
    description: 'Grid of Stat components.',
    hasChildren: true, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'data'],
  },

  Timeline: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <div className={element.props['className'] as string ?? 'relative space-y-0'}>
        <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 1, background: H.borderSubtle }} />
        {children}
      </div>
    ),
    description: 'Timeline container with vertical track line.',
    hasChildren: true, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'data'],
    compound: { parent: 'Timeline', slots: ['TimelineItem'], strict: true } as CompoundRelation,
  },

  TimelineItem: {
    schema: Schema.Struct({ title: Schema.String, description: CN, timestamp: CN, variant: Schema.optional(Schema.Literal('default', 'success', 'error', 'warning')), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const v = element.props['variant'] as string ?? 'default'
      const dotColor = v === 'success' ? H.green : v === 'error' ? H.red : v === 'warning' ? H.amber : H.cyan
      return (
        <div className={element.props['className'] as string ?? 'relative pl-7 py-2.5'}>
          <div style={{ position: 'absolute', left: 3, top: 14, width: 9, height: 9, borderRadius: '50%', background: H.bg, border: `2px solid ${dotColor}`, boxShadow: `0 0 6px ${dotColor}44` }} />
          <div className="font-mono space-y-0.5">
            <p style={{ fontSize: H.sm, color: H.text }}>{element.props['title'] as string}</p>
            {element.props['description'] && <p style={{ fontSize: H.xs, color: H.textDim }}>{element.props['description'] as string}</p>}
            {element.props['timestamp'] && <p style={{ fontSize: H.xs, color: H.textGhost }}>{element.props['timestamp'] as string}</p>}
          </div>
        </div>
      )
    },
    description: 'Timeline entry. Dot color by variant, subtle glow.',
    hasChildren: false, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'data'],
  },

  EmptyState: {
    schema: Schema.Struct({ title: Schema.String, description: CN, icon: CN, actionLabel: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div className={element.props['className'] as string ?? 'text-center py-10 space-y-3'}>
        {element.props['icon'] && <span style={{ fontSize: 32, display: 'block', opacity: 0.3 }}>{element.props['icon'] as string}</span>}
        <p className="font-mono" style={{ fontSize: H.sm, color: H.textMid }}>{element.props['title'] as string}</p>
        {element.props['description'] && <p className="font-mono" style={{ fontSize: H.xs, color: H.textGhost }}>{element.props['description'] as string}</p>}
        {element.props['actionLabel'] && (
          <button
            type="button"
            className="font-mono px-3 py-1.5 rounded transition-all active:scale-[0.97]"
            style={{ fontSize: H.xs, color: H.cyan, background: `${H.cyan}10`, border: `1px solid ${H.cyan}25` }}
          >
            {element.props['actionLabel'] as string}
          </button>
        )}
      </div>
    ),
    description: 'Empty state with ghost icon, monospace message, cyan action.',
    hasChildren: false, defaultEntrance: A.pop,
    tier: 'domain' as const, domains: ['ui', 'data'],
  },

  Tooltip: {
    schema: Schema.Struct({ content: Schema.String, side: Schema.optional(Schema.Literal('top', 'right', 'bottom', 'left')), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <span className={element.props['className'] as string ?? 'relative group/tooltip inline-block'}>
        {children}
        <span
          className="absolute hidden group-hover/tooltip:block z-50 pointer-events-none px-2 py-1 rounded font-mono whitespace-nowrap"
          style={{
            fontSize: H.xs, color: H.text, background: 'rgb(23,23,23)', border: `1px solid ${H.border}`,
            bottom: '100%', left: '50%', transform: 'translateX(-50%) translateY(-4px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          {element.props['content'] as string}
        </span>
      </span>
    ),
    description: 'CSS-only tooltip. Dark bg, thin border.',
    hasChildren: true, defaultEntrance: A.pop,
    tier: 'domain' as const, domains: ['ui', 'data', 'feedback'],
  },
}

// =============================================================================
// 6. FEEDBACK
// =============================================================================

const feedbackComponents: Record<string, any> = {
  Callout: {
    schema: Schema.Struct({ variant: Schema.optional(Schema.Literal('info', 'warning', 'tip', 'danger', 'note')), title: CN, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => {
      const v = element.props['variant'] as string ?? 'info'
      const accent = v === 'danger' ? H.red : v === 'warning' ? H.amber : v === 'tip' ? H.green : v === 'note' ? H.violet : H.cyan
      const glyph = v === 'danger' ? '✕' : v === 'warning' ? '▲' : v === 'tip' ? '✓' : v === 'note' ? '◆' : 'ℹ'
      return (
        <Shell className={element.props['className'] as string} border={`${accent}30`}>
          <div className="px-3 py-2.5" style={{ borderLeft: `2px solid ${accent}` }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono" style={{ fontSize: H.xs, color: accent }}>{glyph}</span>
              {element.props['title'] ? (
                <span className="font-mono font-medium" style={{ fontSize: H.sm, color: H.text }}>{element.props['title'] as string}</span>
              ) : (
                <HLabel color={accent}>{v}</HLabel>
              )}
            </div>
            <div className="font-mono" style={{ fontSize: H.sm, color: H.textMid, lineHeight: 1.6 }}>{children}</div>
          </div>
        </Shell>
      )
    },
    description: 'Callout with accent border + glyph. Variants: info(cyan), warning(amber), tip(green), danger(red), note(violet).',
    hasChildren: true, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'feedback'],
  },

  Banner: {
    schema: Schema.Struct({ variant: Schema.optional(Schema.Literal('info', 'success', 'warning', 'error')), text: Schema.String, dismissible: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const v = element.props['variant'] as string ?? 'info'
      const accent = v === 'success' ? H.green : v === 'error' ? H.red : v === 'warning' ? H.amber : H.cyan
      return (
        <div
          className={element.props['className'] as string ?? 'flex items-center gap-3 px-3 py-2 rounded-lg font-mono'}
          style={{ fontSize: H.sm, color: accent, background: `${accent}08`, border: `1px solid ${accent}20` }}
        >
          <Dot color={accent} />
          <span style={{ color: H.textMid }}>{element.props['text'] as string}</span>
        </div>
      )
    },
    description: 'Full-width banner with status dot and accent border.',
    hasChildren: false, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'feedback'],
  },

  Dialog: {
    schema: Schema.Struct({ triggerLabel: CN, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        <HeaderBar accent={H.cyan}>
          <HLabel color={H.cyan}>dialog</HLabel>
          <button type="button" className="font-mono transition-colors" style={{ fontSize: H.xs, color: H.textGhost }}>✕</button>
        </HeaderBar>
        <div className="px-3 py-3 space-y-3">{children}</div>
      </Shell>
    ),
    description: 'Modal dialog shell with cyan header bar and close glyph.',
    hasChildren: true, defaultEntrance: A.pop,
    tier: 'domain' as const, domains: ['ui', 'feedback'],
    compound: { parent: 'Dialog', slots: ['DialogHeader', 'DialogTitle', 'DialogDescription', 'DialogFooter'], strict: false } as CompoundRelation,
  },

  DialogHeader: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => <div className={element.props['className'] as string ?? 'space-y-1'}>{children}</div>,
    description: 'Dialog header area.',
    hasChildren: true, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'feedback'],
  },

  DialogTitle: {
    schema: Schema.Struct({ text: Schema.String, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => <h3 className={element.props['className'] as string ?? 'font-mono font-medium'} style={{ fontSize: H.sm, color: H.text }}>{element.props['text'] as string}</h3>,
    description: 'Dialog title.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'feedback'],
  },

  DialogDescription: {
    schema: Schema.Struct({ text: Schema.String, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => <p className={element.props['className'] as string ?? 'font-mono'} style={{ fontSize: H.sm, color: H.textDim }}>{element.props['text'] as string}</p>,
    description: 'Dialog description text.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'feedback'],
  },

  DialogFooter: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <div className={element.props['className'] as string ?? 'flex items-center justify-end gap-2 pt-2'} style={{ borderTop: `1px solid ${H.borderSubtle}` }}>
        {children}
      </div>
    ),
    description: 'Dialog footer. Right-aligned actions, top separator.',
    hasChildren: true, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'feedback'],
  },

  Sheet: {
    schema: Schema.Struct({ side: Schema.optional(Schema.Literal('left', 'right', 'top', 'bottom')), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        <HeaderBar accent={H.violet}>
          <HLabel color={H.violet}>sheet · {element.props['side'] as string ?? 'right'}</HLabel>
        </HeaderBar>
        <div className="px-3 py-3">{children}</div>
      </Shell>
    ),
    description: 'Slide-out panel shell. Violet accent.',
    hasChildren: true, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'feedback'],
    compound: { parent: 'Sheet', slots: ['SheetHeader', 'SheetContent'], strict: false } as CompoundRelation,
  },
}

// =============================================================================
// 7. NAVIGATION
// =============================================================================

const navigationComponents: Record<string, any> = {
  Tabs: {
    schema: Schema.Struct({ defaultValue: CN, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => <Tabs defaultValue={element.props['defaultValue'] as string} className={element.props['className'] as string}>{children}</Tabs>,
    description: 'Tab container.',
    hasChildren: true, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'navigation'],
    compound: { parent: 'Tabs', slots: ['TabsList', 'TabsContent'], strict: false } as CompoundRelation,
  },
  TabsList: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <TabsList className={element.props['className'] as string ?? 'bg-transparent border-b border-neutral-800 rounded-none h-auto p-0 gap-0'}>
        {children}
      </TabsList>
    ),
    description: 'Tab trigger bar. Transparent bg, bottom border.',
    hasChildren: true, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'navigation'],
  },
  TabsTrigger: {
    schema: Schema.Struct({ value: Schema.String, label: Schema.String, disabled: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <TabsTrigger
        value={element.props['value'] as string}
        disabled={element.props['disabled'] as boolean}
        className={element.props['className'] as string ?? 'font-mono rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-500 data-[state=active]:text-cyan-400 data-[state=active]:bg-transparent text-neutral-500 hover:text-neutral-300 px-4 py-2 transition-colors'}
        style={{ fontSize: H.xs }}
      >
        {element.props['label'] as string}
      </TabsTrigger>
    ),
    description: 'Tab trigger. Cyan underline when active.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'navigation'],
  },
  TabsContent: {
    schema: Schema.Struct({ value: Schema.String, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => <TabsContent value={element.props['value'] as string} className={element.props['className'] as string ?? 'pt-3'}>{children}</TabsContent>,
    description: 'Tab content panel.',
    hasChildren: true, defaultEntrance: A.slide, tier: 'domain' as const, domains: ['ui', 'navigation'],
  },

  Accordion: {
    schema: Schema.Struct({ type: Schema.optional(Schema.Literal('single', 'multiple')), collapsible: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => <Accordion type={(element.props['type'] as any) ?? 'single'} collapsible={element.props['collapsible'] as boolean ?? true} className={element.props['className'] as string}>{children}</Accordion>,
    description: 'Collapsible accordion.',
    hasChildren: true, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'navigation'],
    compound: { parent: 'Accordion', slots: ['AccordionItem'], strict: true } as CompoundRelation,
  },
  AccordionItem: {
    schema: Schema.Struct({ value: Schema.String, trigger: Schema.String, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <AccordionItem value={element.props['value'] as string} className={element.props['className'] as string ?? 'border-neutral-800'}>
        <AccordionTrigger className="font-mono text-neutral-300 hover:text-neutral-100 hover:no-underline py-2.5 px-1" style={{ fontSize: H.sm }}>
          {element.props['trigger'] as string}
        </AccordionTrigger>
        <AccordionContent className="px-1 pb-3 font-mono" style={{ fontSize: H.sm, color: H.textMid }}>
          {children}
        </AccordionContent>
      </AccordionItem>
    ),
    description: 'Accordion section. Dark borders, monospace.',
    hasChildren: true, defaultEntrance: A.slide, tier: 'domain' as const, domains: ['ui', 'navigation'],
  },

  Breadcrumb: {
    schema: Schema.Struct({ items: Schema.Array(Schema.Struct({ label: Schema.String, href: CN })), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const items = (element.props['items'] as Array<{ label: string; href?: string }>) ?? []
      return (
        <nav className={element.props['className'] as string ?? 'flex items-center gap-1.5 font-mono'} style={{ fontSize: H.xs }}>
          {items.map((item, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span style={{ color: H.textGhost }}>/</span>}
              {i < items.length - 1 ? (
                <a href={item.href} style={{ color: H.textDim }} className="hover:text-neutral-300 transition-colors">{item.label}</a>
              ) : (
                <span style={{ color: H.text }}>{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )
    },
    description: 'Breadcrumb with / separators. Last item bright, others dim.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'navigation'],
  },

  Collapsible: {
    schema: Schema.Struct({ defaultOpen: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => <Collapsible defaultOpen={element.props['defaultOpen'] as boolean} className={element.props['className'] as string}>{children}</Collapsible>,
    description: 'Collapsible section.',
    hasChildren: true, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'navigation'],
    compound: { parent: 'Collapsible', slots: ['CollapsibleTrigger', 'CollapsibleContent'], strict: false } as CompoundRelation,
  },
  CollapsibleTrigger: {
    schema: Schema.Struct({ text: Schema.String, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <CollapsibleTrigger className={element.props['className'] as string ?? 'font-mono flex items-center gap-2 py-1.5 transition-colors hover:text-neutral-200'} style={{ fontSize: H.sm, color: H.textMid }}>
        <span style={{ fontSize: H.xs }}>▸</span>
        {element.props['text'] as string}
      </CollapsibleTrigger>
    ),
    description: 'Collapsible trigger with ▸ glyph.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'navigation'],
  },
  CollapsibleContent: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => <CollapsibleContent className={element.props['className'] as string ?? 'pl-5 pt-1'}>{children}</CollapsibleContent>,
    description: 'Collapsible content area.',
    hasChildren: true, defaultEntrance: A.slide, tier: 'domain' as const, domains: ['ui', 'navigation'],
  },
}

// =============================================================================
// 8. INTERACTIVE
// =============================================================================

const interactiveComponents: Record<string, any> = {
  InlineTerminal: {
    schema: Schema.Struct({ lines: Schema.Array(Schema.String), title: CN, maxHeight: Schema.optional(Schema.Number), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const lines = (element.props['lines'] as string[]) ?? []
      return (
        <Shell className={element.props['className'] as string}>
          {element.props['title'] && (
            <HeaderBar>
              <div className="flex items-center gap-2">
                <span style={{ color: H.green, fontSize: H.xs }}>●</span>
                <HLabel>{element.props['title'] as string}</HLabel>
              </div>
            </HeaderBar>
          )}
          <pre
            className="px-3 py-2.5 font-mono overflow-x-auto"
            style={{ fontSize: H.xs, color: H.textMid, lineHeight: 1.7, maxHeight: element.props['maxHeight'] as number ?? 300, overflowY: 'auto' }}
          >
            {lines.map((l, i) => (
              <span key={i} className="block">
                <span style={{ color: H.textGhost, userSelect: 'none', display: 'inline-block', width: 32, textAlign: 'right', marginRight: 12 }}>{i + 1}</span>
                {l}
              </span>
            ))}
          </pre>
        </Shell>
      )
    },
    description: 'Terminal output with line numbers. Green status dot in header.',
    hasChildren: false, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'terminal', 'interactive'],
  },

  CodeBlock: {
    schema: Schema.Struct({ code: Schema.String, language: CN, title: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        <HeaderBar>
          <div className="flex items-center gap-2">
            {element.props['title'] && <HLabel>{element.props['title'] as string}</HLabel>}
          </div>
          {element.props['language'] && (
            <span className="font-mono px-1.5 py-0.5 rounded" style={{ fontSize: H.xs, background: `${H.violet}12`, color: H.violet, border: `1px solid ${H.violet}25` }}>
              {element.props['language'] as string}
            </span>
          )}
        </HeaderBar>
        <pre className="px-3 py-2.5 font-mono overflow-x-auto" style={{ fontSize: H.xs, color: H.text, lineHeight: 1.6 }}>
          <code>{element.props['code'] as string}</code>
        </pre>
      </Shell>
    ),
    description: 'Code block with language badge (violet).',
    hasChildren: false, defaultEntrance: A.slide,
    tier: 'domain' as const, domains: ['ui', 'terminal', 'interactive'],
  },

  CopyButton: {
    schema: Schema.Struct({ text: Schema.String, label: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <button
        type="button"
        className={element.props['className'] as string ?? 'inline-flex items-center gap-1.5 font-mono px-2.5 py-1 rounded transition-all active:scale-[0.97]'}
        style={{ fontSize: H.xs, color: H.textMid, background: 'transparent', border: `1px solid ${H.borderSubtle}` }}
        onClick={() => navigator.clipboard?.writeText(element.props['text'] as string)}
      >
        <span style={{ fontSize: 10 }}>⎘</span>
        {element.props['label'] as string ?? 'Copy'}
      </button>
    ),
    description: 'Copy-to-clipboard button with ⎘ glyph.',
    hasChildren: false, defaultEntrance: A.quick, tier: 'domain' as const, domains: ['ui', 'interactive'],
  },

  ToggleButton: {
    schema: Schema.Struct({ label: Schema.String, pressed: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <Toggle
        defaultPressed={element.props['pressed'] as boolean}
        className={element.props['className'] as string ?? 'font-mono border-neutral-800 data-[state=on]:bg-cyan-500/10 data-[state=on]:text-cyan-400 data-[state=on]:border-cyan-500/30 text-neutral-500 hover:text-neutral-300 active:scale-[0.97]'}
        style={{ fontSize: H.xs }}
      >
        {element.props['label'] as string}
      </Toggle>
    ),
    description: 'Toggle button. Cyan glow when pressed.',
    hasChildren: false, defaultEntrance: A.quick, tier: 'domain' as const, domains: ['ui', 'interactive'],
  },

  Popover: {
    schema: Schema.Struct({ triggerLabel: CN, className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        <div className="px-3 py-2.5">{children}</div>
      </Shell>
    ),
    description: 'Popover content shell.',
    hasChildren: true, defaultEntrance: A.pop,
    tier: 'domain' as const, domains: ['ui', 'interactive'],
    compound: { parent: 'Popover', slots: ['PopoverTrigger', 'PopoverContent'], strict: false } as CompoundRelation,
  },

  DropdownMenu: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        <div className="py-1">{children}</div>
      </Shell>
    ),
    description: 'Dropdown menu shell.',
    hasChildren: true, defaultEntrance: A.pop,
    tier: 'domain' as const, domains: ['ui', 'interactive'],
    compound: { parent: 'DropdownMenu', slots: ['DropdownItem', 'DropdownSeparator'], strict: false } as CompoundRelation,
  },

  DropdownItem: {
    schema: Schema.Struct({ label: Schema.String, icon: CN, shortcut: CN, variant: Schema.optional(Schema.Literal('default', 'destructive')), disabled: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const destructive = element.props['variant'] === 'destructive'
      return (
        <button
          type="button"
          disabled={element.props['disabled'] as boolean}
          className={element.props['className'] as string ?? 'w-full flex items-center justify-between px-3 py-1.5 font-mono transition-colors disabled:opacity-30'}
          style={{
            fontSize: H.sm,
            color: destructive ? H.red : H.textMid,
            background: 'transparent',
            border: 'none',
            cursor: element.props['disabled'] ? 'default' : 'pointer',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.background = `rgba(255,255,255,0.03)` }}
          onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent' }}
        >
          <span className="flex items-center gap-2">
            {element.props['icon'] && <span style={{ fontSize: H.xs }}>{element.props['icon'] as string}</span>}
            {element.props['label'] as string}
          </span>
          {element.props['shortcut'] && <span style={{ fontSize: H.xs, color: H.textGhost }}>{element.props['shortcut'] as string}</span>}
        </button>
      )
    },
    description: 'Dropdown item. Shortcut hint right-aligned.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'interactive'],
  },

  DropdownSeparator: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element }: ComponentRenderProps) => <div className={element.props['className'] as string ?? 'my-1'} style={{ height: 1, background: H.borderSubtle }} />,
    description: 'Menu separator line.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'interactive'],
  },

  HoverCard: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        <div className="px-3 py-2.5">{children}</div>
      </Shell>
    ),
    description: 'Hover card content shell.',
    hasChildren: true, defaultEntrance: A.pop,
    tier: 'domain' as const, domains: ['ui', 'interactive'],
  },

  ToggleGroup: {
    schema: Schema.Struct({ type: Schema.optional(Schema.Literal('single', 'multiple')), className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <ToggleGroup type={(element.props['type'] as any) ?? 'single'} className={element.props['className'] as string ?? 'gap-0.5'}>
        {children}
      </ToggleGroup>
    ),
    description: 'Toggle group.',
    hasChildren: true, defaultEntrance: A.quick, tier: 'domain' as const, domains: ['ui', 'interactive'],
  },
}

// =============================================================================
// 9. MEDIA
// =============================================================================

const mediaComponents: Record<string, any> = {
  Video: {
    schema: Schema.Struct({ src: Schema.String, poster: CN, controls: Schema.optional(Schema.Boolean), autoplay: Schema.optional(Schema.Boolean), loop: Schema.optional(Schema.Boolean), muted: Schema.optional(Schema.Boolean), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        <video src={element.props['src'] as string} poster={element.props['poster'] as string} autoPlay={element.props['autoplay'] as boolean} controls={element.props['controls'] as boolean ?? true} loop={element.props['loop'] as boolean} muted={element.props['muted'] as boolean} style={{ display: 'block', width: '100%' }} />
      </Shell>
    ),
    description: 'Video in dark chrome shell.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'media'],
  },

  Audio: {
    schema: Schema.Struct({ src: Schema.String, title: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        {element.props['title'] && <HeaderBar><HLabel>{element.props['title'] as string}</HLabel></HeaderBar>}
        <div className="px-3 py-2.5">
          <audio src={element.props['src'] as string} controls className="w-full" style={{ colorScheme: 'dark' }} />
        </div>
      </Shell>
    ),
    description: 'Audio player in dark shell.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'media'],
  },

  Embed: {
    schema: Schema.Struct({ src: Schema.String, title: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <Shell className={element.props['className'] as string}>
        <HeaderBar>
          <HLabel>{element.props['title'] as string ?? 'embed'}</HLabel>
          <span className="font-mono" style={{ fontSize: H.xs, color: H.textGhost }}>↗</span>
        </HeaderBar>
        <iframe
          src={element.props['src'] as string}
          title={element.props['title'] as string ?? 'Embedded content'}
          sandbox="allow-scripts allow-same-origin"
          style={{ display: 'block', width: '100%', aspectRatio: '16/9', border: 'none' }}
        />
      </Shell>
    ),
    description: 'Embedded iframe with header label.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui', 'media'],
  },
}

// =============================================================================
// 10. STYLE UTILITIES
// =============================================================================

const styleComponents: Record<string, any> = {
  Kbd: {
    schema: Schema.Struct({ keys: Schema.Array(Schema.String), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const keys = (element.props['keys'] as string[]) ?? []
      return (
        <span className={element.props['className'] as string ?? 'inline-flex items-center gap-0.5'}>
          {keys.map((k, i) => (
            <span key={i}>
              {i > 0 && <span className="font-mono mx-0.5" style={{ fontSize: H.xs, color: H.textGhost }}>+</span>}
              <kbd
                className="font-mono inline-flex items-center justify-center px-1.5 py-0.5 rounded"
                style={{
                  fontSize: H.xs, color: H.textMid, minWidth: 22, textAlign: 'center',
                  background: H.bgHeader, border: `1px solid ${H.border}`,
                  boxShadow: `0 1px 0 ${H.textGhost}`,
                }}
              >
                {k}
              </kbd>
            </span>
          ))}
        </span>
      )
    },
    description: 'Keyboard shortcut badges. Physical key cap style.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui'],
  },

  Indicator: {
    schema: Schema.Struct({ status: Schema.Literal('online', 'offline', 'busy', 'away'), label: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const s = element.props['status'] as string
      const color = s === 'online' ? H.green : s === 'busy' ? H.red : s === 'away' ? H.amber : H.textGhost
      return (
        <span className={element.props['className'] as string ?? 'inline-flex items-center gap-2 font-mono'}>
          <Dot color={color} size={7} />
          {element.props['label'] && <span style={{ fontSize: H.xs, color: H.textDim }}>{element.props['label'] as string}</span>}
        </span>
      )
    },
    description: 'Status indicator dot with glow. online(green), busy(red), away(amber), offline(ghost).',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui'],
  },

  Highlight: {
    schema: Schema.Struct({ text: Schema.String, query: Schema.String, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const text = element.props['text'] as string
      const query = element.props['query'] as string
      if (!query) return <span className={element.props['className'] as string ?? 'font-mono'} style={{ fontSize: H.sm, color: H.textMid }}>{text}</span>
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
      return (
        <span className={element.props['className'] as string ?? 'font-mono'} style={{ fontSize: H.sm, color: H.textMid }}>
          {parts.map((p, i) => p.toLowerCase() === query.toLowerCase()
            ? <mark key={i} style={{ background: `${H.cyan}25`, color: H.cyan, padding: '0 2px', borderRadius: 2 }}>{p}</mark>
            : p
          )}
        </span>
      )
    },
    description: 'Text with cyan highlighted search match.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui'],
  },

  Truncate: {
    schema: Schema.Struct({ text: Schema.String, lines: Schema.optional(Schema.Literal('1', '2', '3')), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => {
      const lines = parseInt(element.props['lines'] as string ?? '2')
      return (
        <p
          className={element.props['className'] as string ?? 'font-mono'}
          style={{
            fontSize: H.sm, color: H.textMid,
            display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {element.props['text'] as string}
        </p>
      )
    },
    description: 'Clamped text with line limit.',
    hasChildren: false, defaultEntrance: A.fade, tier: 'domain' as const, domains: ['ui'],
  },
}

// =============================================================================
// 11. WIRING — Pre-wired Action Compounds
// =============================================================================

const wiringComponents: Record<string, any> = {
  SearchBar: {
    schema: Schema.Struct({ placeholder: CN, onSearch: CN, onClear: CN, className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div className={element.props['className'] as string ?? 'flex items-center gap-2'}>
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono" style={{ fontSize: H.xs, color: H.textGhost }}>⌕</span>
          <Input
            placeholder={element.props['placeholder'] as string ?? 'Search…'}
            className="pl-8 font-mono border-neutral-800 bg-[rgba(10,10,10,0.8)] text-neutral-300 placeholder:text-neutral-600 focus:border-cyan-500/50 focus:ring-cyan-500/20"
            style={{ fontSize: H.sm }}
          />
        </div>
        <button
          type="button"
          className="font-mono px-3 py-2 rounded transition-all active:scale-[0.97]"
          style={{ fontSize: H.xs, color: H.cyan, background: `${H.cyan}10`, border: `1px solid ${H.cyan}25` }}
        >
          Search
        </button>
      </div>
    ),
    description: 'Search bar with ⌕ prefix glyph, cyan action button. Wire via @action:tag in ActionGroup.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms', 'data'],
  },

  FilterBar: {
    schema: Schema.Struct({ className: CN }),
    renderer: ({ element, children }: ComponentRenderProps) => (
      <div className={element.props['className'] as string ?? 'flex items-center gap-2 flex-wrap'}>
        {children}
        <div className="flex items-center gap-1.5 ml-auto">
          <button type="button" className="font-mono px-2.5 py-1 rounded transition-all active:scale-[0.97]" style={{ fontSize: H.xs, color: H.cyan, background: `${H.cyan}10`, border: `1px solid ${H.cyan}25` }}>
            Apply
          </button>
          <button type="button" className="font-mono px-2.5 py-1 rounded transition-all active:scale-[0.97]" style={{ fontSize: H.xs, color: H.textDim, background: 'transparent', border: `1px solid ${H.borderSubtle}` }}>
            Reset
          </button>
        </div>
      </div>
    ),
    description: 'Filter controls with Apply (cyan) + Reset (ghost). Children: form inputs.',
    hasChildren: true, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'forms', 'data'],
  },

  RefreshControl: {
    schema: Schema.Struct({ onRefresh: CN, autoRefresh: Schema.optional(Schema.Boolean), intervalMs: Schema.optional(Schema.Number), className: CN }),
    renderer: ({ element }: ComponentRenderProps) => (
      <div className={element.props['className'] as string ?? 'flex items-center gap-2 font-mono'}>
        <button type="button" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-all active:scale-[0.97]" style={{ fontSize: H.xs, color: H.textMid, border: `1px solid ${H.borderSubtle}` }}>
          <span style={{ display: 'inline-block' }}>↻</span> Refresh
        </button>
        {element.props['autoRefresh'] && (
          <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded" style={{ fontSize: H.xs, background: `${H.green}10`, color: H.green, border: `1px solid ${H.green}20` }}>
            <Dot color={H.green} size={5} /> auto
          </span>
        )}
      </div>
    ),
    description: 'Refresh button with optional green auto-refresh badge.',
    hasChildren: false, defaultEntrance: A.quick,
    tier: 'domain' as const, domains: ['ui', 'data'],
  },
}

// =============================================================================
// EXPORT
// =============================================================================

export const coreDomainCatalog: DomainCatalog = {
  name: 'TMNL Core',
  defaultTier: 'core',
  defaultDomains: ['ui'],
  components: {
    ...coreComponents,
    ...primitiveComponents,
    ...formsComponents,
    ...cardsComponents,
    ...dataComponents,
    ...feedbackComponents,
    ...navigationComponents,
    ...interactiveComponents,
    ...mediaComponents,
    ...styleComponents,
    ...wiringComponents,
  },
}
