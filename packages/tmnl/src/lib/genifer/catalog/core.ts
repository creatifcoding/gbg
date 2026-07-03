/**
 * @fileoverview Core Catalog — 16 Tier 1 Components
 *
 * Registers all core components as CatalogEntry[] and exports as a DomainCatalog.
 * This replaces the old 1899-line core-domain-catalog.tsx.
 *
 * Components: Grid, Box, Separator, Text, Heading, Code, Image,
 *             Card, Alert, Badge, Button, Input, Link, List, ListItem, Progress
 *
 * Spec: src/lib/genifer/docs/specs/CATALOG_REBUILD_SPEC.md §9
 *
 * @module genifer/catalog/core
 */

import { Schema } from 'effect'
import type { DomainCatalog } from '@/lib/genifer/core/CatalogService'
import type { CatalogEntry } from './types'
import { DEFAULT_POLICIES } from './types'
import { ENTRANCE } from './tokens'

// Renderers
import {
  GridRenderer,
  BoxRenderer,
  SeparatorRenderer,
  TextRenderer,
  HeadingRenderer,
  CodeRenderer,
  ImageRenderer,
  CardRenderer,
  AlertRenderer,
  BadgeRenderer,
  ButtonRenderer,
  InputRenderer,
  LinkRenderer,
  ListRenderer,
  ListItemRenderer,
  ProgressRenderer,
} from './renderers'

// =============================================================================
// Schema helpers
// =============================================================================

const CN = Schema.optional(Schema.String)
const OptStr = Schema.optional(Schema.String)
const OptNum = Schema.optional(Schema.Number)
const OptBool = Schema.optional(Schema.Boolean)

// =============================================================================
// Core Catalog Entries (16 components)
// =============================================================================

