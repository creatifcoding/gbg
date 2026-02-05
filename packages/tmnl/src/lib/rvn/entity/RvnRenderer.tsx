/**
 * RvnRenderer
 *
 * Schema-driven auto-renderer for tagged entities.
 * Looks up component by entity._tag and renders it automatically.
 *
 * Design principles:
 * - Compound component pattern (RvnRenderer.Auto, RvnRenderer.register)
 * - Zero-config rendering based on Effect Schema _tag
 * - Graceful fallback for unregistered entities
 * - Type-safe entity passing
 *
 * @example
 * ```tsx
 * import { RvnRenderer } from '@/lib/rvn'
 *
 * // Register renderers at app startup
 * RvnRenderer.register('Equipment', RvnEquipmentCard)
 * RvnRenderer.register('User', UserCard)
 *
 * // Auto-render entities by their _tag
 * function EntityList({ entities }) {
 *   return entities.map(e => (
 *     <RvnRenderer.Auto key={e.id} entity={e} />
 *   ))
 * }
 * ```
 */

import * as React from 'react'
import {
  EntityRegistry,
  type TaggedEntity,
  type EntityRenderer,
  type EntityRegistrationOptions,
} from './EntityRegistry'
import { RVN_COLORS, RVN_FONTS, RVN_FONT_SIZES, RVN_BORDERS } from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnRendererAutoProps {
  /** The tagged entity to render */
  entity: TaggedEntity
  /** Fallback content when no renderer is registered */
  fallback?: React.ReactNode
  /** Additional class name for the wrapper (only used for fallback) */
  className?: string
  /** Additional inline styles (only used for fallback) */
  style?: React.CSSProperties
}

export interface RvnRendererDebugProps {
  /** The tagged entity to display debug info for */
  entity: TaggedEntity
  /** Show all entity properties (default: false, shows only _tag) */
  expanded?: boolean
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const fallbackStyles = {
  container: {
    border: RVN_BORDERS.card,
    padding: '8px 12px',
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    color: RVN_COLORS.textMuted,
    background: RVN_COLORS.surfaceHighlight,
  },
  tag: {
    color: RVN_COLORS.textMain,
    fontWeight: 600,
  },
} as const

const debugStyles = {
  container: {
    border: `2px dashed ${RVN_COLORS.border}`,
    padding: '8px',
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.label,
    background: RVN_COLORS.surface,
  },
  header: {
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
  },
  label: {
    color: RVN_COLORS.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  tag: {
    color: RVN_COLORS.textMain,
    fontWeight: 700,
  },
  properties: {
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: `1px solid ${RVN_COLORS.border}`,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    color: RVN_COLORS.textMuted,
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/**
 * Default fallback component shown when no renderer is registered
 */
function DefaultFallback({ entity }: { entity: TaggedEntity }) {
  return (
    <div style={fallbackStyles.container} data-rvn-renderer-fallback="">
      No renderer for <span style={fallbackStyles.tag}>"{entity._tag}"</span>
    </div>
  )
}

/**
 * Auto-renderer that selects component based on entity._tag
 *
 * Looks up the registered renderer for the entity's _tag value
 * and renders it. If no renderer is found, shows fallback.
 *
 * @example
 * ```tsx
 * // With registered renderer
 * <RvnRenderer.Auto entity={{ _tag: 'Equipment', model: 'MK-IV' }} />
 *
 * // With custom fallback
 * <RvnRenderer.Auto
 *   entity={unknownEntity}
 *   fallback={<div>Unknown entity type</div>}
 * />
 * ```
 */
function Auto({
  entity,
  fallback,
  className,
  style,
}: RvnRendererAutoProps): React.ReactElement {
  const Renderer = EntityRegistry.get(entity._tag)

  if (Renderer) {
    return <Renderer entity={entity} />
  }

  // Use custom fallback or default
  if (fallback !== undefined) {
    return <>{fallback}</>
  }

  return (
    <div className={className} style={style}>
      <DefaultFallback entity={entity} />
    </div>
  )
}

Auto.displayName = 'RvnRenderer.Auto'

/**
 * Debug renderer that shows entity metadata
 *
 * Useful during development to inspect entity structure
 *
 * @example
 * ```tsx
 * <RvnRenderer.Debug entity={entity} expanded />
 * ```
 */
function Debug({ entity, expanded = false }: RvnRendererDebugProps): React.ReactElement {
  const isRegistered = EntityRegistry.has(entity._tag)

  return (
    <div style={debugStyles.container} data-rvn-renderer-debug="">
      <div style={debugStyles.header}>
        <span style={debugStyles.label}>Entity:</span>
        <span style={debugStyles.tag}>{entity._tag}</span>
        <span style={debugStyles.label}>
          [{isRegistered ? 'REGISTERED' : 'UNREGISTERED'}]
        </span>
      </div>
      {expanded && (
        <div style={debugStyles.properties}>
          {JSON.stringify(entity, null, 2)}
        </div>
      )}
    </div>
  )
}

Debug.displayName = 'RvnRenderer.Debug'

/**
 * Convenience method to register a renderer
 *
 * Delegates to EntityRegistry.register
 *
 * @example
 * ```typescript
 * RvnRenderer.register('Equipment', RvnEquipmentCard)
 * RvnRenderer.register('User', UserCard, { override: true })
 * ```
 */
function register<T extends TaggedEntity>(
  tag: string,
  renderer: EntityRenderer<T>,
  options?: EntityRegistrationOptions
): void {
  EntityRegistry.register(tag, renderer, options)
}

/**
 * Convenience method to check if a renderer is registered
 *
 * @example
 * ```typescript
 * if (RvnRenderer.has('Equipment')) {
 *   // Safe to render
 * }
 * ```
 */
function has(tag: string): boolean {
  return EntityRegistry.has(tag)
}

/**
 * Get the renderer for a specific tag
 *
 * @example
 * ```typescript
 * const Renderer = RvnRenderer.get('Equipment')
 * ```
 */
function get<T extends TaggedEntity>(tag: string): EntityRenderer<T> | undefined {
  return EntityRegistry.get(tag)
}

// -----------------------------------------------------------------------------
// Compound Component Export
// -----------------------------------------------------------------------------

/**
 * RvnRenderer - Schema-driven auto-rendering system
 *
 * Compound component with the following parts:
 * - RvnRenderer.Auto - Auto-select and render based on _tag
 * - RvnRenderer.Debug - Show entity debug info
 * - RvnRenderer.register - Register a renderer for a tag
 * - RvnRenderer.has - Check if a renderer is registered
 * - RvnRenderer.get - Get a specific renderer
 * - RvnRenderer.registry - Direct access to EntityRegistry
 *
 * @example
 * ```tsx
 * // Setup
 * RvnRenderer.register('Equipment', RvnEquipmentCard)
 * RvnRenderer.register('User', UserCard)
 *
 * // Usage
 * function EntityList({ entities }) {
 *   return (
 *     <div>
 *       {entities.map(e => (
 *         <RvnRenderer.Auto
 *           key={e.id}
 *           entity={e}
 *           fallback={<RvnRenderer.Debug entity={e} expanded />}
 *         />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export const RvnRenderer = {
  /** Auto-select and render component based on entity._tag */
  Auto,
  /** Debug view showing entity metadata */
  Debug,
  /** Register a renderer for a tag */
  register,
  /** Check if a renderer is registered */
  has,
  /** Get a specific renderer */
  get,
  /** Direct access to the EntityRegistry singleton */
  registry: EntityRegistry,
} as const

// Type exports for consumers
export type { TaggedEntity, EntityRenderer, EntityRegistrationOptions }
