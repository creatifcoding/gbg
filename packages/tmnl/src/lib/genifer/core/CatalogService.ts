/**
 * @fileoverview Unified Catalog Service for genifer (Effect.Service pattern)
 *
 * Provides a generic registration point for component catalogs. Domains (layout, ui, forms)
 * self-register their components. The service is domain-agnostic - it just merges catalogs.
 *
 * Key insight: "The merge doesn't need to know what's being merged - just be the codepoint for it."
 *
 * Uses the modern Effect.Service pattern with:
 *   - `scoped:` constructor for lifecycle management
 *   - `accessors: true` for direct static access (`CatalogComponents.generatePrompt`)
 *   - Effect.fn for traced service methods
 *   - Effect.annotateCurrentSpan for observability
 *
 * @module genifer/core/CatalogService
 */

import { Context, Layer, Effect, JSONSchema } from "effect"
import * as Schema from "effect/Schema"
import type { ReactNode } from "react"
import type { UIElement, Action } from "./schemas"
import type { EntranceAnimation } from "./animation-schema"

// =============================================================================
// Types (domain-agnostic)
// =============================================================================

/**
 * Props passed to component renderers
 */
export interface ComponentRenderProps<P = Record<string, unknown>> {
  /** The element being rendered */
  readonly element: UIElement & { props: P }
  /** Rendered children */
  readonly children?: ReactNode
  /** Execute an action */
  readonly onAction?: (action: Action) => void
  /** Whether the parent is loading/streaming */
  readonly loading?: boolean
}

// =============================================================================
// Tier & Domain System
// =============================================================================

/**
 * Visibility tier for LLM prompt construction:
 *   - core: ALWAYS included in the system prompt (layout, text, button, card)
 *   - domain: included when the domain is active for the request
 *   - discovery: browsable via catalog query tools but not auto-included
 */
export type CatalogTier = 'core' | 'domain' | 'discovery'

/**
 * Domain tag for scoping catalogs at generation time.
 * A component can belong to multiple domains.
 */
export type CatalogDomain =
  | 'ui'           // Base UI primitives
  | 'layout'       // Layout containers
  | 'forms'        // Form inputs and validation
  | 'data'         // Data tables, grids, lists
  | 'media'        // Images, video, audio
  | 'charts'       // Data visualization
  | 'geoint'       // Geospatial intelligence
  | 'iiot'         // Industrial IoT
  | 'navigation'   // Nav, tabs, breadcrumbs
  | 'feedback'     // Alerts, toasts, progress
  | 'terminal'     // Terminal, code blocks
  | string         // Extensible

/**
 * Compound component relationship.
 * Pattern: Card.Header, Card.Content, Card.Footer
 */
export interface CompoundRelation {
  /** Parent component type (e.g., 'Card') */
  readonly parent: string
  /** Allowed child types (e.g., ['CardHeader', 'CardContent', 'CardFooter']) */
  readonly slots: ReadonlyArray<string>
  /** Whether children MUST be from the slots list */
  readonly strict?: boolean
}

/**
 * Component definition with schema and renderer
 *
 * Every component MUST have a defaultEntrance - animations are mandatory.
 */
export interface ComponentDef {
  /** Effect Schema for component props */
  readonly schema: Schema.Schema<any, any, never>
  /** React renderer for the component */
  readonly renderer: (props: ComponentRenderProps<any>) => ReactNode
  /** Description for AI generation */
  readonly description?: string
  /** Whether this component can have children */
  readonly hasChildren?: boolean
  /** Default entrance animation - REQUIRED (animations are mandatory) */
  readonly defaultEntrance: EntranceAnimation
  /** Visibility tier (default: 'core') */
  readonly tier?: CatalogTier
  /** Domain tags for scoping (default: ['ui']) */
  readonly domains?: ReadonlyArray<CatalogDomain>
  /** Compound component relationship */
  readonly compound?: CompoundRelation
}

/**
 * Domain catalog - a named collection of components
 */
export interface DomainCatalog {
  /** Domain name (e.g., "layout", "ui", "forms") */
  readonly name: string
  /** Component definitions keyed by type name */
  readonly components: Record<string, ComponentDef>
  /** Default tier for all components in this catalog (default: 'core') */
  readonly defaultTier?: CatalogTier
  /** Default domain tags for all components in this catalog */
  readonly defaultDomains?: ReadonlyArray<CatalogDomain>
}

/**
 * Schema entry (renderer omitted for serialization)
 *
 * Every component MUST have a defaultEntrance - animations are mandatory.
 */
