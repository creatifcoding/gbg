/**
 * @fileoverview Unified Catalog Service for genifer
 *
 * Provides a generic registration point for component catalogs. Domains (layout, ui, forms)
 * self-register their components. The service is domain-agnostic - it just merges catalogs.
 *
 * Key insight: "The merge doesn't need to know what's being merged - just be the codepoint for it."
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
}

/**
 * Domain catalog - a named collection of components
 */
export interface DomainCatalog {
  /** Domain name (e.g., "layout", "ui", "forms") */
  readonly name: string
  /** Component definitions keyed by type name */
  readonly components: Record<string, ComponentDef>
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
}

// =============================================================================
// CatalogComponents Interface (generic merge point)
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
}

/**
 * Context.Tag for the CatalogComponents service
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
 * Uses mutable Maps internally to support runtime registration,
 * but exposes an immutable interface via ReadonlyMap.
 *
 * @param initialCatalogs - Optional catalogs to register at creation time
 */
export const makeCatalogComponents = (
  initialCatalogs: DomainCatalog[] = []
): CatalogComponents => {
  // Internal mutable state (supports runtime registration)
  const renderers = new Map<string, ComponentDef["renderer"]>()
  const schemas = new Map<string, SchemaEntry>()

  /**
   * Register a domain catalog
   */
  const register = (catalog: DomainCatalog): void => {
    for (const [name, def] of Object.entries(catalog.components)) {
      renderers.set(name, def.renderer)
      schemas.set(name, {
        schema: def.schema,
        description: def.description,
        hasChildren: def.hasChildren,
        defaultEntrance: def.defaultEntrance,
      })
    }
  }

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
**Any component can be a child of any container.** Layout components (Grid, VStack, HStack, Flex, etc.) are containers that can hold ANY other component, including:
- Other layout components (nested layouts)
- Domain-specific components (GeointDashboard, forms, etc.)
- UI primitives (Text, Heading, Button, etc.)

## Container vs Leaf Components
- **Containers** (hasChildren: true): Can wrap other components. Use \`children\` array.
- **Leaf components** (hasChildren: false): Self-contained. Cannot have children but CAN be placed inside containers.

## Common Patterns

### Dashboard in Layout
\`\`\`json
{
  "root": "layout",
  "elements": {
    "layout": {
      "type": "VStack",
      "props": { "gap": 16 },
      "children": ["header", "dashboard"]
    },
    "header": { "type": "Heading", "props": { "level": 1, "text": "Operations" } },
    "dashboard": { "type": "GeointDashboard", "props": { "panelId": "main" } }
  }
}
\`\`\`

### Side-by-Side Dashboards
\`\`\`json
{
  "root": "layout",
  "elements": {
    "layout": {
      "type": "Grid",
      "props": { "template": "1fr 1fr", "gap": 16 },
      "children": ["left", "right"]
    },
    "left": { "type": "GeointDashboard", "props": { "panelId": "geoint-1" } },
    "right": { "type": "GeointDashboard", "props": { "panelId": "geoint-2" } }
  }
}
\`\`\`

## Rules
1. Every element needs a unique key in the \`elements\` object
2. Reference children by their key strings in the \`children\` array
3. Leaf components (hasChildren: false) should NOT have a \`children\` array
4. The \`root\` must reference a key that exists in \`elements\`

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

    for (const [name, entry] of schemas) {
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

  return {
    renderers,
    schemas,
    register,
    generatePrompt,
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
 * import { layoutDomainCatalog } from '@/lib/layout/catalog/domain-catalog'
 *
 * const CatalogLive = createCatalogLayer(layoutDomainCatalog, uiDomainCatalog)
 * ```
 */
export const createCatalogLayer = (
  ...catalogs: DomainCatalog[]
): Layer.Layer<CatalogComponents> =>
  Layer.succeed(CatalogComponents, makeCatalogComponents(catalogs))

// =============================================================================
// Effect Accessors
// =============================================================================

/**
 * Get all renderers as a Record (for React consumption)
 */
export const getRenderersRecord = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  return Object.fromEntries(catalog.renderers) as Record<
    string,
    ComponentDef["renderer"]
  >
})

/**
 * Get all schemas as a Record (for validation)
 */
export const getSchemasRecord = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  return Object.fromEntries(catalog.schemas) as Record<string, SchemaEntry>
})

/**
 * Generate the AI system prompt
 */
export const getSystemPrompt = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  return catalog.generatePrompt()
})

/**
 * Get the register function (for runtime plugin registration)
 */
export const getRegister = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  return catalog.register
})

// =============================================================================
// Chart-Specific Prompt Generation
// =============================================================================

import { allCharts } from '@/lib/charts/composable/categories'

/**
 * Generate a scoped prompt containing only specific chart types.
 *
 * Use this for downstream agents that need knowledge of only
 * the charts selected by the discriminator.
 *
 * @param chartTypes - Array of chart type names to include
 */
export const generateScopedChartPrompt = (chartTypes: string[]): string => {
  const subset = allCharts.pick(...chartTypes)

  if (subset.isEmpty()) {
    return '# No Charts Available\n\nNo valid chart types were specified.'
  }

  return `# Chart Configuration Guide

You are configuring one of these chart types:

${subset.generateMiniSchema()}

## Configuration Rules

1. All required fields MUST be provided
2. Field names must match the data structure exactly
3. Series field enables grouping/comparison
4. Color field enables categorical coloring

## Example Configuration

\`\`\`json
{
  "chartType": "Line",
  "xField": "date",
  "yField": "value",
  "seriesField": "category",
  "smooth": true
}
\`\`\`
`
}

/**
 * Generate a prompt for a specific chart category.
 *
 * @param category - Chart category name
 */
export const generateCategoryChartPrompt = (category: string): string => {
  const subset = allCharts.byCategory(category as any)

  if (subset.isEmpty()) {
    return `# No Charts Available\n\nNo charts found for category: ${category}`
  }

  return `# ${formatCategoryName(category)} Charts

${subset.generateMiniSchema()}
`
}

/**
 * Generate a combined prompt with components AND chart knowledge.
 *
 * Use this when an agent needs both component and chart knowledge.
 */
export const generateCombinedPrompt = Effect.gen(function* () {
  const catalog = yield* CatalogComponents
  const componentPrompt = catalog.generatePrompt()

  // Add chart knowledge section
  const chartPrompt = allCharts.generateMiniSchema()

  return `${componentPrompt}

# Chart Types

The following chart types are available for data visualization:

${chartPrompt}
`
})

function formatCategoryName(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
