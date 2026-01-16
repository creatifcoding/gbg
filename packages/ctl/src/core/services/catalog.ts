/**
 * Catalog Service
 *
 * Provides a queryable catalog of CTL components, commands, and capabilities.
 * Used for discovery, documentation, and agent steering.
 *
 * @module @gbg/ctl/core/services/catalog
 */

import { Context, Effect, Layer, Schema } from "effect"

// =============================================================================
// CATALOG SCHEMAS
// =============================================================================

/**
 * Component type in the catalog
 */
export const ComponentType = Schema.Literal(
  "command",
  "adapter",
  "service",
  "primitive",
  "template",
  "skill"
)
export type ComponentType = typeof ComponentType.Type

/**
 * Catalog entry for a component
 */
export class CatalogEntry extends Schema.Class<CatalogEntry>("CatalogEntry")({
  /** Unique identifier */
  id: Schema.String,
  /** Display name */
  name: Schema.String,
  /** Component type */
  type: ComponentType,
  /** Description */
  description: Schema.String,
  /** Category for grouping */
  category: Schema.String,
  /** Tags for filtering */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Related entries */
  related: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Example usage */
  example: Schema.optional(Schema.String),
  /** File path (if applicable) */
  path: Schema.optional(Schema.String),
  /** Whether this is a core component */
  core: Schema.optionalWith(Schema.Boolean, { default: () => true }),
}) {}

/**
 * Catalog query parameters
 */
export interface CatalogQuery {
  /** Filter by type */
  type?: ComponentType
  /** Filter by category */
  category?: string
  /** Search in name/description */
  search?: string
  /** Filter by tags */
  tags?: readonly string[]
  /** Maximum results */
  limit?: number
}

/**
 * Catalog query result
 */
export interface CatalogResult {
  entries: readonly CatalogEntry[]
  total: number
  query: CatalogQuery
}

// =============================================================================
// CATALOG PORT
// =============================================================================

export interface CatalogPort {
  /**
   * Get all catalog entries
   */
  readonly getAll: () => readonly CatalogEntry[]

  /**
   * Query the catalog
   */
  readonly query: (params: CatalogQuery) => CatalogResult

  /**
   * Get entry by ID
   */
  readonly getById: (id: string) => CatalogEntry | undefined

  /**
   * Get entries by type
   */
  readonly getByType: (type: ComponentType) => readonly CatalogEntry[]

  /**
   * Get entries by category
   */
  readonly getByCategory: (category: string) => readonly CatalogEntry[]

  /**
   * Get related entries
   */
  readonly getRelated: (id: string) => readonly CatalogEntry[]

  /**
   * Get all categories
   */
  readonly getCategories: () => readonly string[]

  /**
   * Get all tags
   */
  readonly getTags: () => readonly string[]

  /**
   * Register a new entry
   */
  readonly register: (entry: CatalogEntry) => void
}

export class Catalog extends Context.Tag("ctl/Catalog")<
  Catalog,
  CatalogPort
>() {}

// =============================================================================
// DEFAULT CATALOG ENTRIES
// =============================================================================

