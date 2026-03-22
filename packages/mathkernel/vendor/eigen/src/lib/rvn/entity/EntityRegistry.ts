/**
 * EntityRegistry
 *
 * Tag-based component registry for schema-driven rendering.
 * Maps Effect Schema _tag values to React components.
 *
 * Design principles:
 * - Single global registry (singleton pattern)
 * - Type-safe registration and retrieval
 * - Immutable external access via ReadonlyMap
 *
 * @example
 * ```typescript
 * import { EntityRegistry } from '@/lib/rvn'
 * import { RvnEquipmentCard } from '@/lib/rvn'
 *
 * // Register a renderer for Equipment entities
 * EntityRegistry.register('Equipment', RvnEquipmentCard)
 *
 * // Retrieve renderer
 * const Renderer = EntityRegistry.get('Equipment')
 * if (Renderer) {
 *   return <Renderer entity={equipment} />
 * }
 * ```
 */

import type * as React from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/**
 * Base type for tagged entities (Effect Schema pattern)
 * All entities must have a readonly _tag discriminator
 */
export type TaggedEntity = {
  readonly _tag: string
  [key: string]: unknown
}

/**
 * Component type for rendering a tagged entity
 */
export type EntityRenderer<T extends TaggedEntity = TaggedEntity> = React.ComponentType<{
  entity: T
}>

/**
 * Registration options for entity renderers
 */
export interface EntityRegistrationOptions {
  /** Override existing registration (default: false) */
  override?: boolean
}

// -----------------------------------------------------------------------------
// Registry Implementation
// -----------------------------------------------------------------------------

class EntityRegistryImpl {
  private readonly renderers = new Map<string, EntityRenderer<any>>()

  /**
   * Register a component renderer for a specific _tag value
   *
   * @param tag - The _tag value from Effect Schema (e.g., 'Equipment', 'User')
   * @param renderer - React component that accepts { entity: T }
   * @param options - Registration options
   * @throws If tag already registered and override not set
   *
   * @example
   * ```typescript
   * EntityRegistry.register('Equipment', RvnEquipmentCard)
   * EntityRegistry.register('User', UserCard, { override: true })
   * ```
   */
  register<T extends TaggedEntity>(
    tag: string,
    renderer: EntityRenderer<T>,
    options: EntityRegistrationOptions = {}
  ): void {
    if (this.renderers.has(tag) && !options.override) {
      throw new Error(
        `EntityRegistry: Renderer for tag "${tag}" already registered. ` +
          `Use { override: true } to replace.`
      )
    }
    this.renderers.set(tag, renderer)
  }

  /**
   * Retrieve a renderer for a specific _tag value
   *
   * @param tag - The _tag value to look up
   * @returns The registered renderer, or undefined if not found
   *
   * @example
   * ```typescript
   * const Renderer = EntityRegistry.get('Equipment')
   * if (Renderer) {
   *   return <Renderer entity={equipment} />
   * }
   * ```
   */
  get<T extends TaggedEntity>(tag: string): EntityRenderer<T> | undefined {
    return this.renderers.get(tag)
  }

  /**
   * Check if a renderer is registered for a tag
   *
   * @param tag - The _tag value to check
   * @returns true if a renderer is registered
   */
  has(tag: string): boolean {
    return this.renderers.has(tag)
  }

  /**
   * Unregister a renderer for a tag
   *
   * @param tag - The _tag value to unregister
   * @returns true if a renderer was removed
   */
  unregister(tag: string): boolean {
    return this.renderers.delete(tag)
  }

  /**
   * Get all registered renderers
   *
   * @returns ReadonlyMap of tag -> renderer
   */
  getAll(): ReadonlyMap<string, EntityRenderer<any>> {
    return this.renderers
  }

  /**
   * Get all registered tags
   *
   * @returns Array of registered tag names
   */
  getTags(): readonly string[] {
    return Array.from(this.renderers.keys())
  }

  /**
   * Clear all registrations (useful for testing)
   */
  clear(): void {
    this.renderers.clear()
  }
}

// -----------------------------------------------------------------------------
// Singleton Export
// -----------------------------------------------------------------------------

/**
 * Global entity registry singleton
 *
 * Use this to register renderers at application startup,
 * then retrieve them via RvnRenderer.Auto
 */
export const EntityRegistry = new EntityRegistryImpl()
