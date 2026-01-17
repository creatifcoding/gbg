/**
 * @fileoverview Unified Catalog Service for json-render
 *
 * Provides a generic registration point for component catalogs. Domains (layout, ui, forms)
 * self-register their components. The service is domain-agnostic - it just merges catalogs.
 *
 * Key insight: "The merge doesn't need to know what's being merged - just be the codepoint for it."
 *
 * @module json-render/core/CatalogService
 */

import { Context, Layer, Effect, JSONSchema } from "effect"
import * as Schema from "effect/Schema"
import type { ReactNode } from "react"
import type { UIElement, Action } from "./schemas"

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
 */
export interface SchemaEntry {
  readonly schema: Schema.Schema<any, any, never>
  readonly description?: string
  readonly hasChildren?: boolean
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
  "json-render/CatalogComponents"
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
      })
    }
  }

  // Initialize with provided catalogs
  initialCatalogs.forEach(register)

  /**
   * Generate AI system prompt from all registered components
   */
  const generatePrompt = (): string => {
    const lines: string[] = ["# Available Components\n"]

    for (const [name, entry] of schemas) {
      lines.push(`### ${name}`)
      if (entry.description) {
        lines.push(entry.description)
      }
      if (entry.hasChildren) {
        lines.push("*Can contain children*")
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
 * import { createCatalogLayer } from '@/lib/json-render/core/CatalogService'
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
