/**
 * RVN Entity Rendering System
 *
 * Schema-driven auto-rendering based on Effect Schema _tag.
 *
 * Components:
 * - EntityRegistry: Tag-based component registry singleton
 * - RvnRenderer: Compound component for auto-rendering
 *
 * @example
 * ```tsx
 * import { RvnRenderer, EntityRegistry } from '@/lib/rvn'
 *
 * // Register at app startup
 * RvnRenderer.register('Equipment', RvnEquipmentCard)
 * RvnRenderer.register('User', UserCard)
 *
 * // Auto-render entities
 * function EntityList({ entities }) {
 *   return entities.map(e => (
 *     <RvnRenderer.Auto key={e.id} entity={e} />
 *   ))
 * }
 * ```
 */

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------

export { EntityRegistry } from './EntityRegistry'
export type {
  TaggedEntity,
  EntityRenderer,
  EntityRegistrationOptions,
} from './EntityRegistry'

// -----------------------------------------------------------------------------
// Renderer
// -----------------------------------------------------------------------------

export { RvnRenderer } from './RvnRenderer'
export type {
  RvnRendererAutoProps,
  RvnRendererDebugProps,
} from './RvnRenderer'
