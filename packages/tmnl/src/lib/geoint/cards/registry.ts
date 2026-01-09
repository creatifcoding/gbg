/**
 * GEOINT Card Registry
 *
 * Hybrid schema-driven + runtime extensible registry for entity-centric card views.
 * Bridges BFO-grounded entities with GEOINT SearchResult types via trait composition.
 *
 * Architecture:
 * - Schema-driven: Traits define data shape, validation, and serialization
 * - Runtime extensible: Effect.Service/Layer pattern for renderer/action injection
 * - Polymorphic: Same entity renders differently in popover/floating/panel contexts
 *
 * @module geoint/cards/registry
 */

import { Context, Effect, Layer, HashMap, Option, pipe } from 'effect'
import { Schema } from 'effect'
import type { TraitName, AnyTrait, ComposedEntity } from './traits'
import type { SearchResultItem, IntelSource } from '../schemas'

// =============================================================================
// BRANDED IDENTIFIERS
// =============================================================================

/** Card definition identifier */
export const CardId = Schema.String.pipe(Schema.brand('CardId'))
export type CardId = typeof CardId.Type

/** Renderer slot identifier */
export const SlotId = Schema.Literal(
  'header',
  'title',
  'subtitle',
  'badge',
  'preview',
  'content',
  'footer',
  'actions',
  'minimap',
  'timeline',
  'metadata'
)
export type SlotId = typeof SlotId.Type

/** Render context determines polymorphic output */
export const RenderContext = Schema.Literal('popover', 'floating', 'panel', 'inline', 'list-item')
export type RenderContext = typeof RenderContext.Type

// =============================================================================
// CARD SLOT SYSTEM
// =============================================================================

/**
 * Slot contribution from a trait renderer.
 * Traits contribute to slots; final card merges all contributions.
 */
export interface SlotContribution {
  readonly slot: SlotId
  readonly priority: number // Higher priority wins in conflicts
  readonly content: React.ReactNode
}

/**
 * Merged slots for a card instance.
 */
export type CardSlots = Partial<Record<SlotId, React.ReactNode>>

// =============================================================================
// TRAIT RENDERER INTERFACE
// =============================================================================

/**
 * Context passed to trait renderers.
 */
export interface TraitRenderContext<T extends AnyTrait = AnyTrait> {
  readonly trait: T
  readonly entityId: string
  readonly renderContext: RenderContext
  readonly isSelected: boolean
  readonly isHovered: boolean
}

/**
 * Trait renderer definition.
 * Each trait can contribute UI to multiple slots.
 */
export interface TraitRenderer<T extends AnyTrait = AnyTrait> {
  readonly traitName: T['_trait']
  readonly render: (ctx: TraitRenderContext<T>) => readonly SlotContribution[]
}

// =============================================================================
// ACTION SYSTEM
// =============================================================================

/** Action identifier */
export const ActionId = Schema.String.pipe(Schema.brand('ActionId'))
export type ActionId = typeof ActionId.Type

/**
 * Action definition for entity operations.
 */
export interface ActionDefinition {
  readonly id: ActionId
  readonly label: string
  readonly description?: string
  readonly icon?: string
  readonly hotkey?: string
  readonly group: 'primary' | 'secondary' | 'danger' | 'navigation'
  /** Traits required for this action to be available */
  readonly requiredTraits: readonly TraitName[]
  /** Execute the action */
  readonly execute: (entity: ComposedEntity) => Effect.Effect<void, Error>
  /** Check if action is enabled for entity */
  readonly isEnabled?: (entity: ComposedEntity) => boolean
  /** Check if action is visible for entity */
  readonly isVisible?: (entity: ComposedEntity) => boolean
}

// =============================================================================
// CARD DEFINITION
// =============================================================================

/**
 * Full card definition combining renderers, actions, and metadata.
 */
