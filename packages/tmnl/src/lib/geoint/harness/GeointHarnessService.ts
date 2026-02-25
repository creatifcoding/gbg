/**
 * GeointHarnessService
 *
 * Central GEOINT runtime service for harness tools + code-mode SDK.
 * Owns viewport state and orchestrates entity-stx operations.
 *
 * Design:
 * - Atom-as-State for shared reactive state
 * - Effect service surface for tool/runtime composition
 * - GeointEntity.fromSearchResult as canonical entity factory
 * - Compatibility bridge through mapSearchResultToTraits for trait hydration
 *
 * @module geoint/harness/GeointHarnessService
 */

import { Atom } from '@effect-atom/atom'
import * as AtomRegistry from '@effect-atom/atom/Registry'
import { Context, Effect, Layer, Schema } from 'effect'
import { GeointEntity, getEntityDisplayLabel, type GeointEntity as GeointEntityValue } from '../entities'
import { mapSearchResultToTraits, type GeointEntityType } from '../kori/search-result-mapper'
import type { SearchResultItem } from '../schemas/search'
import {
  spawnEntity,
  getEntityStx,
  despawnEntity,
  clearAllEntities,
  syncEntityAtoms,
  type EntityStx,
} from '../stx/entity-stx'
import {
  selectEntity,
  hoverEntity,
  toggleEntityPin,
  startTracking,
  stopTracking,
  getEntitySummary,
  getAllEntitySummaries,
  getEntitiesByType,
  getEntitiesInBounds,
  selectedEntityIdAtom,
  selectedEntityIdsAtom,
  hoveredEntityIdAtom,
} from '../stx/entity-ops'
import { spawnedEntityIdsAtom, entityCountAtom } from '../stx/entity-stx'
import { DEFAULT_VIEWPORT, type ViewportState } from '../workspace/schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type GeointViewport = typeof ViewportState.Type

export interface GeointBounds {
  readonly west: number
  readonly east: number
  readonly south: number
  readonly north: number
}

