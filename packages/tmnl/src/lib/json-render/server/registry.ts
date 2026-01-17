/**
 * @fileoverview Server-Side Registry for json-render Catalog
 *
 * Provides synchronous access to the CatalogComponents service for server code.
 * Uses a singleton Registry pattern - reused across requests.
 *
 * Usage:
 * - Import getSystemPrompt() in cursor-server.ts for AI prompts
 * - Import getSchemas() for server-side validation
 * - Import registerPluginCatalog() for runtime registration
 *
 * @module json-render/server/registry
 */

import { Registry } from "@effect-atom/atom"
import * as Result from "@effect-atom/atom/Result"
import {
  promptAtom,
  schemasAtom,
  renderersAtom,
  registerCatalogAtom,
  type DomainCatalog,
  type SchemaEntry,
  type ComponentDef,
} from "../react/atoms/catalog"

// =============================================================================
// Singleton Server Registry
// =============================================================================

/**
 * Module-level registry for server-side atom access.
 * Reused across requests (singleton pattern).
 *
 * Note: We create a separate registry for server-side to ensure isolation
 * from any React-side registries that might be created.
 */
export const serverRegistry = Registry.make()

// =============================================================================
// Server-Side Accessors
// =============================================================================

/**
 * Get AI system prompt from catalog.
 * Call this in server handlers to get component documentation for AI.
 *
 * @returns Generated system prompt string
 *
 * @example
 * ```ts
 * import { getSystemPrompt } from '@/lib/json-render/server/registry'
 *
 * const systemPrompt = `You are a UI generator.
 *
 * ${getSystemPrompt()}
 *
 * ## Response Format
 * Return JSON with root and elements...`
 * ```
 */
export const getSystemPrompt = (): string => {
  const result = serverRegistry.get(promptAtom)
  if (Result.isSuccess(result)) {
    return result.value
  }
  return "# No components registered"
}

/**
 * Get schemas for server-side validation.
 *
 * @returns Record of component name -> SchemaEntry
 */
export const getSchemas = (): Record<string, SchemaEntry> => {
  const result = serverRegistry.get(schemasAtom)
  if (Result.isSuccess(result)) {
    return result.value
  }
  return {}
}

/**
 * Get renderers record (useful for SSR scenarios).
 *
 * @returns Record of component name -> Renderer
 */
export const getRenderers = (): Record<string, ComponentDef["renderer"]> => {
  const result = serverRegistry.get(renderersAtom)
  if (Result.isSuccess(result)) {
    return result.value
  }
  return {}
}

/**
 * Register a plugin catalog at runtime.
 * Use this for agent-generated components or hot-reloaded plugins.
 *
 * @param catalog - Domain catalog to register
 *
 * @example
 * ```ts
 * import { registerPluginCatalog } from '@/lib/json-render/server/registry'
 *
 * const agentCatalog: DomainCatalog = {
 *   name: "AgentPlugins",
 *   components: {
 *     DynamicChart: {
 *       schema: Schema.Struct({ data: Schema.Array(Schema.Number) }),
 *       renderer: ({ element }) => <Chart data={element.props.data} />,
 *       description: "Agent-generated chart component",
 *     },
 *   },
 * }
 *
 * registerPluginCatalog(agentCatalog)
 * ```
 */
export const registerPluginCatalog = (catalog: DomainCatalog): void => {
  const result = serverRegistry.get(registerCatalogAtom)
  if (Result.isSuccess(result)) {
    result.value(catalog)
  }
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { type DomainCatalog, type SchemaEntry }
