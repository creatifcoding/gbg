/**
 * GEOINT Card Renderers
 *
 * Trait-specific renderers that contribute UI to card slots.
 * Each renderer maps a trait to React components for different contexts.
 *
 * @module geoint/cards/renderers
 */

import type { FC, ReactNode } from 'react'
import type {
  TraitRenderer,
  TraitRenderContext,
  SlotContribution,
  RenderContext,
} from './registry'
import type {
  PositionableTrait,
  TemporalTrait,
  ClassifiableTrait,
  IdentifiableTrait,
  NameableTrait,
  TrackableTrait,
  CategorizableTrait,
  SourceableTrait,
  ImageableTrait,
  AnyTrait,
} from './traits'
import { SOURCE_COLORS } from '../tokens'

// =============================================================================
// SLOT COMPONENT PRIMITIVES
// =============================================================================

/**
 * Badge component for small labeled values.
 */
export interface BadgeProps {
  readonly label: string
  readonly value?: string
  readonly variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  readonly className?: string
}

export const Badge: FC<BadgeProps> = ({ label, value, variant = 'default', className }) => {
  const variantClasses = {
    default: 'bg-surface-2 text-foreground-secondary',
    success: 'bg-green-500/20 text-green-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    danger: 'bg-red-500/20 text-red-400',
    info: 'bg-blue-500/20 text-blue-400',
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono
        ${variantClasses[variant]}
        ${className ?? ''}
      `}
    >
      <span className="text-foreground-tertiary">{label}</span>
      {value && <span>{value}</span>}
    </span>
  )
}

/**
 * Key-value display for metadata.
 */
export interface MetadataRowProps {
  readonly label: string
  readonly value: ReactNode
  readonly unit?: string
}

export const MetadataRow: FC<MetadataRowProps> = ({ label, value, unit }) => (
  <div className="flex justify-between items-center text-xs">
    <span className="text-foreground-tertiary">{label}</span>
    <span className="text-foreground-secondary font-mono">
      {value}
      {unit && <span className="text-foreground-tertiary ml-1">{unit}</span>}
    </span>
  </div>
)

/**
 * Mini-map placeholder (actual map integration separate).
 */
export const MiniMapPlaceholder: FC<{ position: readonly [number, number] }> = ({
  position,
}) => (
  <div className="w-full h-24 bg-surface-2 rounded flex items-center justify-center text-xs text-foreground-tertiary">
    <span className="font-mono">
      {position[1].toFixed(4)}, {position[0].toFixed(4)}
    </span>
  </div>
)

// =============================================================================
// TRAIT RENDERERS
// =============================================================================

/**
 * Positionable trait renderer.
 * Contributes: minimap preview, coordinates badge.
 */
export const positionableRenderer: TraitRenderer<PositionableTrait> = {
  traitName: 'Positionable',
  render: (ctx): readonly SlotContribution[] => {
    const { trait, renderContext } = ctx
    const contributions: SlotContribution[] = []

    // Mini-map for panel/floating contexts
    if (renderContext === 'panel' || renderContext === 'floating') {
      contributions.push({
        slot: 'minimap',
        priority: 100,
        content: <MiniMapPlaceholder position={trait.position} />,
      })
    }

    // Coordinates badge
    contributions.push({
      slot: 'metadata',
      priority: 50,
      content: (
        <MetadataRow
          label="Position"
          value={`${trait.position[1].toFixed(4)}, ${trait.position[0].toFixed(4)}`}
        />
      ),
    })

    // Altitude if available
    if (trait.altitude !== undefined) {
      contributions.push({
        slot: 'metadata',
        priority: 49,
        content: <MetadataRow label="Altitude" value={trait.altitude.toFixed(0)} unit="m" />,
      })
    }

    return contributions
  },
}

/**
 * Temporal trait renderer.
 * Contributes: timestamp display, time badge.
 */
export const temporalRenderer: TraitRenderer<TemporalTrait> = {
  traitName: 'Temporal',
  render: (ctx): readonly SlotContribution[] => {
    const { trait } = ctx
    const date = new Date(trait.timestamp)
    const timeAgo = getTimeAgo(trait.timestamp)

    return [
      {
        slot: 'badge',
        priority: 30,
        content: <Badge label="Time" value={timeAgo} />,
      },
      {
        slot: 'metadata',
        priority: 40,
        content: <MetadataRow label="Timestamp" value={date.toLocaleString()} />,
      },
    ]
  },
}

/**
 * Classifiable trait renderer.
 * Contributes: classification badge with NATO color.
 */
export const classifiableRenderer: TraitRenderer<ClassifiableTrait> = {
  traitName: 'Classifiable',
  render: (ctx): readonly SlotContribution[] => {
    const { trait } = ctx

    const variantMap = {
      friendly: 'success' as const,
      hostile: 'danger' as const,
      neutral: 'warning' as const,
      unknown: 'default' as const,
    }

    return [
      {
        slot: 'badge',
        priority: 100, // High priority - classification is critical
        content: (
          <Badge
            label="Class"
            value={trait.classification.toUpperCase()}
            variant={variantMap[trait.classification]}
          />
        ),
      },
    ]
  },
}

/**
 * Identifiable trait renderer.
 * Contributes: ID display in header/subtitle.
 */
export const identifiableRenderer: TraitRenderer<IdentifiableTrait> = {
  traitName: 'Identifiable',
  render: (ctx): readonly SlotContribution[] => {
    const { trait, renderContext } = ctx
    const contributions: SlotContribution[] = []

    // Primary ID as subtitle for compact views
    if (renderContext === 'list-item' || renderContext === 'inline') {
      contributions.push({
        slot: 'subtitle',
        priority: 50,
        content: <span className="font-mono text-xs opacity-70">{trait.primaryId}</span>,
      })
    }

    // Full ID metadata for expanded views
    if (renderContext === 'panel' || renderContext === 'floating') {
      contributions.push({
        slot: 'metadata',
        priority: 90,
        content: <MetadataRow label="ID" value={trait.primaryId} />,
      })

      // Secondary IDs
      if (trait.secondaryIds) {
        for (const [key, value] of Object.entries(trait.secondaryIds)) {
          contributions.push({
            slot: 'metadata',
            priority: 85,
            content: <MetadataRow label={key} value={value} />,
          })
        }
      }
    }

    return contributions
  },
}

/**
 * Nameable trait renderer.
 * Contributes: title display.
 */
export const nameableRenderer: TraitRenderer<NameableTrait> = {
  traitName: 'Nameable',
  render: (ctx): readonly SlotContribution[] => {
    const { trait } = ctx
    const displayName = trait.displayName ?? trait.name

    return [
      {
        slot: 'title',
        priority: 100, // Name always takes title slot
        content: <span className="font-medium truncate">{displayName}</span>,
      },
    ]
  },
}

/**
 * Trackable trait renderer.
 * Contributes: heading/speed display, motion indicators.
 */
export const trackableRenderer: TraitRenderer<TrackableTrait> = {
  traitName: 'Trackable',
  render: (ctx): readonly SlotContribution[] => {
    const { trait } = ctx
    const contributions: SlotContribution[] = []

    if (trait.heading !== undefined) {
      contributions.push({
        slot: 'metadata',
        priority: 60,
        content: <MetadataRow label="Heading" value={trait.heading.toFixed(0)} unit="°" />,
      })
    }

    if (trait.speed !== undefined) {
      contributions.push({
        slot: 'metadata',
        priority: 61,
        content: <MetadataRow label="Speed" value={trait.speed.toFixed(1)} unit="m/s" />,
      })
    }

    if (trait.course !== undefined) {
      contributions.push({
        slot: 'metadata',
        priority: 62,
        content: <MetadataRow label="Course" value={trait.course.toFixed(0)} unit="°" />,
      })
    }

    return contributions
  },
}

/**
 * Categorizable trait renderer.
 * Contributes: category badge, tags.
 */
export const categorizableRenderer: TraitRenderer<CategorizableTrait> = {
  traitName: 'Categorizable',
  render: (ctx): readonly SlotContribution[] => {
    const { trait, renderContext } = ctx
    const contributions: SlotContribution[] = []

    // Category badge
    contributions.push({
      slot: 'badge',
      priority: 50,
      content: <Badge label="Category" value={trait.category} />,
    })

    // Tags for expanded views
    if (trait.tags && trait.tags.length > 0 && renderContext !== 'inline') {
      contributions.push({
        slot: 'footer',
        priority: 30,
        content: (
          <div className="flex flex-wrap gap-1">
            {trait.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 bg-surface-2 rounded text-xs text-foreground-tertiary"
              >
                {tag}
              </span>
            ))}
            {trait.tags.length > 5 && (
              <span className="text-xs text-foreground-tertiary">
                +{trait.tags.length - 5} more
              </span>
            )}
          </div>
        ),
      })
    }

    return contributions
  },
}

/**
 * Sourceable trait renderer.
 * Contributes: source badge with color coding.
 */
export const sourceableRenderer: TraitRenderer<SourceableTrait> = {
  traitName: 'Sourceable',
  render: (ctx): readonly SlotContribution[] => {
    const { trait } = ctx
    const colors = SOURCE_COLORS[trait.source]

    return [
      {
        slot: 'header',
        priority: 100,
        content: (
          <div
            className={`
              w-2 h-2 rounded-full
              ${colors.tailwind.bg.replace('/20', '')}
            `}
            style={{ backgroundColor: colors.primary }}
            title={trait.source}
          />
        ),
      },
    ]
  },
}

/**
 * Imageable trait renderer.
 * Contributes: thumbnail preview, image metadata.
 */
export const imageableRenderer: TraitRenderer<ImageableTrait> = {
  traitName: 'Imageable',
  render: (ctx): readonly SlotContribution[] => {
    const { trait, renderContext } = ctx
    const contributions: SlotContribution[] = []

    // Thumbnail for list/panel views
    if (trait.thumbnailUrl && renderContext !== 'inline') {
      contributions.push({
        slot: 'preview',
        priority: 100,
        content: (
          <div className="w-full aspect-video bg-surface-2 rounded overflow-hidden">
            <img
              src={trait.thumbnailUrl}
              alt="Preview"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        ),
      })
    }

    // Image metadata
    if (trait.imageMetadata && renderContext === 'panel') {
      for (const [key, value] of Object.entries(trait.imageMetadata)) {
        if (value !== undefined) {
          contributions.push({
            slot: 'metadata',
            priority: 30,
            content: <MetadataRow label={key} value={String(value)} />,
          })
        }
      }
    }

    return contributions
  },
}

// =============================================================================
// RENDERER REGISTRY
// =============================================================================

// Type-erased renderer for registry storage
type AnyTraitRenderer = {
  readonly traitName: string
  readonly render: (ctx: TraitRenderContext<AnyTrait>) => readonly SlotContribution[]
}

/**
 * All default renderers indexed by trait name.
 */
export const defaultRenderers: Record<string, AnyTraitRenderer> = {
  Positionable: positionableRenderer as unknown as AnyTraitRenderer,
  Temporal: temporalRenderer as unknown as AnyTraitRenderer,
  Classifiable: classifiableRenderer as unknown as AnyTraitRenderer,
  Identifiable: identifiableRenderer as unknown as AnyTraitRenderer,
  Nameable: nameableRenderer as unknown as AnyTraitRenderer,
  Trackable: trackableRenderer as unknown as AnyTraitRenderer,
  Categorizable: categorizableRenderer as unknown as AnyTraitRenderer,
  Sourceable: sourceableRenderer as unknown as AnyTraitRenderer,
  Imageable: imageableRenderer as unknown as AnyTraitRenderer,
}

/**
 * Get renderers for a specific context.
 */
export const getRenderersForContext = (
  _context: RenderContext,
  traits: readonly string[]
): readonly AnyTraitRenderer[] => {
  return traits
    .map((t) => defaultRenderers[t])
    .filter((r): r is AnyTraitRenderer => r !== undefined)
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get human-readable time ago string.
 */
const getTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return `${Math.floor(diff / 86400_000)}d ago`
}