export class GeointHarnessServiceError extends Schema.TaggedError<GeointHarnessServiceError>()(
  'GeointHarnessServiceError',
  {
    operation: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

export interface GeointHarnessServiceShape {
  readonly atoms: {
    readonly viewport: typeof geointViewportAtom
    readonly focusedEntityId: typeof geointFocusedEntityIdAtom
    readonly spawnedEntityIds: typeof spawnedEntityIdsAtom
    readonly entityCount: typeof entityCountAtom
    readonly selectedEntityId: typeof selectedEntityIdAtom
    readonly selectedEntityIds: typeof selectedEntityIdsAtom
    readonly hoveredEntityId: typeof hoveredEntityIdAtom
  }

  readonly spawnFromSearchResult: (
    result: SearchResultItem,
  ) => Effect.Effect<EntityStx, GeointHarnessServiceError>

  readonly spawnBatchFromSearchResults: (
    results: ReadonlyArray<SearchResultItem>,
  ) => Effect.Effect<ReadonlyArray<EntityStx>, GeointHarnessServiceError>

  readonly spawnFromEntity: (
    entity: GeointEntityValue,
    options?: {
      readonly entityId?: string
      readonly source?: string
      readonly traits?: Record<string, unknown>
    },
  ) => Effect.Effect<EntityStx, GeointHarnessServiceError>

  readonly despawn: (entityId: string) => Effect.Effect<void>
  readonly clear: () => Effect.Effect<void>

  readonly select: (entityId: string | null) => Effect.Effect<void>
  readonly hover: (entityId: string | null) => Effect.Effect<void>
  readonly togglePin: (entityId: string) => Effect.Effect<void>

  readonly startTracking: (entityId: string) => Effect.Effect<boolean>
  readonly stopTracking: (entityId: string) => Effect.Effect<void>

  readonly getSummary: (
    entityId: string,
  ) => Effect.Effect<ReturnType<typeof getEntitySummary>>
  readonly getAllSummaries: () => Effect.Effect<ReturnType<typeof getAllEntitySummaries>>
  readonly getByType: (type: GeointEntityType) => Effect.Effect<EntityStx[]>
  readonly getInBounds: (bounds: GeointBounds) => Effect.Effect<EntityStx[]>

  readonly getViewport: () => Effect.Effect<GeointViewport>
  readonly setViewport: (
    viewport: Partial<GeointViewport>,
  ) => Effect.Effect<GeointViewport, GeointHarnessServiceError>
  readonly resetViewport: () => Effect.Effect<GeointViewport>
  readonly focusEntity: (
    entityId: string,
    zoom?: number,
  ) => Effect.Effect<GeointViewport, GeointHarnessServiceError>
}

export class GeointHarnessService extends Context.Tag('geoint/harness/GeointHarnessService')<
  GeointHarnessService,
  GeointHarnessServiceShape
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Atom-as-State
// ─────────────────────────────────────────────────────────────────────────────

const defaultViewport: GeointViewport = {
  longitude: DEFAULT_VIEWPORT.longitude,
  latitude: DEFAULT_VIEWPORT.latitude,
  zoom: DEFAULT_VIEWPORT.zoom,
  pitch: DEFAULT_VIEWPORT.pitch ?? 0,
  bearing: DEFAULT_VIEWPORT.bearing ?? 0,
  altitude: DEFAULT_VIEWPORT.altitude,
}

export const geointViewportAtom = Atom.make<GeointViewport>(defaultViewport)
export const geointFocusedEntityIdAtom = Atom.make<string | null>(null)

const geointHarnessRegistry = AtomRegistry.make()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const withSpan = <A, E>(name: string, effect: Effect.Effect<A, E>) =>
  effect.pipe(Effect.withSpan(`GeointHarnessService.${name}`))

const toEntityType = (entity: GeointEntityValue): GeointEntityType =>
  entity.entityType as GeointEntityType

const toCategory = (entity: GeointEntityValue): string => {
  switch (entity._tag) {
    case 'FlightEntity':
      return entity.category ?? 'flight'
    case 'PoiEntity':
      return entity.category
    case 'TrackEntity':
      return entity.classified.objectType
    case 'WeatherEntity':
      return entity.forecastType
    case 'ImageryEntity':
      return entity.provider
    case 'FeatureEntity':
      return entity.geometryType
  }
}

const toPosition = (entity: GeointEntityValue) => ({
  longitude: entity.spatial.position[0],
  latitude: entity.spatial.position[1],
  altitude: entity.spatial.position[2] ?? null,
})

const spawnFromEntityUnsafe = (
  entity: GeointEntityValue,
  options?: {
    readonly entityId?: string
    readonly source?: string
    readonly traits?: Record<string, unknown>
  },
): EntityStx => {
  const entityId = options?.entityId ?? String(entity.id)
  const sourceFromMetadata =
    typeof entity.metadata?.source === 'string' ? entity.metadata.source : undefined

  const stx = spawnEntity({
    entityId,
    entityType: toEntityType(entity),
    displayLabel: getEntityDisplayLabel(entity),
    category: toCategory(entity),
    source: options?.source ?? sourceFromMetadata,
    position: toPosition(entity),
    traits: options?.traits,
  })

  syncEntityAtoms()
  return stx
}

const spawnFromSearchResultUnsafe = (result: SearchResultItem): EntityStx => {
  const entity = GeointEntity.fromSearchResult(result)
  const bundle = mapSearchResultToTraits(result)

  const traits = Object.fromEntries(
    bundle.traits.map((t) => [String(t.id), t.data]),
  )

  return spawnFromEntityUnsafe(entity, {
    entityId: bundle.entityId,
    source: result.source,
    traits,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Live
// ─────────────────────────────────────────────────────────────────────────────

export const GeointHarnessServiceLive = Layer.succeed(
  GeointHarnessService,
  GeointHarnessService.of({
    atoms: {
      viewport: geointViewportAtom,
      focusedEntityId: geointFocusedEntityIdAtom,
      spawnedEntityIds: spawnedEntityIdsAtom,
      entityCount: entityCountAtom,
      selectedEntityId: selectedEntityIdAtom,
      selectedEntityIds: selectedEntityIdsAtom,
      hoveredEntityId: hoveredEntityIdAtom,
    },

    spawnFromSearchResult: (result) =>
      withSpan(
        'spawnFromSearchResult',
        Effect.try({
          try: () => spawnFromSearchResultUnsafe(result),
          catch: (cause) =>
            new GeointHarnessServiceError({
              operation: 'spawnFromSearchResult',
              message: 'Failed to spawn entity from search result',
              cause,
            }),
        }),
      ),

    spawnBatchFromSearchResults: (results) =>
      withSpan(
        'spawnBatchFromSearchResults',
        Effect.try({
          try: () => results.map((r) => spawnFromSearchResultUnsafe(r)),
          catch: (cause) =>
            new GeointHarnessServiceError({
              operation: 'spawnBatchFromSearchResults',
              message: 'Failed to spawn entity batch',
              cause,
            }),
        }),
      ),

    spawnFromEntity: (entity, options) =>
      withSpan(
        'spawnFromEntity',
        Effect.try({
          try: () => spawnFromEntityUnsafe(entity, options),
          catch: (cause) =>
            new GeointHarnessServiceError({
              operation: 'spawnFromEntity',
              message: 'Failed to spawn entity instance',
              cause,
            }),
        }),
      ),

    despawn: (entityId) =>
      withSpan(
        'despawn',
        Effect.sync(() => {
          despawnEntity(entityId)
          syncEntityAtoms()
        }),
      ),

    clear: () =>
      withSpan(
        'clear',
        Effect.sync(() => {
          clearAllEntities()
          syncEntityAtoms()
          geointHarnessRegistry.set(geointFocusedEntityIdAtom, null)
          geointHarnessRegistry.set(geointViewportAtom, { ...defaultViewport })
        }),
      ),

    select: (entityId) =>
      withSpan(
        'select',
        Effect.sync(() => {
          selectEntity(entityId)
          geointHarnessRegistry.set(geointFocusedEntityIdAtom, entityId)
        }),
      ),

    hover: (entityId) =>
      withSpan(
        'hover',
        Effect.sync(() => {
          hoverEntity(entityId)
        }),
      ),

    togglePin: (entityId) =>
      withSpan(
        'togglePin',
        Effect.sync(() => {
          toggleEntityPin(entityId)
        }),
      ),

    startTracking: (entityId) =>
      withSpan(
        'startTracking',
        Effect.sync(() => startTracking(entityId)),
      ),

    stopTracking: (entityId) =>
      withSpan(
        'stopTracking',
        Effect.sync(() => {
          stopTracking(entityId)
        }),
      ),

    getSummary: (entityId) =>
      withSpan(
        'getSummary',
        Effect.sync(() => getEntitySummary(entityId)),
      ),

    getAllSummaries: () =>
      withSpan(
        'getAllSummaries',
        Effect.sync(() => getAllEntitySummaries()),
      ),

    getByType: (type) =>
      withSpan(
        'getByType',
        Effect.sync(() => getEntitiesByType(type)),
      ),

    getInBounds: (bounds) =>
      withSpan(
        'getInBounds',
        Effect.sync(() => getEntitiesInBounds(bounds)),
      ),

    getViewport: () =>
      withSpan(
        'getViewport',
        Effect.sync(() => geointHarnessRegistry.get(geointViewportAtom)),
      ),

    setViewport: (viewport) =>
      withSpan(
        'setViewport',
        Effect.try({
          try: () => {
            const current = geointHarnessRegistry.get(geointViewportAtom)
            const next: GeointViewport = {
              ...current,
              ...viewport,
            }

            if (next.latitude < -90 || next.latitude > 90) {
              throw new Error('latitude out of range (-90..90)')
            }
            if (next.longitude < -180 || next.longitude > 180) {
              throw new Error('longitude out of range (-180..180)')
            }
            if (next.zoom < 0 || next.zoom > 22) {
              throw new Error('zoom out of range (0..22)')
            }

            geointHarnessRegistry.set(geointViewportAtom, next)
            return next
          },
          catch: (cause) =>
            new GeointHarnessServiceError({
              operation: 'setViewport',
              message: 'Invalid viewport update',
              cause,
            }),
        }),
      ),

    resetViewport: () =>
      withSpan(
        'resetViewport',
        Effect.sync(() => {
          geointHarnessRegistry.set(geointViewportAtom, { ...defaultViewport })
          return geointHarnessRegistry.get(geointViewportAtom)
        }),
      ),

    focusEntity: (entityId, zoom = 10) =>
      withSpan(
        'focusEntity',
        Effect.try({
          try: () => {
            const entity = getEntityStx(entityId)
            if (!entity) {
              throw new Error(`entity '${entityId}' not found`)
            }

            const longitude = entity.data.longitude.get()
            const latitude = entity.data.latitude.get()

            const next: GeointViewport = {
              ...geointHarnessRegistry.get(geointViewportAtom),
              longitude,
              latitude,
              zoom,
            }

            geointHarnessRegistry.set(geointViewportAtom, next)
            geointHarnessRegistry.set(geointFocusedEntityIdAtom, entityId)
            selectEntity(entityId)
            return next
          },
          catch: (cause) =>
            new GeointHarnessServiceError({
              operation: 'focusEntity',
              message: 'Failed to focus entity',
              cause,
            }),
        }),
      ),
  }),
)