export interface CardDefinition {
  readonly id: CardId
  readonly label: string
  readonly description?: string
  /** Traits this card handles */
  readonly traits: readonly TraitName[]
  /** Source-specific styling */
  readonly source?: IntelSource
  /** Custom class for this card type */
  readonly className?: string
  /** Renderers for each supported render context */
  readonly renderers: Partial<Record<RenderContext, readonly TraitRenderer[]>>
  /** Actions available on this card */
  readonly actions: readonly ActionDefinition[]
  /** Validation schema for entity data */
  readonly validationSchema?: Schema.Schema.AnyNoContext
  /** Lifecycle hooks */
  readonly lifecycle?: CardLifecycle
}

/**
 * Card lifecycle hooks for side effects.
 */
export interface CardLifecycle {
  readonly onMount?: (entity: ComposedEntity) => Effect.Effect<void>
  readonly onUnmount?: (entity: ComposedEntity) => Effect.Effect<void>
  readonly onSelect?: (entity: ComposedEntity) => Effect.Effect<void>
  readonly onHover?: (entity: ComposedEntity) => Effect.Effect<void>
}

// =============================================================================
// CARD REGISTRY SERVICE
// =============================================================================

/**
 * Card registry service interface.
 */
export interface CardRegistryService {
  /**
   * Register a card definition.
   */
  readonly register: (card: CardDefinition) => Effect.Effect<void>

  /**
   * Get card definition for entity based on traits.
   */
  readonly getCardForEntity: (entity: ComposedEntity) => Effect.Effect<CardDefinition | null>

  /**
   * Get card definition by ID.
   */
  readonly getCard: (id: CardId) => Effect.Effect<CardDefinition | null>

  /**
   * Get all registered cards.
   */
  readonly getAllCards: () => Effect.Effect<readonly CardDefinition[]>

  /**
   * Get actions available for entity.
   */
  readonly getActionsForEntity: (entity: ComposedEntity) => Effect.Effect<readonly ActionDefinition[]>

  /**
   * Render entity in given context.
   */
  readonly renderEntity: (
    entity: ComposedEntity,
    context: RenderContext,
    state: { isSelected: boolean; isHovered: boolean }
  ) => Effect.Effect<CardSlots>
}

/**
 * Card registry service tag.
 */
export class CardRegistry extends Context.Tag('CardRegistry')<
  CardRegistry,
  CardRegistryService
>() {}

// =============================================================================
// DEFAULT IMPLEMENTATION
// =============================================================================

/**
 * Create card registry service implementation.
 */
