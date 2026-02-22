/**
 * @fileoverview Catalog Atoms for genifer
 *
 * Uses Atom.runtime pattern to provide CatalogComponents service to atoms.
 * Enables both React (via useAtomValue) and server-side (via Registry.make()) access.
 *
 * Architecture:
 * - catalogRuntime: Atom.runtime with CatalogComponentsLive layer
 * - renderersAtom: For React component lookup
 * - promptAtom: For AI system prompt generation
 * - schemasAtom: For validation
 * - registerCatalogAtom: For runtime plugin registration
 *
 * @module genifer/react/atoms/catalog
 */

import { Atom, Registry } from "@effect-atom/atom"
import * as Result from "@effect-atom/atom/Result"
import {
  CatalogComponents,
  createCatalogLayer,
  getRenderersRecord,
  getSchemasRecord,
  getSystemPrompt,
  getRegister,
  type DomainCatalog,
  type ComponentDef,
  type SchemaEntry,
} from "../../core/CatalogService"

// Internal genifer catalogs (owned by genifer — no external imports)
import { uiDomainCatalog } from "@/lib/genifer/catalog/ui-domain-catalog"
import { coreDomainCatalog } from "@/lib/genifer/catalog/core-domain-catalog"
import { buttonDomainCatalog } from "@/lib/genifer/catalog/button-domain-catalog"
import { geointDomainCatalog } from "@/lib/genifer/catalog/geoint-domain-catalog"
import { rvnDomainCatalog } from "@/lib/genifer/catalog/rvn-domain-catalog"

// =============================================================================
// Plugin Registration (external domains register themselves)
// =============================================================================

/**
 * Register a domain catalog for inclusion in the genifer catalog system.
 *
 * External domain modules call this at module initialization time.
 * Catalogs are accumulated and consumed when CatalogComponentsLive
 * is first created (lazy initialization via getter).
 *
 * @example
 * ```ts
 * // In @/lib/layout/catalog/domain-catalog.tsx
 * import { registerDomainCatalog } from '@/lib/genifer/react'
 * registerDomainCatalog(layoutDomainCatalog)
 * ```
 */
const _pendingCatalogs: DomainCatalog[] = []
export const registerDomainCatalog = (catalog: DomainCatalog): void => {
  _pendingCatalogs.push(catalog)
}

// =============================================================================
// Build-time Layer (genifer-internal + plugin-registered domains)
// =============================================================================

/**
 * Default CatalogComponents layer with all registered domains.
 *
 * Uses a lazy getter to ensure external `registerDomainCatalog()` calls
 * have completed before the layer is materialized. The getter is called
 * by `catalogRuntime` on first atom access.
 *
 * Internal catalogs: ui, geoint, rvn (owned by genifer)
 * External catalogs: layout, charts, morph-card (registered via plugin API)
 */
let _cachedLayer: ReturnType<typeof createCatalogLayer> | null = null

export const CatalogComponentsLive = (() => {
  // Proxy object that lazily creates the real layer
  return new Proxy({} as ReturnType<typeof createCatalogLayer>, {
    get(_target, prop, receiver) {
      if (!_cachedLayer) {
        _cachedLayer = createCatalogLayer(
          uiDomainCatalog,
          coreDomainCatalog,
          buttonDomainCatalog,
          geointDomainCatalog,
          rvnDomainCatalog,
          ..._pendingCatalogs,
        )
      }
      return Reflect.get(_cachedLayer, prop, receiver)
    },
  })
})()

// =============================================================================
// Atom.runtime (provides CatalogComponents to atoms)
// =============================================================================

/**
 * Runtime atom with CatalogComponents service layer.
 * Use this to create atoms that need access to the catalog.
 */
export const catalogRuntime = Atom.runtime(CatalogComponentsLive)

// =============================================================================
// Consumer Atoms
// =============================================================================

/**
 * Renderers for React components.
 * Returns Result<Record<string, Renderer>, Error>
 *
 * @example
 * ```tsx
 * const result = useAtomValue(renderersAtom)
 * const renderers = Result.getOrElse(result, () => ({}))
 * ```
 */
export const renderersAtom = catalogRuntime.atom(getRenderersRecord)

/**
 * AI system prompt generated from all registered components.
 * Returns Result<string, Error>
 *
 * @example
 * ```ts
 * const result = serverRegistry.get(promptAtom)
 * const prompt = Result.getOrElse(result, () => "# No components")
 * ```
 */
export const promptAtom = catalogRuntime.atom(getSystemPrompt)

/**
 * Schemas for validation.
 * Returns Result<Record<string, SchemaEntry>, Error>
 */
export const schemasAtom = catalogRuntime.atom(getSchemasRecord)

/**
 * Runtime registration function for plugin catalogs.
 * Returns Result<(catalog: DomainCatalog) => void, Error>
 *
 * @example
 * ```ts
 * const result = serverRegistry.get(registerCatalogAtom)
 * const register = Result.getOrThrow(result)
 * register(myPluginCatalog)
 * ```
 */
export const registerCatalogAtom = catalogRuntime.atom(getRegister)

// =============================================================================
// Module-level Registry (for server-side and non-React contexts)
// =============================================================================

/**
 * Module-level registry for synchronous catalog access.
 * Use in server code, tests, or anywhere outside React components.
 *
 * @example
 * ```ts
 * import { catalogRegistry, promptAtom } from '@/lib/genifer/react/atoms/catalog'
 * import { Result } from 'effect'
 *
 * const result = catalogRegistry.get(promptAtom)
 * const prompt = Result.getOrElse(result, () => "fallback")
 * ```
 */
export const catalogRegistry = Registry.make()

// =============================================================================
// Convenience Accessors (server-side)
// =============================================================================

/**
 * Get AI system prompt synchronously (server-side).
 * Falls back to empty prompt if service unavailable.
 */
export const getCatalogSystemPrompt = (): string => {
  const result = catalogRegistry.get(promptAtom)
  // Result pattern: getOrElse with fallback
  return Result.isSuccess(result)
    ? result.value
    : "# No components registered"
}

/**
 * Get renderers record synchronously (server-side).
 */
export const getCatalogRenderers = (): Record<string, ComponentDef["renderer"]> => {
  const result = catalogRegistry.get(renderersAtom)
  return Result.isSuccess(result) ? result.value : {}
}

/**
 * Get schemas record synchronously (server-side).
 */
export const getCatalogSchemas = (): Record<string, SchemaEntry> => {
  const result = catalogRegistry.get(schemasAtom)
  return Result.isSuccess(result) ? result.value : {}
}

/**
 * Register a plugin catalog at runtime (server-side).
 * Call this to add new components from plugins or agents.
 */
export const registerPluginCatalog = (catalog: DomainCatalog): void => {
  const result = catalogRegistry.get(registerCatalogAtom)
  if (Result.isSuccess(result)) {
    result.value(catalog)
  }
}

// =============================================================================
// Re-exports
// =============================================================================

export {
  CatalogComponents,
  createCatalogLayer,
  type DomainCatalog,
  type ComponentDef,
  type SchemaEntry,
}
