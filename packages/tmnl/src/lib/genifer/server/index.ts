/**
 * @fileoverview Genifer Server Module
 *
 * Server-side utilities for genifer catalog access, prompt generation,
 * and dynamic catalog injection.
 *
 * @module genifer/server
 */

// =============================================================================
// Server Registry (singleton for server-side atom access)
// =============================================================================

export {
  serverRegistry,
  getSystemPrompt,
  getSchemas,
  getRenderers,
  registerPluginCatalog,
} from "./registry"

// =============================================================================
// Dynamic Catalog Utilities
// =============================================================================

export {
  type ComponentDoc,
  buildCatalogPrompt,
} from "./catalogs"
