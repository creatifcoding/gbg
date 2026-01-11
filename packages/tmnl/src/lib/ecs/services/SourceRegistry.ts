/**
 * SourceRegistry - Intelligence Source Configuration
 *
 * Manages intel source priorities, weights, and configuration.
 * Used by ConfidenceService and FusionPipeline.
 *
 * @module ecs/services/SourceRegistry
 */

import { Effect, Schema, HashMap, Option } from 'effect'
import { IntelSource } from '../schemas/core'

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Configuration for an intelligence source
 */
export class SourceConfig extends Schema.TaggedClass<SourceConfig>()(
  'SourceConfig',
  {
    source: IntelSource,
    priority: Schema.Number.pipe(Schema.between(0, 100)),
    weight: Schema.Number.pipe(Schema.between(0, 1)),
    defaultTtlSeconds: Schema.Number.pipe(Schema.greaterThan(0)),
    enabled: Schema.optionalWith(Schema.Boolean, { default: () => true }),
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),
  }
) {}

// =============================================================================
// Error Types
// =============================================================================

export class SourceNotFoundError extends Schema.TaggedError<SourceNotFoundError>()(
  'SourceNotFoundError',
  {
    source: IntelSource,
    message: Schema.String,
  }
) {}

// =============================================================================
// Default Source Configurations
// =============================================================================

const DEFAULT_CONFIGS: readonly SourceConfig[] = [
  new SourceConfig({ source: 'opensky', priority: 80, weight: 0.9, defaultTtlSeconds: 60 }),
  new SourceConfig({ source: 'adsb-lol', priority: 70, weight: 0.85, defaultTtlSeconds: 60 }),
  new SourceConfig({ source: 'flightradar24', priority: 85, weight: 0.95, defaultTtlSeconds: 60 }),
  new SourceConfig({ source: 'overpass', priority: 90, weight: 0.95, defaultTtlSeconds: 86400 }),
  new SourceConfig({ source: 'osm', priority: 90, weight: 0.95, defaultTtlSeconds: 86400 }),
  new SourceConfig({ source: 'nominatim', priority: 85, weight: 0.9, defaultTtlSeconds: 3600 }),
  new SourceConfig({ source: 'planet', priority: 95, weight: 0.98, defaultTtlSeconds: 604800 }),
  new SourceConfig({ source: 'sentinel', priority: 90, weight: 0.95, defaultTtlSeconds: 604800 }),
  new SourceConfig({ source: 'maxar', priority: 98, weight: 0.99, defaultTtlSeconds: 604800 }),
  new SourceConfig({ source: 'openmeteo', priority: 85, weight: 0.9, defaultTtlSeconds: 3600 }),
  new SourceConfig({ source: 'noaa', priority: 90, weight: 0.95, defaultTtlSeconds: 3600 }),
  new SourceConfig({ source: 'manual', priority: 100, weight: 1.0, defaultTtlSeconds: 2592000 }),
  new SourceConfig({ source: 'derived', priority: 50, weight: 0.7, defaultTtlSeconds: 300 }),
  new SourceConfig({ source: 'fused', priority: 75, weight: 0.85, defaultTtlSeconds: 300 }),
  new SourceConfig({ source: 'unknown', priority: 10, weight: 0.3, defaultTtlSeconds: 60 }),
]

// =============================================================================
// Service Definition
// =============================================================================

/**
 * SourceRegistry - manages intel source configurations.
 */
export class SourceRegistry extends Effect.Service<SourceRegistry>()(
  'ecs/SourceRegistry',
  {
    accessors: true,
    sync: () => {
      let registry = HashMap.empty<IntelSource, SourceConfig>()
      for (const config of DEFAULT_CONFIGS) {
        registry = HashMap.set(registry, config.source, config)
      }

      const getConfig = (
        source: IntelSource
      ): Effect.Effect<SourceConfig, SourceNotFoundError> =>
        Effect.gen(function* () {
          const config = HashMap.get(registry, source)
          if (Option.isNone(config)) {
            return yield* Effect.fail(
              new SourceNotFoundError({
                source,
                message: `Source ${source} not found in registry`,
              })
            )
          }
          return config.value
        })

      return {
        register: (config: SourceConfig): Effect.Effect<void> =>
          Effect.sync(() => {
            registry = HashMap.set(registry, config.source, config)
          }),

        getConfig,

        getPriority: (source: IntelSource): Effect.Effect<number, SourceNotFoundError> =>
          getConfig(source).pipe(Effect.map((c) => c.priority)),

        getWeight: (source: IntelSource): Effect.Effect<number, SourceNotFoundError> =>
          getConfig(source).pipe(Effect.map((c) => c.weight)),

        getDefaultTtl: (source: IntelSource): Effect.Effect<number, SourceNotFoundError> =>
          getConfig(source).pipe(Effect.map((c) => c.defaultTtlSeconds)),

        list: (): Effect.Effect<readonly SourceConfig[]> =>
          Effect.sync(() => [...HashMap.values(registry)]),

        listEnabled: (): Effect.Effect<readonly SourceConfig[]> =>
          Effect.sync(() => [...HashMap.values(registry)].filter((c) => c.enabled)),

        compareByPriority: (
          a: IntelSource,
          b: IntelSource
        ): Effect.Effect<IntelSource, SourceNotFoundError> =>
          Effect.gen(function* () {
            const configA = yield* getConfig(a)
            const configB = yield* getConfig(b)
            return configA.priority >= configB.priority ? a : b
          }),
      }
    },
  }
) {}
