/**
 * GEOINT Panel-Scoped Operations Factory
 *
 * Compatibility wrapper retained for search-domain operations.
 *
 * Map/view/layer/selection operations are now owned by `MapController`.
 * Search/panel-search operations remain here until full search migration.
 *
 * @module geoint/atoms/operations
 */

import type { PanelId } from './families'
import {
  createSearchOperations,
  type SearchOperations,
} from './searchOperations'

// =============================================================================
// OPERATIONS FACTORY (SEARCH-ONLY COMPAT)
// =============================================================================

/**
 * Create panel-scoped operations (search-only compatibility surface).
 *
 * @deprecated Prefer direct `createSearchOperations(panelId)` for search and
 * `MapController` for map/view/layer/selection behavior.
 */
export function createGeointOperations(panelId: PanelId): SearchOperations {
  return createSearchOperations(panelId)
}

/**
 * Compatibility type alias.
 *
 * Historically represented merged map+search+layer+selection+view operations.
 * Now narrowed to SearchOperations as MapController owns the rest.
 */
export type GeointOperations = SearchOperations

// =============================================================================
// RE-EXPORTS
// =============================================================================

export type { SearchOperations } from './searchOperations'
export { createSearchOperations }