const defaultEntries: CatalogEntry[] = [
  // Commands
  new CatalogEntry({
    id: "cmd-new",
    name: "new",
    type: "command",
    description: "Create a new CTL CLI project",
    category: "scaffolding",
    tags: ["create", "init", "project"],
    example: "ctl new my-cli",
  }),
  new CatalogEntry({
    id: "cmd-add",
    name: "add",
    type: "command",
    description: "Add a component to existing CLI",
    category: "scaffolding",
    tags: ["generate", "component"],
    example: "ctl add command greet",
    related: ["cmd-new"],
  }),
  new CatalogEntry({
    id: "cmd-health",
    name: "health",
    type: "command",
    description: "Check CLI health and configuration",
    category: "diagnostics",
    tags: ["check", "status", "diagnostic"],
    example: "ctl health --agent",
    related: ["cmd-discover"],
  }),
  new CatalogEntry({
    id: "cmd-discover",
    name: "discover",
    type: "command",
    description: "Discover project configuration and skills",
    category: "diagnostics",
    tags: ["find", "project", "skills"],
    example: "ctl discover --agent",
    related: ["cmd-health", "cmd-inspect"],
  }),
  new CatalogEntry({
    id: "cmd-inspect",
    name: "inspect",
    type: "command",
    description: "Inspect CLI structure and dependencies",
    category: "diagnostics",
    tags: ["info", "structure", "deps"],
    example: "ctl inspect .",
  }),
  new CatalogEntry({
    id: "cmd-help",
    name: "help",
    type: "command",
    description: "Search commands and get suggestions",
    category: "help",
    tags: ["search", "find", "suggest"],
    example: "ctl help create project",
  }),
  new CatalogEntry({
    id: "cmd-tui",
    name: "tui",
    type: "command",
    description: "Launch full terminal UI mode",
    category: "interface",
    tags: ["ui", "interactive", "dashboard"],
    example: "ctl tui --page=catalog",
  }),

  // Adapters
  new CatalogEntry({
    id: "adapter-console",
    name: "ConsoleOutputAdapter",
    type: "adapter",
    description: "Simple console output for human-readable CLI output",
    category: "output",
    tags: ["console", "text", "inline"],
    path: "src/adapters/output/console.ts",
  }),
  new CatalogEntry({
    id: "adapter-agent",
    name: "AgentOutputAdapter",
    type: "adapter",
    description: "Structured JSON output for agent steering framework",
    category: "output",
    tags: ["json", "agent", "structured"],
    path: "src/adapters/output/agent.ts",
    related: ["adapter-console"],
  }),
  new CatalogEntry({
    id: "adapter-ink",
    name: "InkOutputAdapter",
    type: "adapter",
    description: "Rich terminal UI output using Ink (React for CLI)",
    category: "output",
    tags: ["ink", "react", "rich"],
    path: "src/adapters/output/ink.tsx",
    related: ["adapter-tui"],
  }),
  new CatalogEntry({
    id: "adapter-tui",
    name: "TuiOutputAdapter",
    type: "adapter",
    description: "Full-screen terminal UI with navigation",
    category: "output",
    tags: ["tui", "fullscreen", "navigation"],
    path: "src/adapters/output/tui.tsx",
    related: ["adapter-ink"],
  }),

  // Services
  new CatalogEntry({
    id: "svc-command-router",
    name: "CommandRouter",
    type: "service",
    description: "Routes queries to matching commands with confidence scoring",
    category: "core",
    tags: ["routing", "commands", "search"],
    path: "src/core/services/command-router.ts",
  }),
  new CatalogEntry({
    id: "svc-project-discovery",
    name: "ProjectDiscovery",
    type: "service",
    description: "Discovers project configuration from CTL.md and package.json",
    category: "core",
    tags: ["discovery", "config", "project"],
    path: "src/core/services/project-discovery.ts",
  }),
  new CatalogEntry({
    id: "svc-agent-execution",
    name: "AgentExecution",
    type: "service",
    description: "Parses and executes agent actions from structured output",
    category: "core",
    tags: ["agent", "execution", "actions"],
    path: "src/core/services/agent-execution.ts",
  }),
  new CatalogEntry({
    id: "svc-catalog",
    name: "Catalog",
    type: "service",
    description: "Queryable catalog of CTL components",
    category: "core",
    tags: ["catalog", "discovery", "components"],
    path: "src/core/services/catalog.ts",
  }),

  // Primitives
  new CatalogEntry({
    id: "prim-alert",
    name: "Alert",
    type: "primitive",
    description: "Alert component for messages with different severities",
    category: "feedback",
    tags: ["alert", "message", "notification"],
    path: "src/render/primitives/index.tsx",
  }),
  new CatalogEntry({
    id: "prim-badge",
    name: "Badge",
    type: "primitive",
    description: "Badge component for tags and labels",
    category: "feedback",
    tags: ["badge", "tag", "label"],
    path: "src/render/primitives/index.tsx",
  }),
  new CatalogEntry({
    id: "prim-status",
    name: "Status",
    type: "primitive",
    description: "Status indicator with icon and message",
    category: "feedback",
    tags: ["status", "indicator", "icon"],
    path: "src/render/primitives/index.tsx",
  }),
  new CatalogEntry({
    id: "prim-progress",
    name: "ProgressBar",
    type: "primitive",
    description: "Visual progress bar with percentage",
    category: "feedback",
    tags: ["progress", "bar", "loading"],
    path: "src/render/primitives/index.tsx",
  }),
  new CatalogEntry({
    id: "prim-card",
    name: "Card",
    type: "primitive",
    description: "Bordered container with optional title",
    category: "layout",
    tags: ["card", "container", "border"],
    path: "src/render/primitives/index.tsx",
  }),
  new CatalogEntry({
    id: "prim-section",
    name: "Section",
    type: "primitive",
    description: "Titled content section",
    category: "layout",
    tags: ["section", "title", "content"],
    path: "src/render/primitives/index.tsx",
  }),

  // Templates
  new CatalogEntry({
    id: "tpl-command",
    name: "Command Template",
    type: "template",
    description: "Template for adding new CLI commands",
    category: "scaffolding",
    tags: ["template", "command", "generate"],
    related: ["cmd-add"],
  }),
  new CatalogEntry({
    id: "tpl-skill",
    name: "Skill Template",
    type: "template",
    description: "Template for adding new skills",
    category: "scaffolding",
    tags: ["template", "skill", "generate"],
    related: ["cmd-add"],
  }),
  new CatalogEntry({
    id: "tpl-migration",
    name: "Migration Template",
    type: "template",
    description: "Template for database migrations",
    category: "scaffolding",
    tags: ["template", "migration", "database"],
    related: ["cmd-add"],
  }),
]