export const makeCardRegistryService = Effect.gen(function* () {
  // Internal state - cards indexed by ID
  let cardsById = HashMap.empty<CardId, CardDefinition>()
  // Trait to card mapping for fast lookup
  let traitToCards = HashMap.empty<TraitName, readonly CardId[]>()

  const register: CardRegistryService['register'] = (card) =>
    Effect.sync(() => {
      cardsById = HashMap.set(cardsById, card.id, card)

      // Update trait mapping
      for (const trait of card.traits) {
        const existing = pipe(
          HashMap.get(traitToCards, trait),
          Option.getOrElse(() => [] as readonly CardId[])
        )
        traitToCards = HashMap.set(traitToCards, trait, [...existing, card.id])
      }
    })

  const getCard: CardRegistryService['getCard'] = (id) =>
    Effect.sync(() => pipe(HashMap.get(cardsById, id), Option.getOrNull))

  const getAllCards: CardRegistryService['getAllCards'] = () =>
    Effect.sync(() => {
      const cards: CardDefinition[] = []
      HashMap.forEach(cardsById, (card) => cards.push(card))
      return cards
    })

  const getCardForEntity: CardRegistryService['getCardForEntity'] = (entity) =>
    Effect.sync(() => {
      // Find card with most matching traits (best fit)
      const entityTraits = Array.from(entity.traits.keys())
      let bestCard: CardDefinition | null = null
      let bestScore = 0

      HashMap.forEach(cardsById, (card) => {
        // Count matching traits
        const matchCount = card.traits.filter((t) => entityTraits.includes(t)).length
        // Score includes match count and specificity (more required traits = more specific)
        const score = matchCount * 10 + card.traits.length
        if (matchCount > 0 && score > bestScore) {
          bestScore = score
          bestCard = card
        }
      })

      return bestCard
    })

  const getActionsForEntity: CardRegistryService['getActionsForEntity'] = (entity) =>
    Effect.gen(function* () {
      const card = yield* getCardForEntity(entity)
      if (!card) return []

      return card.actions.filter((action) => {
        // Check required traits
        const hasTraits = action.requiredTraits.every((t) => entity.traits.has(t))
        // Check visibility
        const isVisible = action.isVisible ? action.isVisible(entity) : true
        return hasTraits && isVisible
      })
    })

  const renderEntity: CardRegistryService['renderEntity'] = (entity, context, state) =>
    Effect.gen(function* () {
      const card = yield* getCardForEntity(entity)
      if (!card) return {}

      const renderers = card.renderers[context] ?? []
      const contributions: SlotContribution[] = []

      // Collect contributions from all renderers
      for (const renderer of renderers) {
        const trait = entity.traits.get(renderer.traitName)
        if (!trait) continue

        const ctx: TraitRenderContext = {
          trait,
          entityId: entity.entityId,
          renderContext: context,
          isSelected: state.isSelected,
          isHovered: state.isHovered,
        }

        contributions.push(...renderer.render(ctx))
      }

      // Merge contributions by slot, highest priority wins
      const slots: CardSlots = {}
      const slotPriorities = new Map<SlotId, number>()

      for (const contrib of contributions) {
        const currentPriority = slotPriorities.get(contrib.slot) ?? -Infinity
        if (contrib.priority > currentPriority) {
          slots[contrib.slot] = contrib.content
          slotPriorities.set(contrib.slot, contrib.priority)
        }
      }

      return slots
    })

  return {
    register,
    getCard,
    getAllCards,
    getCardForEntity,
    getActionsForEntity,
    renderEntity,
  } satisfies CardRegistryService
})

/**
 * Default card registry layer.
 */
export const CardRegistryLive = Layer.effect(CardRegistry, makeCardRegistryService)

// =============================================================================
// SEARCH RESULT TO ENTITY BRIDGE
// =============================================================================

/**
 * Convert SearchResultItem to ComposedEntity with traits.
 */