export const CORE_ENTRIES: CatalogEntry[] = [
  // ─── Layout ─────────────────────────────────────────────────────────────

  {
    type: 'Grid',
    tier: 'core',
    category: 'layout',
    container: true,
    classNamePolicy: DEFAULT_POLICIES.layout,
    description: 'Primary layout primitive. columns=1 for vertical stack, columns=N for grid, flow="column" for horizontal.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      columns: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
      rows: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
      gap: Schema.optional(Schema.Literal('xs', 'sm', 'md', 'lg', 'xl')),
      flow: Schema.optional(Schema.Literal('row', 'column', 'dense')),
      areas: OptStr,
      align: Schema.optional(Schema.Literal('start', 'center', 'end', 'stretch')),
      justify: Schema.optional(Schema.Literal('start', 'center', 'end', 'between')),
      className: CN,
    }),
    propsSchema: {
      columns: { type: 'number', description: 'Column count (number) or template string' },
      rows: { type: 'number', description: 'Row count or template string' },
      gap: { type: 'enum', values: ['xs', 'sm', 'md', 'lg', 'xl'], default: 'md', description: 'Gap between children' },
      flow: { type: 'enum', values: ['row', 'column', 'dense'], description: 'Auto-flow direction' },
      align: { type: 'enum', values: ['start', 'center', 'end', 'stretch'], description: 'Cross-axis alignment' },
      justify: { type: 'enum', values: ['start', 'center', 'end', 'between'], description: 'Main-axis distribution' },
    },
    renderer: GridRenderer,
  },

  {
    type: 'Box',
    tier: 'core',
    category: 'layout',
    container: true,
    classNamePolicy: DEFAULT_POLICIES.layout,
    description: 'Single-child wrapper for padding, overflow, and positioning.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      padding: Schema.optional(Schema.Literal('xs', 'sm', 'md', 'lg', 'xl')),
      overflow: Schema.optional(Schema.Literal('hidden', 'auto', 'scroll')),
      position: Schema.optional(Schema.Literal('relative', 'absolute')),
      className: CN,
    }),
    propsSchema: {
      padding: { type: 'enum', values: ['xs', 'sm', 'md', 'lg', 'xl'], description: 'Internal padding' },
      overflow: { type: 'enum', values: ['hidden', 'auto', 'scroll'] },
      position: { type: 'enum', values: ['relative', 'absolute'] },
    },
    renderer: BoxRenderer,
  },

  {
    type: 'Separator',
    tier: 'core',
    category: 'layout',
    container: false,
    classNamePolicy: { allow: [] },
    description: 'Hairline divider — horizontal or vertical.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      orientation: Schema.optional(Schema.Literal('horizontal', 'vertical')),
    }),
    propsSchema: {
      orientation: { type: 'enum', values: ['horizontal', 'vertical'], default: 'horizontal' },
    },
    renderer: SeparatorRenderer,
  },

  // ─── Content ────────────────────────────────────────────────────────────

  {
    type: 'Text',
    tier: 'core',
    category: 'content',
    container: false,
    classNamePolicy: DEFAULT_POLICIES.content,
    description: 'Rich text with typographic hierarchy. Use preset for fast defaults, override individual props for custom composition.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      text: OptStr,
      content: OptStr,
      preset: Schema.optional(Schema.Literal('body', 'label', 'caption', 'value', 'micro', 'title', 'subtitle')),
      color: Schema.optional(Schema.Literal('primary', 'secondary', 'tertiary', 'muted')),
      accent: Schema.optional(Schema.Literal('cyan', 'emerald', 'amber', 'rose', 'violet')),
      weight: Schema.optional(Schema.Literal('normal', 'medium', 'semibold', 'bold')),
      size: Schema.optional(Schema.Literal('2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl')),
      family: Schema.optional(Schema.Literal('mono', 'grotesk', 'sans', 'data')),
      tracking: Schema.optional(Schema.Literal('tight', 'normal', 'wide', 'wider', 'widest')),
      leading: Schema.optional(Schema.Literal('none', 'tight', 'snug', 'normal', 'relaxed')),
      transform: Schema.optional(Schema.Literal('uppercase', 'lowercase', 'capitalize', 'none')),
      align: Schema.optional(Schema.Literal('left', 'center', 'right')),
      truncate: OptBool,
      maxLines: OptNum,
      as: Schema.optional(Schema.Literal('p', 'span', 'div', 'strong', 'em', 'small', 'code')),
      className: CN,
    }),
    propsSchema: {
      text: { type: 'string', description: 'Visible text content' },
      content: { type: 'string', description: 'Visible text content (alias for text)' },
      preset: { type: 'enum', values: ['body', 'label', 'caption', 'value', 'micro', 'title', 'subtitle'], default: 'body', description: 'Typographic preset' },
      color: { type: 'enum', values: ['primary', 'secondary', 'tertiary', 'muted'], description: 'Text color from hierarchy' },
      accent: { type: 'enum', values: ['cyan', 'emerald', 'amber', 'rose', 'violet'], description: 'Accent color override' },
      weight: { type: 'enum', values: ['normal', 'medium', 'semibold', 'bold'], description: 'Font weight' },
      size: { type: 'enum', values: ['2xs', 'xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl'], description: 'Font size' },
      family: { type: 'enum', values: ['mono', 'grotesk', 'sans', 'data'], description: 'Font family' },
      tracking: { type: 'enum', values: ['tight', 'normal', 'wide', 'wider', 'widest'], description: 'Letter spacing' },
      leading: { type: 'enum', values: ['none', 'tight', 'snug', 'normal', 'relaxed'], description: 'Line height' },
      transform: { type: 'enum', values: ['uppercase', 'lowercase', 'capitalize', 'none'], description: 'Text transform' },
      align: { type: 'enum', values: ['left', 'center', 'right'], description: 'Text alignment' },
      truncate: { type: 'boolean', description: 'Truncate with ellipsis' },
      maxLines: { type: 'number', description: 'Max lines before clamp' },
      as: { type: 'enum', values: ['p', 'span', 'div', 'strong', 'em', 'small', 'code'], description: 'HTML element' },
    },
    renderer: TextRenderer,
  },

  {
    type: 'Heading',
    tier: 'core',
    category: 'content',
    container: false,
    classNamePolicy: DEFAULT_POLICIES.content,
    description: 'Section heading. Level 1: large grotesk. Level 2: medium grotesk. Level 3: mono label uppercase.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      text: OptStr,
      content: OptStr,
      level: Schema.optional(Schema.Literal(1, 2, 3)),
      className: CN,
    }),
    propsSchema: {
      text: { type: 'string', description: 'Visible heading text' },
      content: { type: 'string', description: 'Visible heading text (alias for text)' },
      level: { type: 'enum', values: ['1', '2', '3'], default: '1', description: 'Heading level (1–3)' },
    },
    renderer: HeadingRenderer,
  },

  {
    type: 'Code',
    tier: 'core',
    category: 'content',
    container: false,
    classNamePolicy: DEFAULT_POLICIES.content,
    description: 'Code block or inline code. Set inline=true for inline.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      code: OptStr,
      content: OptStr,
      language: OptStr,
      inline: OptBool,
      className: CN,
    }),
    propsSchema: {
      code: { type: 'string', description: 'Visible code text' },
      content: { type: 'string', description: 'Visible code text (alias for code)' },
      language: { type: 'string', description: 'Programming language' },
      inline: { type: 'boolean', default: false, description: 'Inline vs block' },
    },
    renderer: CodeRenderer,
  },

  {
    type: 'Image',
    tier: 'core',
    category: 'content',
    container: false,
    classNamePolicy: DEFAULT_POLICIES.content,
    description: 'Image with optional aspect ratio constraint.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      src: Schema.String,
      alt: OptStr,
      aspectRatio: OptStr,
    }),
    propsSchema: {
      src: { type: 'string', description: 'Image URL (required)' },
      alt: { type: 'string', description: 'Alt text' },
      aspectRatio: { type: 'string', description: 'CSS aspect-ratio (e.g. "16/9")' },
    },
    renderer: ImageRenderer,
  },

  // ─── Surface ────────────────────────────────────────────────────────────

  {
    type: 'Card',
    tier: 'core',
    category: 'surface',
    container: true,
    classNamePolicy: DEFAULT_POLICIES.surface,
    description: 'Bordered surface card. Variants: default, elevated, compact, ghost.',
    defaultEntrance: ENTRANCE.slide,
    schema: Schema.Struct({
      variant: Schema.optional(Schema.Literal('default', 'elevated', 'compact', 'ghost')),
      title: OptStr,
      description: OptStr,
      padding: Schema.optional(Schema.Literal('xs', 'sm', 'md', 'lg', 'xl')),
      className: CN,
    }),
    propsSchema: {
      variant: { type: 'enum', values: ['default', 'elevated', 'compact', 'ghost'], default: 'default' },
      title: { type: 'string', description: 'Card title (rendered in label style)' },
      description: { type: 'string', description: 'Card subtitle' },
      padding: { type: 'enum', values: ['xs', 'sm', 'md', 'lg', 'xl'], description: 'Override internal padding' },
    },
    renderer: CardRenderer,
  },

  {
    type: 'Alert',
    tier: 'core',
    category: 'surface',
    container: true,
    classNamePolicy: DEFAULT_POLICIES.surface,
    description: 'Alert with left border accent. Intents: info (cyan), success (green), warning (amber), danger (rose).',
    defaultEntrance: ENTRANCE.slide,
    schema: Schema.Struct({
      intent: Schema.optional(Schema.Literal('info', 'success', 'warning', 'danger')),
      title: OptStr,
      className: CN,
    }),
    propsSchema: {
      intent: { type: 'enum', values: ['info', 'success', 'warning', 'danger'], default: 'info' },
      title: { type: 'string', description: 'Alert title' },
    },
    renderer: AlertRenderer,
  },

  {
    type: 'Badge',
    tier: 'core',
    category: 'surface',
    container: false,
    classNamePolicy: { allow: [] },
    description: 'Pill badge with accent color. Intents: info, success, warning, danger, neutral.',
    defaultEntrance: ENTRANCE.pop,
    schema: Schema.Struct({
      intent: Schema.optional(Schema.Literal('info', 'success', 'warning', 'danger', 'neutral')),
    }),
    propsSchema: {
      intent: { type: 'enum', values: ['info', 'success', 'warning', 'danger', 'neutral'], default: 'info' },
    },
    renderer: BadgeRenderer,
  },

  // ─── Interactive ────────────────────────────────────────────────────────

  {
    type: 'Button',
    tier: 'core',
    category: 'interactive',
    container: false,
    classNamePolicy: DEFAULT_POLICIES.interactive,
    description: 'Animated button — outlined at rest, fill-on-hover with glow. Variants: primary (cyan), secondary, ghost, danger (rose).',
    defaultEntrance: ENTRANCE.pop,
    schema: Schema.Struct({
      variant: Schema.optional(Schema.Literal('primary', 'secondary', 'ghost', 'danger')),
      size: Schema.optional(Schema.Literal('sm', 'md', 'lg')),
      disabled: OptBool,
      onAction: OptStr,
      className: CN,
    }),
    propsSchema: {
      variant: { type: 'enum', values: ['primary', 'secondary', 'ghost', 'danger'], default: 'primary' },
      size: { type: 'enum', values: ['sm', 'md', 'lg'], default: 'md' },
      disabled: { type: 'boolean', default: false },
      onAction: { type: 'string', description: 'Action ID for click handler' },
    },
    renderer: ButtonRenderer,
  },

  {
    type: 'Input',
    tier: 'core',
    category: 'interactive',
    container: false,
    classNamePolicy: DEFAULT_POLICIES.interactive,
    description: 'Text input with label, placeholder, and error state. Cyan focus ring, rose error border.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      label: OptStr,
      placeholder: OptStr,
      error: OptStr,
      type: Schema.optional(Schema.Literal('text', 'number', 'password', 'email')),
      defaultValue: OptStr,
      disabled: OptBool,
      className: CN,
    }),
    propsSchema: {
      label: { type: 'string', description: 'Label text above input' },
      placeholder: { type: 'string', description: 'Placeholder text' },
      error: { type: 'string', description: 'Error message (shows rose border)' },
      type: { type: 'enum', values: ['text', 'number', 'password', 'email'], default: 'text' },
      defaultValue: { type: 'string' },
      disabled: { type: 'boolean', default: false },
    },
    renderer: InputRenderer,
  },

  {
    type: 'Link',
    tier: 'core',
    category: 'interactive',
    container: false,
    classNamePolicy: { allow: [] },
    description: 'Cyan link with underline on hover.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      href: OptStr,
    }),
    propsSchema: {
      href: { type: 'string', description: 'URL target' },
    },
    renderer: LinkRenderer,
  },

  // ─── Data ───────────────────────────────────────────────────────────────

  {
    type: 'List',
    tier: 'core',
    category: 'data',
    container: true,
    classNamePolicy: DEFAULT_POLICIES.data,
    description: 'List container. Variants: plain (no separators), bordered (hairline between items), status (accent dots).',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      variant: Schema.optional(Schema.Literal('plain', 'bordered', 'status')),
      gap: Schema.optional(Schema.Literal('xs', 'sm', 'md', 'lg', 'xl')),
      className: CN,
    }),
    propsSchema: {
      variant: { type: 'enum', values: ['plain', 'bordered', 'status'], default: 'plain' },
      gap: { type: 'enum', values: ['xs', 'sm', 'md', 'lg', 'xl'], default: 'xs' },
    },
    renderer: ListRenderer,
  },

  {
    type: 'ListItem',
    tier: 'core',
    category: 'data',
    container: true,
    classNamePolicy: DEFAULT_POLICIES.data,
    description: 'List item with optional leading indicator and trailing metadata.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      leading: OptStr,
      trailing: OptStr,
      className: CN,
    }),
    propsSchema: {
      leading: { type: 'string', description: 'Leading element (shows as accent dot)' },
      trailing: { type: 'string', description: 'Trailing text (timestamp, metadata)' },
    },
    renderer: ListItemRenderer,
  },

  {
    type: 'Progress',
    tier: 'core',
    category: 'data',
    container: false,
    classNamePolicy: DEFAULT_POLICIES.data,
    description: 'Thin progress bar with intent-colored fill. value: 0–100.',
    defaultEntrance: ENTRANCE.fade,
    schema: Schema.Struct({
      value: Schema.Number,
      intent: Schema.optional(Schema.Literal('info', 'success', 'warning', 'danger')),
      className: CN,
    }),
    propsSchema: {
      value: { type: 'number', description: 'Progress value 0–100 (required)' },
      intent: { type: 'enum', values: ['info', 'success', 'warning', 'danger'], default: 'info' },
    },
    renderer: ProgressRenderer,
  },
]

// =============================================================================
// Build DomainCatalog (bridge to existing CatalogService interface)
// =============================================================================

/**
 * Convert CatalogEntry[] to the ComponentDef record expected by DomainCatalog.
 */
function entriesToComponents(entries: CatalogEntry[]) {
  const components: Record<string, any> = {}
  for (const entry of entries) {
    components[entry.type] = {
      schema: entry.schema,
      renderer: entry.renderer,
      description: entry.description,
      hasChildren: entry.container,
      defaultEntrance: entry.defaultEntrance,
      tier: entry.tier,
      domains: entry.domains ?? ['ui'],
    }
  }
  return components
}

/**
 * The rebuilt core domain catalog.
 *
 * Drop-in replacement for the old `coreDomainCatalog`.
 * Same interface, 16 focused components instead of 84.
 */
export const coreVantaCatalog: DomainCatalog = {
  name: 'core-vanta',
  components: entriesToComponents(CORE_ENTRIES),
  defaultTier: 'core',
  defaultDomains: ['ui'],
}