// =============================================================================
// IMPLEMENTATION
// =============================================================================

const makeCatalog = (): CatalogPort => {
  const entries = new Map<string, CatalogEntry>()

  // Register default entries
  for (const entry of defaultEntries) {
    entries.set(entry.id, entry)
  }

  const matchesSearch = (entry: CatalogEntry, search: string): boolean => {
    const lower = search.toLowerCase()
    return (
      entry.name.toLowerCase().includes(lower) ||
      entry.description.toLowerCase().includes(lower) ||
      entry.tags.some((t) => t.toLowerCase().includes(lower))
    )
  }

  return {
    getAll: () => Array.from(entries.values()),

    query: (params: CatalogQuery) => {
      let results = Array.from(entries.values())

      if (params.type) {
        results = results.filter((e) => e.type === params.type)
      }

      if (params.category) {
        results = results.filter((e) => e.category === params.category)
      }

      if (params.search) {
        results = results.filter((e) => matchesSearch(e, params.search!))
      }

      if (params.tags && params.tags.length > 0) {
        results = results.filter((e) =>
          params.tags!.some((t) => e.tags.includes(t))
        )
      }

      const total = results.length

      if (params.limit && params.limit > 0) {
        results = results.slice(0, params.limit)
      }

      return { entries: results, total, query: params }
    },

    getById: (id: string) => entries.get(id),

    getByType: (type: ComponentType) =>
      Array.from(entries.values()).filter((e) => e.type === type),

    getByCategory: (category: string) =>
      Array.from(entries.values()).filter((e) => e.category === category),

    getRelated: (id: string) => {
      const entry = entries.get(id)
      if (!entry) return []
      return entry.related
        .map((rid) => entries.get(rid))
        .filter((e): e is CatalogEntry => e !== undefined)
    },

    getCategories: () => {
      const categories = new Set<string>()
      for (const entry of entries.values()) {
        categories.add(entry.category)
      }
      return Array.from(categories).sort()
    },

    getTags: () => {
      const tags = new Set<string>()
      for (const entry of entries.values()) {
        for (const tag of entry.tags) {
          tags.add(tag)
        }
      }
      return Array.from(tags).sort()
    },

    register: (entry: CatalogEntry) => {
      entries.set(entry.id, entry)
    },
  }
}

// =============================================================================
// LAYER
// =============================================================================

export const CatalogLayer = Layer.succeed(Catalog, makeCatalog())

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Quick query the catalog
 */
export const queryCatalog = (params: CatalogQuery) =>
  Effect.sync(() => makeCatalog().query(params))

/**
 * Get catalog entry by ID
 */
export const getCatalogEntry = (id: string) =>
  Effect.sync(() => makeCatalog().getById(id))

/**
 * Get all entries of a type
 */
export const getCatalogByType = (type: ComponentType) =>
  Effect.sync(() => makeCatalog().getByType(type))
