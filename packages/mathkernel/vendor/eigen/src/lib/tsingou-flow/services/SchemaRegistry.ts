/**
 * TsingouSchemaRegistry — Signal schema management backed by Holonet.
 *
 * Thin wrapper over Holonet's SchemaRegistry (in-memory registration/lookup)
 * + Holonet NatsKVService (KV persistence for runtime-registered schemas).
 *
 * Known signal schemas (MIDI, OSC, etc.) are registered at startup.
 * Runtime/dynamic schemas are persisted to NATS KV bucket "tsingou-schemas"
 * and watched for changes.
 *
 * Replaces the previous standalone implementation that bypassed Holonet.
 *
 * @see src/lib/holonet/core/schema/SchemaRegistry.ts — in-memory schema ops
 * @see src/lib/holonet/nats/kv.ts — NATS KV persistence
 * @module tsingou-flow/services/SchemaRegistry
 */

import { Effect, Stream, Layer, Schema } from 'effect'
import { Atom } from '@effect-atom/atom'

// Holonet imports — the real infrastructure
import {
  SchemaRegistry as HolonetSchemaRegistry,
} from '../../holonet/core/schema/SchemaRegistry'
import {
  NatsKVService as HolonetKVService,
  type NatsKVServiceShape as HolonetKVShape,
  type TypedKVEntry,
} from '../../holonet/nats/kv'

// Local schemas for startup registration
import { BaseSignal } from '../schemas/base-signal'
import { MidiSignal } from '../schemas/midi-signal'
import { OscSignal } from '../schemas/osc-signal'
import { NatsSignal } from '../schemas/nats-signal'
import { HttpSignal } from '../schemas/http-signal'
import { SerialSignal } from '../schemas/serial-signal'
import { RssSignal } from '../schemas/rss-signal'
import { WebSocketSignal } from '../schemas/websocket-signal'
import { FileWatchSignal } from '../schemas/file-watch-signal'
import { SchemaRegistryEntry } from '../schemas/registry'

// =============================================================================
// Constants
// =============================================================================

const KV_BUCKET = 'tsingou-schemas'

/** Known signal schemas registered at startup */
const KNOWN_SCHEMAS: ReadonlyArray<{ id: string; schema: Schema.Schema<any, any> }> = [
  { id: 'base', schema: BaseSignal },
  { id: 'midi', schema: MidiSignal },
  { id: 'osc', schema: OscSignal },
  { id: 'nats', schema: NatsSignal },
  { id: 'http', schema: HttpSignal },
  { id: 'serial', schema: SerialSignal },
  { id: 'rss', schema: RssSignal },
  { id: 'websocket', schema: WebSocketSignal },
  { id: 'file-watch', schema: FileWatchSignal },
]

// =============================================================================
// State Atoms (Atom-as-State)
// =============================================================================

/**
 * Count of registered schemas (known + runtime).
 */
export const schemaCountAtom = Atom.make(0)

/**
 * Runtime schema metadata from KV (for UI display).
 */
export const runtimeSchemasAtom = Atom.make<ReadonlyArray<SchemaRegistryEntry>>([])

// =============================================================================
// Service Interface
// =============================================================================

export interface TsingouSchemaRegistryShape {
  /**
   * Register a runtime schema (persisted to NATS KV + Holonet registry).
   */
  readonly registerRuntime: (
    schemaId: string,
    schema: Schema.Schema<any, any>,
    meta: { version: number; createdBy: string; description?: string },
  ) => Effect.Effect<void>

  /**
   * Lookup a schema by signal kind (checks Holonet registry).
   */
  readonly lookup: (schemaId: string) => Effect.Effect<Schema.Schema<any, any> | null>

  /**
   * Check if a schema is registered.
   */
  readonly has: (schemaId: string) => Effect.Effect<boolean>

  /**
   * List all registered schema IDs.
   */
  readonly listIds: Effect.Effect<ReadonlyArray<string>>

  /**
   * Watch for runtime schema changes (from NATS KV).
   */
  readonly watchRuntime: Stream.Stream<TypedKVEntry<SchemaRegistryEntry>>

  /**
   * Bootstrap: register all known schemas + hydrate runtime from KV.
   */
  readonly bootstrap: Effect.Effect<number>
}

