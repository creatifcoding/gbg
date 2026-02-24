/**
 * GEOINT Trait Fermions — Schema-driven Atom.family per trait type
 *
 * Each Kori trait gets its own Fermion family keyed by entityId.
 * Traits are independently fetchable, cacheable, and invalidatable.
 *
 * Architecture:
 * - Fermion wraps existing Kori trait schemas (Schema.TaggedStruct)
 * - Memory interpreter (no HTTP) — data populated via spawn/hydrate
 * - Each Fermion: entityId → Atom<Result<TraitData, E>>
 * - Independent lifecycle per trait (flight data stales faster than POI data)
 *
 * @module geoint/fermion/trait-fermions
 */

import { Effect, Duration, Schema } from 'effect'
import * as Fermion from '../../fermion'

// ─────────────────────────────────────────────────────────────────────────────
// Trait Schema Wrappers (add entityId field for Fermion keying)
// ─────────────────────────────────────────────────────────────────────────────

// Fermion needs a key field on the schema. Kori traits don't have entityId,
// so we wrap each trait with an entityId envelope.

/**
 * Wrap a trait schema with entityId for Fermion keying.
 * The Fermion stores { entityId, ...traitFields } per entity.
 */
function traitEnvelope<Tag extends string, Fields extends Schema.Struct.Fields>(
  tag: Tag,
  traitSchema: Schema.TaggedStruct<Tag, Fields>,
) {
  return Schema.Struct({
    entityId: Schema.String,
    trait: traitSchema,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────────────────────

export class TraitNotFoundError {
  readonly _tag = 'TraitNotFoundError' as const
  constructor(
    readonly entityId: string,
    readonly traitName: string,
  ) {}
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Trait Stores (backing the Fermion fetch)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * In-memory store for trait data per entity.
 * Populated by entity spawn/hydrate, read by Fermion fetch.
 */
class TraitStore<T> {
  private readonly data = new Map<string, T>()

  set(entityId: string, value: T): void {
    this.data.set(entityId, value)
  }

  get(entityId: string): T | undefined {
    return this.data.get(entityId)
  }

  has(entityId: string): boolean {
    return this.data.has(entityId)
  }

  delete(entityId: string): boolean {
    return this.data.delete(entityId)
  }

  clear(): void {
    this.data.clear()
  }

  get size(): number {
    return this.data.size
  }

  entries(): IterableIterator<[string, T]> {
    return this.data.entries()
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Trait Imports
// ─────────────────────────────────────────────────────────────────────────────

import {
  GeoPosition,
  GeoPosition3D,
  Heading,
  GeoVelocity,
} from '../kori/traits/position'

import {
  FlightData,
  FlightRegistration,
  FlightRoute,
} from '../kori/traits/flight'

import {
  TrackData,
  TrackHistory,
  TrackSource,
} from '../kori/traits/track'

import {
  UIState,
  UIFocus,
  UIEditState,
} from '../kori/traits/ui-state'

import {
  AnimationState,
  AnimationTarget,
  AnimationEasing,
} from '../kori/traits/animation-state'

import {
  SourceConfidence,
  SourceTiming,
  SourceQuality,
} from '../kori/traits/source-confidence'

import {
  PoiData,
  PoiTags,
  PoiContact,
  PoiAddress,
} from '../kori/traits/poi'

import {
  WeatherData,
  WeatherWind,
  WeatherPrecipitation,
  WeatherAtmospheric,
  WeatherForecastMeta,
} from '../kori/traits/weather'

import {
  ImageryData,
  ImageryQuality,
  ImageryGeometry,
  ImageryAssets,
  ImagerySatellite,
} from '../kori/traits/imagery'

// ─────────────────────────────────────────────────────────────────────────────
// Fermion Factory Helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a trait Fermion with memory-backed fetch.
 *
 * Pattern: entityId → Atom<Result<{ entityId, trait }, TraitNotFoundError>>
 *
 * The store is populated externally (via spawn/hydrate), and the Fermion
 * reads from it. This gives us schema validation, atom caching, and
 * independent lifecycle per trait.
 */
function createTraitFermion<Tag extends string, Fields extends Schema.Struct.Fields>(
  traitName: string,
  traitSchema: Schema.TaggedStruct<Tag, Fields>,
  ttl?: Duration.Duration,
) {
  type TraitType = Schema.Schema.Type<typeof traitSchema>
  const EnvelopeSchema = traitEnvelope(traitName as Tag, traitSchema)
  type Envelope = Schema.Schema.Type<typeof EnvelopeSchema>

  const store = new TraitStore<TraitType>()

  const fermion = Fermion.fromSchema(EnvelopeSchema)
    .withKey('entityId' as any)
    .withFetch((entityId: string) =>
      Effect.sync(() => {
        const data = store.get(entityId)
        if (!data) {
          throw new TraitNotFoundError(entityId, traitName)
        }
        return { entityId, trait: data } as Envelope
      }).pipe(
        Effect.catchAllDefect((defect) =>
          defect instanceof TraitNotFoundError
            ? Effect.fail(defect)
            : Effect.die(defect)
        ),
      )
    )
    .withLifecycle({ keepAlive: true, ...(ttl ? { ttl } : {}) })
    .buildWithDeps()

  return {
    fermion,
    store,
    /** Populate trait data for an entity (call during spawn/hydrate) */
    set: (entityId: string, data: TraitType) => store.set(entityId, data),
    /** Remove trait data for an entity (call during despawn) */
    remove: (entityId: string) => store.delete(entityId),
    /** Check if entity has this trait */
    has: (entityId: string) => store.has(entityId),
    /** Get raw trait data (synchronous, bypasses Fermion) */
    peek: (entityId: string) => store.get(entityId),
    /** Clear all entries */
    clear: () => store.clear(),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE TRAIT FERMIONS
// ─────────────────────────────────────────────────────────────────────────────

// Position traits — update frequently for moving entities
export const geoPositionFermion = createTraitFermion(
  'GeoPosition', GeoPosition, Duration.seconds(30),
)
export const geoPosition3DFermion = createTraitFermion(
  'GeoPosition3D', GeoPosition3D, Duration.seconds(30),
)
export const headingFermion = createTraitFermion(
  'Heading', Heading, Duration.seconds(30),
)
export const geoVelocityFermion = createTraitFermion(
  'GeoVelocity', GeoVelocity, Duration.seconds(30),
)

// Flight traits — semi-static, longer TTL
export const flightDataFermion = createTraitFermion(
  'FlightData', FlightData, Duration.minutes(1),
)
export const flightRegistrationFermion = createTraitFermion(
  'FlightRegistration', FlightRegistration, Duration.hours(1),
)
export const flightRouteFermion = createTraitFermion(
  'FlightRoute', FlightRoute, Duration.hours(1),
)

// Track traits — update periodically
export const trackDataFermion = createTraitFermion(
  'TrackData', TrackData, Duration.minutes(1),
)
export const trackHistoryFermion = createTraitFermion(
  'TrackHistory', TrackHistory, Duration.minutes(5),
)
export const trackSourceFermion = createTraitFermion(
  'TrackSource', TrackSource, Duration.minutes(5),
)

// UI State traits — no TTL, persists until entity despawns
export const uiStateFermion = createTraitFermion(
  'UIState', UIState,
)
export const uiFocusFermion = createTraitFermion(
  'UIFocus', UIFocus,
)
export const uiEditStateFermion = createTraitFermion(
  'UIEditState', UIEditState,
)

// Animation traits — ephemeral, short TTL
export const animationStateFermion = createTraitFermion(
  'AnimationState', AnimationState, Duration.seconds(5),
)
export const animationTargetFermion = createTraitFermion(
  'AnimationTarget', AnimationTarget, Duration.seconds(5),
)
export const animationEasingFermion = createTraitFermion(
  'AnimationEasing', AnimationEasing, Duration.seconds(5),
)

// Source confidence traits — moderate TTL
export const sourceConfidenceFermion = createTraitFermion(
  'SourceConfidence', SourceConfidence, Duration.minutes(5),
)
export const sourceTimingFermion = createTraitFermion(
  'SourceTiming', SourceTiming, Duration.minutes(5),
)
export const sourceQualityFermion = createTraitFermion(
  'SourceQuality', SourceQuality, Duration.minutes(5),
)

// ─────────────────────────────────────────────────────────────────────────────
// EXTENDED TRAIT FERMIONS (POI, Weather, Imagery)
// ─────────────────────────────────────────────────────────────────────────────

// POI traits — static, long TTL
export const poiDataFermion = createTraitFermion(
  'PoiData', PoiData, Duration.hours(1),
)
export const poiTagsFermion = createTraitFermion(
  'PoiTags', PoiTags, Duration.hours(1),
)
export const poiContactFermion = createTraitFermion(
  'PoiContact', PoiContact, Duration.hours(1),
)
export const poiAddressFermion = createTraitFermion(
  'PoiAddress', PoiAddress, Duration.hours(1),
)

// Weather traits — moderate TTL
export const weatherDataFermion = createTraitFermion(
  'WeatherData', WeatherData, Duration.minutes(15),
)
export const weatherWindFermion = createTraitFermion(
  'WeatherWind', WeatherWind, Duration.minutes(15),
)
export const weatherPrecipitationFermion = createTraitFermion(
  'WeatherPrecipitation', WeatherPrecipitation, Duration.minutes(15),
)
export const weatherAtmosphericFermion = createTraitFermion(
  'WeatherAtmospheric', WeatherAtmospheric, Duration.minutes(15),
)
export const weatherForecastMetaFermion = createTraitFermion(
  'WeatherForecastMeta', WeatherForecastMeta, Duration.minutes(15),
)

// Imagery traits — very static, long TTL
export const imageryDataFermion = createTraitFermion(
  'ImageryData', ImageryData, Duration.days(1),
)
export const imageryQualityFermion = createTraitFermion(
  'ImageryQuality', ImageryQuality, Duration.days(1),
)
export const imageryGeometryFermion = createTraitFermion(
  'ImageryGeometry', ImageryGeometry, Duration.days(1),
)
export const imageryAssetsFermion = createTraitFermion(
  'ImageryAssets', ImageryAssets, Duration.days(1),
)
export const imagerySatelliteFermion = createTraitFermion(
  'ImagerySatellite', ImagerySatellite, Duration.days(1),
)

// ─────────────────────────────────────────────────────────────────────────────
// Trait Registry — lookup by name
// ─────────────────────────────────────────────────────────────────────────────

/**
 * All trait Fermions indexed by trait name.
 * Enables dynamic trait lookup: traitRegistry.get('FlightData')
 */
export const traitRegistry = new Map<string, ReturnType<typeof createTraitFermion>>([
  // Position
  ['GeoPosition', geoPositionFermion],
  ['GeoPosition3D', geoPosition3DFermion],
  ['Heading', headingFermion],
  ['GeoVelocity', geoVelocityFermion],
  // Flight
  ['FlightData', flightDataFermion],
  ['FlightRegistration', flightRegistrationFermion],
  ['FlightRoute', flightRouteFermion],
  // Track
  ['TrackData', trackDataFermion],
  ['TrackHistory', trackHistoryFermion],
  ['TrackSource', trackSourceFermion],
  // UI
  ['UIState', uiStateFermion],
  ['UIFocus', uiFocusFermion],
  ['UIEditState', uiEditStateFermion],
  // Animation
  ['AnimationState', animationStateFermion],
  ['AnimationTarget', animationTargetFermion],
  ['AnimationEasing', animationEasingFermion],
  // Source
  ['SourceConfidence', sourceConfidenceFermion],
  ['SourceTiming', sourceTimingFermion],
  ['SourceQuality', sourceQualityFermion],
  // POI
  ['PoiData', poiDataFermion],
  ['PoiTags', poiTagsFermion],
  ['PoiContact', poiContactFermion],
  ['PoiAddress', poiAddressFermion],
  // Weather
  ['WeatherData', weatherDataFermion],
  ['WeatherWind', weatherWindFermion],
  ['WeatherPrecipitation', weatherPrecipitationFermion],
  ['WeatherAtmospheric', weatherAtmosphericFermion],
  ['WeatherForecastMeta', weatherForecastMetaFermion],
  // Imagery
  ['ImageryData', imageryDataFermion],
  ['ImageryQuality', imageryQualityFermion],
  ['ImageryGeometry', imageryGeometryFermion],
  ['ImageryAssets', imageryAssetsFermion],
  ['ImagerySatellite', imagerySatelliteFermion],
])

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Remove all trait data for an entity across all Fermions.
 */
export function despawnEntityTraits(entityId: string): void {
  for (const [, fermion] of traitRegistry) {
    fermion.remove(entityId)
  }
}

/**
 * Clear all trait stores (e.g., on full reset).
 */
export function clearAllTraitStores(): void {
  for (const [, fermion] of traitRegistry) {
    fermion.clear()
  }
}

/**
 * Get all trait names that exist for an entity.
 */
export function getEntityTraitNames(entityId: string): string[] {
  const names: string[] = []
  for (const [name, fermion] of traitRegistry) {
    if (fermion.has(entityId)) names.push(name)
  }
  return names
}
