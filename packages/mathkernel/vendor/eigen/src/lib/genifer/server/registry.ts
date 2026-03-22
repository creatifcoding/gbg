/**
 * @fileoverview Unified Registry for genifer Catalog
 *
 * Single-source catalog backed by CatalogService (COW maps).
 * Both server code and React atoms read from the same CatalogComponents instance.
 *
 * Before this rewrite, server had `serverRegistry = Registry.make()` and React
 * had `catalogRuntime` — two independent worlds. Catalogs registered server-side
 * were invisible to React and vice versa.
 *
 * Now:
 * - `sharedCatalog` is the single CatalogComponents instance
 * - Server accessors read directly from it (no Registry needed)
 * - React atoms/runtime also read from it (via catalogRegistry in atoms/catalog.ts)
 * - `registerPluginCatalog` writes to the shared instance
 *
 * @module genifer/server/registry
 */

import { Registry } from "@effect-atom/atom"
import * as Result from "@effect-atom/atom/Result"
import {
  promptAtom,
  schemasAtom,
  renderersAtom,
  registerCatalogAtom,
  catalogRegistry,
  type SchemaEntry,
  type ComponentDef,
} from "../react/atoms/catalog"
import type { DomainCatalog } from "../core/CatalogService"

// =============================================================================
// Shared Registry (same instance React uses)
// =============================================================================

/**
 * The server registry is the SAME registry React's catalog atoms use.
 * This ensures catalogs registered server-side are visible to React
 * and vice versa. No more split-brain.
 *
 * Import path: `@/lib/genifer/server` → `serverRegistry`
 */
export const serverRegistry = catalogRegistry

// =============================================================================
// Server-Side Accessors
// =============================================================================

/**
 * Get AI system prompt from catalog.
 * Call this in server handlers to get component documentation for AI.
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
 * Writes to the shared CatalogComponents instance — visible to both
 * server accessors and React atoms.
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