export interface SchemaEntry {
  readonly schema: Schema.Schema<any, any, never>
  readonly description?: string
  readonly hasChildren?: boolean
  /** Default entrance animation - REQUIRED (animations are mandatory) */
  readonly defaultEntrance: EntranceAnimation
  /** Visibility tier */
  readonly tier: CatalogTier
  /** Domain tags */
  readonly domains: ReadonlyArray<CatalogDomain>
  /** Compound relationship */
  readonly compound?: CompoundRelation
}

// =============================================================================
// CatalogComponents Interface
// =============================================================================

/**
 * CatalogComponents service interface
 *
 * This is the generic registration point for all component catalogs.
 * It doesn't know about specific domains - domains self-register.
 */
export interface CatalogComponents {
  /** All registered renderers (merged from all domains) */
  readonly renderers: ReadonlyMap<string, ComponentDef["renderer"]>

  /** All registered schemas (merged from all domains) */
  readonly schemas: ReadonlyMap<string, SchemaEntry>

  /** Register a domain catalog at runtime */
  readonly register: (catalog: DomainCatalog) => void

  /** Generate AI prompt from all registered components */
  readonly generatePrompt: () => string

  /**
   * Generate AI prompt filtered by tier and/or domain.
   * - tier 'core' → only core components
   * - tier 'domain' → core + components matching any of the given domains
   * - tier 'discovery' → everything (for catalog browsing tools)
   * - domains filter further within the selected tier
   */
  readonly generateScopedPrompt: (options?: {
    /** Include up to this tier level (default: 'domain') */
    tier?: CatalogTier
    /** Only include components from these domains */
    domains?: ReadonlyArray<CatalogDomain>
  }) => string

  /** List all registered domain names */
  readonly listDomains: () => ReadonlyArray<string>

  /** Get compound relationships for a component type */
  readonly getCompound: (type: string) => CompoundRelation | undefined

  /** List all component types matching a tier/domain filter */
  readonly listComponents: (options?: {
    tier?: CatalogTier
    domains?: ReadonlyArray<CatalogDomain>
  }) => ReadonlyArray<string>
}

/**
 * Context.Tag for the CatalogComponents service.
 *
 * Retained for backward compatibility — existing code that does
 * `yield* CatalogComponents` or `Effect.service(CatalogComponents)` still works.
 * New code can use `CatalogComponents` directly as a tag.
 */
export const CatalogComponents = Context.GenericTag<CatalogComponents>(
  "genifer/CatalogComponents"
)

// =============================================================================
// Implementation Factory
// =============================================================================

/**
 * Create a CatalogComponents implementation
 *
 * Copy-on-write: each register() creates new Map snapshots so readers
 * never see a half-written state. The `renderers` and `schemas` getters
 * always return the latest snapshot.
 *
 * @param initialCatalogs - Optional catalogs to register at creation time
 */