// =============================================================================
// Service Implementation
// =============================================================================

export class TsingouSchemaRegistry extends Effect.Service<TsingouSchemaRegistry>()(
  'tsingou/SchemaRegistry',
  {
    effect: Effect.gen(function* () {
      // Pull Holonet services from context
      const holonetRegistry = yield* HolonetSchemaRegistry
      const holonetKV = yield* HolonetKVService

      // -----------------------------------------------------------------------
      // Bootstrap: register known schemas into Holonet registry
      // -----------------------------------------------------------------------
      const bootstrap = Effect.gen(function* () {
        let count = 0

        // Register known signal schemas
        for (const { id, schema } of KNOWN_SCHEMAS) {
          yield* holonetRegistry.registerOrUpdate(id, schema)
          count++
        }

        // Hydrate runtime schemas from NATS KV
        const runtimeEntries = yield* holonetKV.list<SchemaRegistryEntry>(
          KV_BUCKET,
          SchemaRegistryEntry,
        ).pipe(
          Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<TypedKVEntry<SchemaRegistryEntry>>)),
        )

        // Update atom for UI
        Atom.set(
          runtimeSchemasAtom,
          runtimeEntries.map((e) => e.value),
        )

        const total = count + runtimeEntries.length
        Atom.set(schemaCountAtom, total)

        yield* Effect.log(
          `[TsingouSchemaRegistry] Bootstrap: ${count} known + ${runtimeEntries.length} runtime = ${total} schemas`,
        )
        return total
      }).pipe(Effect.withSpan('tsingou.schema.bootstrap'))

      // -----------------------------------------------------------------------
      // Register runtime schema (persisted to KV + Holonet)
      // -----------------------------------------------------------------------
      const registerRuntime = (
        schemaId: string,
        schema: Schema.Schema<any, any>,
        meta: { version: number; createdBy: string; description?: string },
      ) =>
        Effect.gen(function* () {
          // Register in Holonet in-memory registry
          yield* holonetRegistry.registerOrUpdate(schemaId, schema)

          // Persist metadata to NATS KV
          const entry: SchemaRegistryEntry = {
            kind: schemaId,
            version: meta.version,
            jsonSchema: {}, // Could use Schema.JSONSchema.make() here
            description: meta.description,
            createdAt: new Date(),
            createdBy: meta.createdBy,
          }

          yield* holonetKV.put(KV_BUCKET, schemaId, SchemaRegistryEntry, entry)

          // Update atoms
          const current = Atom.unsafeGet(runtimeSchemasAtom)
          Atom.set(runtimeSchemasAtom, [...current.filter((e) => e.kind !== schemaId), entry])
          Atom.set(schemaCountAtom, Atom.unsafeGet(schemaCountAtom) + 1)

          yield* Effect.log(`[TsingouSchemaRegistry] Runtime registered: ${schemaId} v${meta.version}`)
        }).pipe(Effect.withSpan('tsingou.schema.registerRuntime', { attributes: { schemaId } }))

      // -----------------------------------------------------------------------
      // Lookup
      // -----------------------------------------------------------------------
      const lookup = (schemaId: string) =>
        holonetRegistry.getOrNull(schemaId).pipe(
          Effect.withSpan('tsingou.schema.lookup', { attributes: { schemaId } }),
        )

      const has = (schemaId: string) =>
        holonetRegistry.has(schemaId)

      const listIds = holonetRegistry.listIds().pipe(
        Effect.withSpan('tsingou.schema.listIds'),
      )

      // -----------------------------------------------------------------------
      // Watch runtime changes from NATS KV
      // -----------------------------------------------------------------------
      const watchRuntime = holonetKV.watch<SchemaRegistryEntry>(
        KV_BUCKET,
        SchemaRegistryEntry,
        { key: '>' },
      )

      return {
        registerRuntime,
        lookup,
        has,
        listIds,
        watchRuntime,
        bootstrap,
      } satisfies TsingouSchemaRegistryShape
    }),
    dependencies: [HolonetSchemaRegistry.Default, HolonetKVService.Default],
  },
) {}

// =============================================================================
// Layer
// =============================================================================

export const TsingouSchemaRegistryLive = TsingouSchemaRegistry.Default