export const searchResultToEntity = (result: SearchResultItem): ComposedEntity => {
  const traits = new Map<TraitName, AnyTrait>()

  // Common traits from base fields
  traits.set('Sourceable', {
    _trait: 'Sourceable' as const,
    source: result.source,
    sourceId: getSourceId(result),
  })

  // Add position trait if geo data available
  const position = getPosition(result)
  if (position) {
    traits.set('Positionable', {
      _trait: 'Positionable' as const,
      position: position as [number, number],
      altitude: getAltitude(result),
    })
  }

  // Add temporal trait
  const timestamp = getTimestamp(result)
  if (timestamp) {
    traits.set('Temporal', {
      _trait: 'Temporal' as const,
      timestamp,
    })
  }

  // Type-specific traits
  switch (result._tag) {
    case 'SearchResultTrack':
      traits.set('Classifiable', {
        _trait: 'Classifiable' as const,
        classification: result.classification,
      })
      traits.set('Identifiable', {
        _trait: 'Identifiable' as const,
        primaryId: result.trackId,
      })
      if (result.heading !== undefined || result.speed !== undefined) {
        traits.set('Trackable', {
          _trait: 'Trackable' as const,
          heading: result.heading,
          speed: result.speed,
        })
      }
      break

    case 'SearchResultPoi':
      traits.set('Nameable', {
        _trait: 'Nameable' as const,
        name: result.name,
      })
      traits.set('Categorizable', {
        _trait: 'Categorizable' as const,
        category: result.category,
        tags: Object.keys(result.tags),
      })
      break

    case 'SearchResultFlight':
      traits.set('Identifiable', {
        _trait: 'Identifiable' as const,
        primaryId: result.icao24,
        secondaryIds: result.callsign ? { callsign: result.callsign } : undefined,
      })
      traits.set('Trackable', {
        _trait: 'Trackable' as const,
        heading: result.heading,
        speed: result.velocity,
      })
      break

    case 'SearchResultFeature':
      traits.set('Identifiable', {
        _trait: 'Identifiable' as const,
        primaryId: result.featureId,
      })
      traits.set('Categorizable', {
        _trait: 'Categorizable' as const,
        category: result.geometryType,
      })
      break

    case 'SearchResultWeather':
      if (result.locationName) {
        traits.set('Nameable', {
          _trait: 'Nameable' as const,
          name: result.locationName,
        })
      }
      break

    case 'SearchResultImagery':
      traits.set('Imageable', {
        _trait: 'Imageable' as const,
        thumbnailUrl: result.thumbnailUrl,
        fullImageUrl: result.assetsUrl,
        imageMetadata: {
          provider: result.provider,
          collection: result.collection,
          cloudCover: result.cloudCover,
          gsd: result.gsd,
        },
      })
      traits.set('Categorizable', {
        _trait: 'Categorizable' as const,
        category: result.provider,
        subcategory: result.collection,
      })
      break
  }

  return {
    entityId: getEntityId(result),
    traits,
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const getEntityId = (result: SearchResultItem): string => {
  switch (result._tag) {
    case 'SearchResultTrack':
      return `track:${result.trackId}`
    case 'SearchResultPoi':
      return `poi:${result.poiId}`
    case 'SearchResultFlight':
      return `flight:${result.icao24}`
    case 'SearchResultFeature':
      return `feature:${result.featureId}`
    case 'SearchResultWeather':
      return `weather:${result.position[0]},${result.position[1]}`
    case 'SearchResultImagery':
      return `imagery:${result.provider}:${result.itemId}`
    default:
      return `unknown:${Date.now()}`
  }
}

const getSourceId = (result: SearchResultItem): string | undefined => {
  switch (result._tag) {
    case 'SearchResultTrack':
      return result.trackId
    case 'SearchResultPoi':
      return result.poiId
    case 'SearchResultFlight':
      return result.icao24
    case 'SearchResultFeature':
      return result.featureId
    case 'SearchResultWeather':
      return undefined
    case 'SearchResultImagery':
      return result.itemId
    default:
      return undefined
  }
}

const getPosition = (result: SearchResultItem): readonly [number, number] | undefined => {
  switch (result._tag) {
    case 'SearchResultTrack':
      // Position3D is [lon, lat, alt], extract [lon, lat]
      return [result.position[0], result.position[1]] as const
    case 'SearchResultPoi':
      return result.position
    case 'SearchResultFlight':
      // Position3D is [lon, lat, alt], extract [lon, lat]
      return [result.position[0], result.position[1]] as const
    case 'SearchResultFeature':
      return result.position
    case 'SearchResultWeather':
      return result.position
    case 'SearchResultImagery':
      return result.position
    default:
      return undefined
  }
}

const getAltitude = (result: SearchResultItem): number | undefined => {
  switch (result._tag) {
    case 'SearchResultTrack':
      // Position3D[2] is altitude
      return result.position[2]
    case 'SearchResultFlight':
      // Position3D[2] is altitude
      return result.position[2]
    default:
      return undefined
  }
}

const getTimestamp = (result: SearchResultItem): number | undefined => {
  switch (result._tag) {
    case 'SearchResultTrack':
      return result.retrievedAt.getTime()
    case 'SearchResultFlight':
      return result.lastContact.getTime()
    case 'SearchResultWeather':
      return result.forecastTime.getTime()
    case 'SearchResultImagery':
      return result.acquired.getTime()
    default:
      return undefined
  }
}