export const makeCatalogComponents = (
  initialCatalogs: DomainCatalog[] = []
): CatalogComponents => {
  // COW snapshots — swapped atomically on register()
  let _renderers: ReadonlyMap<string, ComponentDef["renderer"]> = new Map()
  let _schemas: ReadonlyMap<string, SchemaEntry> = new Map()

  /**
   * Register a domain catalog (copy-on-write)
   *
   * Creates new Map instances with merged entries. Existing readers
   * hold references to the old (still-valid) snapshots.
   */
  const register = (catalog: DomainCatalog): void => {
    const nextRenderers = new Map(_renderers)
    const nextSchemas = new Map(_schemas)

    for (const [name, def] of Object.entries(catalog.components)) {
      nextRenderers.set(name, def.renderer)
      nextSchemas.set(name, {
        schema: def.schema,
        description: def.description,
        hasChildren: def.hasChildren,
        defaultEntrance: def.defaultEntrance,
        tier: def.tier ?? catalog.defaultTier ?? 'core',
        domains: def.domains ?? catalog.defaultDomains ?? ['ui'],
        compound: def.compound,
      })
    }

    // Track domain names
    if (!_domainNames.includes(catalog.name)) {
      _domainNames = [..._domainNames, catalog.name]
    }

    // Atomic swap — readers see either old or new, never partial
    _renderers = nextRenderers
    _schemas = nextSchemas
  }

  let _domainNames: string[] = []

  // Initialize with provided catalogs
  initialCatalogs.forEach(register)

  /**
   * Generate AI system prompt from all registered components
   */
  const generatePrompt = (): string => {
    const lines: string[] = []

    // Composition guidance section (CRITICAL for LLM understanding)
    lines.push(`# Component Composition

## Core Principle
**Any component can be a child of any container.** Containers (Grid, VStack, HStack, Flex, Box, Card, etc.) can hold any component listed in the current scoped catalog:
- Nested containers (layout-in-layout)
- Text/content primitives (Heading, Text, Code, List)
- Interactive controls (Button, Input, Textarea, Select, ActionButton)

## Container vs Leaf Components
- **Containers** (hasChildren: true): Can wrap other components. Use \`children\` array.
- **Leaf components** (hasChildren: false): Self-contained. Cannot have children but CAN be placed inside containers.

## Common Patterns

### Dashboard Shell
\`\`\`json
{
  "root": "layout",
  "elements": {
    "layout": {
      "type": "VStack",
      "props": { "gap": 16 },
      "children": ["header", "cta-row"]
    },
    "header": { "type": "Heading", "props": { "text": "Operations", "level": 1 }, "className": "font-mono text-cyan-300" },
    "cta-row": {
      "type": "HStack",
      "props": { "gap": 8 },
      "children": ["refresh", "export"]
    },
    "refresh": { "type": "Button", "props": { "label": "Refresh" } },
    "export": { "type": "Button", "props": { "label": "Export", "variant": "outline" } }
  }
}
\`\`\`

### Card Grid Pattern
\`\`\`json
{
  "root": "layout",
  "elements": {
    "layout": {
      "type": "Grid",
      "props": { "template": "1fr 1fr", "gap": 16 },
      "children": ["card-a", "card-b"]
    },
    "card-a": { "type": "Card", "props": { "title": "Latency" }, "children": ["a-value"] },
    "a-value": { "type": "Text", "props": { "text": "247ms" } },
    "card-b": { "type": "Card", "props": { "title": "Throughput" }, "children": ["b-value"] },
    "b-value": { "type": "Text", "props": { "text": "2,847 req/min" } }
  }
}
\`\`\`

## Rules
1. Every element needs a unique key in the \`elements\` object
2. Reference children by their key strings in the \`children\` array
3. Leaf components (hasChildren: false) should NOT have a \`children\` array
4. The \`root\` must reference a key that exists in \`elements\`

## Catalog Scope + Compatibility Aliases
Use only component types present in the generated **Available Components** section for this request scope.
Legacy aliases are supported for backward compatibility: \`Heading\`, \`Text\`, \`Card\`, \`Button\`, \`Input\`, \`TextInput\`, \`Badge\`, \`Alert\`, \`Separator\`, \`VStack\`, \`HStack\`, \`Grid\`, \`ActionButton\`, \`ButtonLabel\`, \`ButtonIcon\`.
Prefer canonical components in new outputs when possible.

`)

    // Styling documentation section
    lines.push(`# Styling — className

Every component accepts an optional \`className\` string with Tailwind utility classes for layout control.

Use className for: margins, padding, sizing, positioning, display overrides, responsive breakpoints, backgrounds, borders.
Use component props for: semantic behavior (text content, variant, level).

## Examples
\`\`\`json
{ "type": "Text", "key": "title", "props": { "text": "Dashboard" }, "className": "mb-6 text-center font-mono text-cyan-300" }
{ "type": "InfoCard", "key": "hero", "props": { "title": "Overview", "value": "Ready" }, "className": "w-full max-w-2xl mx-auto" }
{ "type": "ActionButton", "key": "submit", "props": { "label": "Save" }, "className": "mt-4 w-full" }
\`\`\`

## Common Patterns
- \`"className": "mt-4 px-6"\` — spacing
- \`"className": "w-full max-w-md mx-auto"\` — constrained centered width
- \`"className": "hidden md:block"\` — responsive visibility
- \`"className": "border border-zinc-700 rounded-lg"\` — borders + radius
- \`"className": "bg-zinc-900/50 backdrop-blur"\` — backgrounds

## Box Component
Use the \`Box\` component when you need pure Tailwind layout without semantic component structure:
\`\`\`json
{ "type": "Box", "key": "hero-section", "props": { "className": "flex items-center justify-center min-h-[60vh]", "as": "section" }, "children": [...] }
\`\`\`

`)

    // Animation documentation section
    lines.push(`# Entrance Animations

Each element can have an optional \`entrance\` object to control how it animates in:

\`\`\`typescript
entrance?: {
  property: 'opacity' | 'opacity+translateY' | 'opacity+translateX' | 'opacity+scale'
  easing: 'linear' | 'out-quad' | 'out-cubic' | 'out-quart' | 'out-back' | 'out-elastic'
  duration: 'instant' | 'fast' | 'normal' | 'slow' | 'slower'
  stagger?: boolean  // Animate children sequentially (50ms apart)
  delay?: number     // Additional delay in ms
}
\`\`\`

## Property Effects
- \`opacity\`: Simple fade in
- \`opacity+translateY\`: Fade + lift from below (good for lists, cards)
- \`opacity+translateX\`: Fade + slide from left (good for sidebars, menus)
- \`opacity+scale\`: Fade + grow (good for modals, focus elements)

## Easing Character
- \`out-quad\`: Smooth, professional
- \`out-cubic\`: Natural, comfortable (default)
- \`out-quart\`: Snappy, responsive
- \`out-back\`: Slight overshoot, playful
- \`out-elastic\`: Bouncy, attention-grabbing

## Duration Tokens
- \`instant\`: 0ms (no animation)
- \`fast\`: 100ms (quick accents)
- \`normal\`: 200ms (standard)
- \`slow\`: 300ms (deliberate)
- \`slower\`: 500ms (dramatic)

## Guidelines
- Containers (Grid, Flex): Use \`opacity\` only, \`fast\` or \`normal\`
- Content (VStack, HStack): Use \`opacity+translateY\`, enable \`stagger\`
- Focus elements (Center, Modal): Use \`opacity+scale\` with \`out-back\`
- Decorative (Divider): Use \`opacity+scale\`, \`fast\`
- Omit \`entrance\` to use component's default animation

`)

    // Components section
    lines.push("# Available Components\n")

    for (const [name, entry] of _schemas) {
      lines.push(`### ${name}`)
      if (entry.description) {
        lines.push(entry.description)
      }
      if (entry.hasChildren) {
        lines.push("*Can contain children*")
      }
      if (entry.defaultEntrance) {
        lines.push(`*Default entrance: ${entry.defaultEntrance.property}, ${entry.defaultEntrance.easing}, ${entry.defaultEntrance.duration}${entry.defaultEntrance.stagger ? ', stagger' : ''}*`)
      }

      // Generate JSON Schema for AI
      try {
        const jsonSchema = JSONSchema.make(entry.schema)
        lines.push("```json")
        lines.push(JSON.stringify(jsonSchema, null, 2))
        lines.push("```")
      } catch {
        // Schema may not be JSON-serializable, skip
        lines.push("*(Complex schema - see TypeScript definition)*")
      }
      lines.push("")
    }

    return lines.join("\n")
  }

  // ─────────────────────────────────────────────────────────────
  // Tier/Domain-aware prompt generation
  // ─────────────────────────────────────────────────────────────

  const TIER_ORDER: Record<CatalogTier, number> = { core: 0, domain: 1, discovery: 2 }

  const filterSchemas = (options?: {
    tier?: CatalogTier
    domains?: ReadonlyArray<CatalogDomain>
  }): Map<string, SchemaEntry> => {
    const maxTier = TIER_ORDER[options?.tier ?? 'domain']
    const domainFilter = options?.domains

    const result = new Map<string, SchemaEntry>()
    for (const [name, entry] of _schemas) {
      const entryTier = TIER_ORDER[entry.tier ?? 'core']
      if (entryTier > maxTier) continue
      if (domainFilter && domainFilter.length > 0) {
        const entryDomains = entry.domains ?? ['ui']
        if (!domainFilter.some((d) => entryDomains.includes(d))) continue
      }
      result.set(name, entry)
    }
    return result
  }

  const generateScopedPrompt = (options?: {
    tier?: CatalogTier
    domains?: ReadonlyArray<CatalogDomain>
  }): string => {
    const requestedTier = options?.tier ?? 'domain'
    const requestedDomains = options?.domains
    const filtered = filterSchemas(options)

    const lines: string[] = []

    lines.push('# Scoped Component Brief')
    lines.push('')
    lines.push(`Scope tier: ${requestedTier}`)
    lines.push(`Scope domains: ${requestedDomains && requestedDomains.length > 0 ? requestedDomains.join(', ') : 'all'}`)
    lines.push(`Component count: ${filtered.size}`)
    lines.push('')

    lines.push('## Guardrails')
    lines.push('- Use ONLY component types listed below for this scope.')
    lines.push('- Every element MUST have unique `key`, valid `type`, and optional `props` object.')
    lines.push('- Use `children` only for components where `hasChildren: true`.')
    lines.push('- Include all required props shown in each component contract.')
    lines.push('- `className` is optional and available for layout/styling overrides.')
    lines.push('')

    lines.push('# Available Components')
    lines.push('')

    for (const [name, entry] of filtered) {
      const tierBadge = entry.tier === 'core' ? '' : ` [${entry.tier}]`
      const domainBadge = entry.domains?.length ? ` (${entry.domains.join(', ')})` : ''
      lines.push(`## ${name}${tierBadge}${domainBadge}`)

      if (entry.description) {
        lines.push(entry.description)
      }

      let jsonSchema: Record<string, unknown> | null = null
      try {
        jsonSchema = JSONSchema.make(entry.schema) as Record<string, unknown>
      } catch {
        jsonSchema = null
      }

      const required = Array.isArray(jsonSchema?.required)
        ? (jsonSchema?.required as ReadonlyArray<string>)
        : []
      const propKeys = jsonSchema?.properties && typeof jsonSchema.properties === 'object'
        ? Object.keys(jsonSchema.properties as Record<string, unknown>)
        : []

      lines.push('### Usage Contract')
      lines.push(`- hasChildren: ${entry.hasChildren ?? false}`)
      lines.push(`- requiredProps: ${required.length > 0 ? required.join(', ') : 'none'}`)
      lines.push(`- availableProps: ${propKeys.length > 0 ? propKeys.join(', ') : 'unknown (complex schema)'}`)

      if (entry.compound) {
        lines.push(`- compound parent: ${entry.compound.parent}`)
        lines.push(`- allowed slots: ${entry.compound.slots.join(', ')}`)
        if (entry.compound.strict) {
          lines.push('- slot mode: strict')
        }
      }

      lines.push('')
      lines.push('### Props Schema')
      if (jsonSchema) {
        lines.push('```json')
        lines.push(JSON.stringify(jsonSchema, null, 2))
        lines.push('```')
      } else {
        lines.push('*(Complex schema - see TypeScript definition)*')
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  const listDomains = (): ReadonlyArray<string> => {
    return _domainNames
  }

  const getCompound = (type: string): CompoundRelation | undefined => {
    const entry = _schemas.get(type)
    return entry?.compound
  }

  const listComponents = (options?: {
    tier?: CatalogTier
    domains?: ReadonlyArray<CatalogDomain>
  }): ReadonlyArray<string> => {
    const filtered = filterSchemas(options)
    return Array.from(filtered.keys())
  }

  return {
    // Getters: always return latest COW snapshot
    get renderers() { return _renderers },
    get schemas() { return _schemas },
    register,
    generatePrompt,
    generateScopedPrompt,
    listDomains,
    getCompound,
    listComponents,
  }
}

// =============================================================================
// Layer Factory
// =============================================================================

/**
 * Create a Layer that provides CatalogComponents with initial catalogs
 *
 * @param catalogs - Domain catalogs to register at creation time
 *
 * @example
 * ```typescript
 * import { createCatalogLayer } from '@/lib/genifer/core/CatalogService'
 * import { layoutDomainCatalog } from '@/lib/layout'
 *
 * const CatalogLive = createCatalogLayer(layoutDomainCatalog, uiDomainCatalog)
 * ```
 */
export const createCatalogLayer = (
  ...catalogs: DomainCatalog[]
): Layer.Layer<CatalogComponents> =>
  Layer.succeed(CatalogComponents, makeCatalogComponents(catalogs))

// =============================================================================
// Effect.fn Accessors (traced, modern pattern)
// =============================================================================

/**
 * Get all renderers as a Record (for React consumption)
 *
 * Traced via Effect.withSpan — shows up as 'genifer.catalog.getRenderers' in spans.
 */
export const getRenderersRecord = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  yield* Effect.annotateCurrentSpan("componentCount", catalog.renderers.size)
  return Object.fromEntries(catalog.renderers) as Record<
    string,
    ComponentDef["renderer"]
  >
}).pipe(Effect.withSpan("genifer.catalog.getRenderers"))

/**
 * Get all schemas as a Record (for validation)
 *
 * Traced via Effect.withSpan.
 */
export const getSchemasRecord = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  yield* Effect.annotateCurrentSpan("schemaCount", catalog.schemas.size)
  return Object.fromEntries(catalog.schemas) as Record<string, SchemaEntry>
}).pipe(Effect.withSpan("genifer.catalog.getSchemas"))

/**
 * Generate the AI system prompt
 *
 * Traced via Effect.withSpan — logs prompt byte length.
 */
export const getSystemPrompt = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  const prompt = catalog.generatePrompt()
  yield* Effect.annotateCurrentSpan("promptBytes", prompt.length)
  return prompt
}).pipe(Effect.withSpan("genifer.catalog.getSystemPrompt"))

/**
 * Get the register function (for runtime plugin registration)
 */
export const getRegister = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  return catalog.register
})

// Chart-specific prompt generation has been moved to @/lib/charts.
// Use the charts module directly for scoped chart prompts.
