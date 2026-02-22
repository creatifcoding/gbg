/**
 * DataSourceResolver — Resolve and subscribe to data bindings
 *
 * Handles the progressive hydration model:
 *   static  → inline value (mock data from LLM)
 *   atom    → live atom binding (real-time reactive)
 *   query   → Effect query (async, with optional caching)
 *   rpc     → RPC call (on-demand)
 *
 * Also handles bidirectional writeback:
 *   StateChange → resolve binding → write value back to source
 *
 * @module genifer/harness/DataSourceResolver
 */

import { Context, Effect, Layer, Stream, Schedule, Schema, Duration, Option } from 'effect'
import * as Atom from '@effect-atom/atom/Atom'
import * as Registry from '@effect-atom/atom/Registry'
import type { DataSourceBinding } from './surface'

// =============================================================================
// Error Types
// =============================================================================

export class DataSourceError extends Schema.TaggedError<DataSourceError>()(
  'DataSourceError',
  {
    binding: Schema.String,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

// =============================================================================
// Atom Registry — Known atoms that can be resolved by key
// =============================================================================

/**
 * Registry of named atoms that DataSourceResolver can resolve.
 * Services register their atoms here; elements bind to them by key.
 *
 * Example:
 *   atomDirectory.set('iiot/userCount', userCountAtom)
 *   atomDirectory.set('iiot/alarmStats', alarmStatsAtom)
 *
 * Then a genifer element with:
 *   dataSource: { type: 'atom', key: 'iiot/userCount', targetProp: 'value' }
 * resolves to the live userCountAtom value.
 */
export const atomDirectoryAtom = Atom.make<ReadonlyMap<string, Atom.Atom<unknown>>>(
  new Map(),
).pipe(Atom.keepAlive)

// =============================================================================
// Query/RPC Registries
// =============================================================================

/** A registered query function (keyed by name) */
export type QueryFn = () => Effect.Effect<unknown, DataSourceError>

/** A registered RPC function (keyed by tag) */
export type RpcFn = (payload?: unknown) => Effect.Effect<unknown, DataSourceError>

export const queryDirectoryAtom = Atom.make<ReadonlyMap<string, QueryFn>>(
  new Map(),
).pipe(Atom.keepAlive)

export const rpcDirectoryAtom = Atom.make<ReadonlyMap<string, RpcFn>>(
  new Map(),
).pipe(Atom.keepAlive)

// =============================================================================
// DataSourceResolver Service
// =============================================================================

export interface DataSourceResolverShape {
  /**
   * Resolve a single binding to its current value.
   */
  readonly resolve: (binding: DataSourceBinding) => Effect.Effect<unknown, DataSourceError>

  /**
   * Subscribe to a binding — returns a stream of value changes.
   * For atom: reactive stream via Atom subscription.
   * For query: polls at refreshMs interval.
   * For rpc: single value, then done.
   * For static: single value, then done.
   */
  readonly subscribe: (binding: DataSourceBinding) => Stream.Stream<unknown, DataSourceError>

  /**
   * Write a value back to a data source (for bidirectional bindings).
   * Only supported for atom and rpc types.
   */
  readonly writeback: (
    binding: DataSourceBinding,
    value: unknown,
  ) => Effect.Effect<void, DataSourceError>

  /**
   * Resolve all bindings for a surface's elements.
   * Returns a map of bindingKey → resolved value.
   */
  readonly resolveAll: (
    bindings: Record<string, DataSourceBinding>,
  ) => Effect.Effect<ReadonlyMap<string, unknown>, DataSourceError>

  /**
   * Register a named atom in the directory.
   */
  readonly registerAtom: (key: string, atom: Atom.Atom<unknown>) => void

  /**
   * Register a named query in the directory.
   */
  readonly registerQuery: (key: string, fn: QueryFn) => void

  /**
   * Register a named RPC in the directory.
   */
  readonly registerRpc: (key: string, fn: RpcFn) => void
}

export class DataSourceResolver extends Context.Tag('genifer/DataSourceResolver')<
  DataSourceResolver,
  DataSourceResolverShape
>() {}

// =============================================================================
// Live Implementation
// =============================================================================

export const DataSourceResolverLive = Layer.sync(DataSourceResolver, () => {
  const registry = Registry.make()

  const resolveAtom = (key: string): Effect.Effect<unknown, DataSourceError> =>
    Effect.sync(() => {
      const dir = registry.get(atomDirectoryAtom)
      const atom = dir.get(key)
      if (!atom) {
        return Effect.fail(new DataSourceError({
          binding: key,
          message: `Atom not found in directory: '${key}'`,
        }))
      }
      return Effect.succeed(registry.get(atom))
    }).pipe(Effect.flatten)

  const resolveQuery = (key: string): Effect.Effect<unknown, DataSourceError> =>
    Effect.sync(() => {
      const dir = registry.get(queryDirectoryAtom)
      const fn = dir.get(key)
      if (!fn) {
        return Effect.fail(new DataSourceError({
          binding: key,
          message: `Query not found in directory: '${key}'`,
        }))
      }
      return fn()
    }).pipe(Effect.flatten)

  const resolveRpc = (key: string, payload?: unknown): Effect.Effect<unknown, DataSourceError> =>
    Effect.sync(() => {
      const dir = registry.get(rpcDirectoryAtom)
      const fn = dir.get(key)
      if (!fn) {
        return Effect.fail(new DataSourceError({
          binding: key,
          message: `RPC not found in directory: '${key}'`,
        }))
      }
      return fn(payload)
    }).pipe(Effect.flatten)

  const resolve = (binding: DataSourceBinding): Effect.Effect<unknown, DataSourceError> => {
    switch (binding.type) {
      case 'static':
        return Effect.succeed(binding.staticValue ?? null)
      case 'atom':
        return resolveAtom(binding.key)
      case 'query':
        return resolveQuery(binding.key)
      case 'rpc':
        return resolveRpc(binding.key)
      default:
        return Effect.fail(new DataSourceError({
          binding: binding.key,
          message: `Unknown data source type: '${(binding as any).type}'`,
        }))
    }
  }

  const subscribe = (binding: DataSourceBinding): Stream.Stream<unknown, DataSourceError> => {
    switch (binding.type) {
      case 'static':
        return Stream.make(binding.staticValue ?? null)

      case 'atom': {
        // Reactive stream: emit current value + all future changes
        return Stream.async<unknown, DataSourceError>((emit) => {
          const dir = registry.get(atomDirectoryAtom)
          const atom = dir.get(binding.key)
          if (!atom) {
            emit.fail(new DataSourceError({
              binding: binding.key,
              message: `Atom not found: '${binding.key}'`,
            }))
            return
          }
          // Emit current value
          emit.single(registry.get(atom))
          // Subscribe to changes
          registry.subscribe(atom, (value) => {
            emit.single(value)
          })
        })
      }

      case 'query': {
        // Polling stream at refreshMs interval (default: once)
        const interval = binding.refreshMs ?? 0
        if (interval <= 0) {
          return Stream.fromEffect(resolveQuery(binding.key))
        }
        return Stream.fromEffect(resolveQuery(binding.key)).pipe(
          Stream.concat(
            Stream.repeatEffectWithSchedule(
              resolveQuery(binding.key),
              Schedule.spaced(Duration.millis(interval)),
            )
          ),
        )
      }

      case 'rpc':
        // Single-shot, no subscription
        return Stream.fromEffect(resolveRpc(binding.key))

      default:
        return Stream.fail(new DataSourceError({
          binding: binding.key,
          message: `Cannot subscribe to type: '${(binding as any).type}'`,
        }))
    }
  }

  const writeback = (
    binding: DataSourceBinding,
    value: unknown,
  ): Effect.Effect<void, DataSourceError> => {
    switch (binding.type) {
      case 'atom': {
        return Effect.sync(() => {
          const dir = registry.get(atomDirectoryAtom)
          const atom = dir.get(binding.key)
          if (!atom) {
            return Effect.fail(new DataSourceError({
              binding: binding.key,
              message: `Cannot writeback: atom '${binding.key}' not found`,
            }))
          }
          // Write to the atom
          registry.set(atom as Atom.Atom<unknown> & Atom.Writable<unknown>, value)
          return Effect.void
        }).pipe(Effect.flatten)
      }
      case 'rpc': {
        return resolveRpc(binding.key, value).pipe(Effect.asVoid)
      }
      case 'static':
        return Effect.fail(new DataSourceError({
          binding: binding.key,
          message: 'Cannot writeback to static data source',
        }))
      case 'query':
        return Effect.fail(new DataSourceError({
          binding: binding.key,
          message: 'Cannot writeback to query data source (read-only)',
        }))
      default:
        return Effect.fail(new DataSourceError({
          binding: binding.key,
          message: `Cannot writeback to type: '${(binding as any).type}'`,
        }))
    }
  }

  const resolveAll = (
    bindings: Record<string, DataSourceBinding>,
  ): Effect.Effect<ReadonlyMap<string, unknown>, DataSourceError> =>
    Effect.gen(function* () {
      const result = new Map<string, unknown>()
      for (const [bindingKey, binding] of Object.entries(bindings)) {
        const value = yield* resolve(binding)
        result.set(bindingKey, value)
      }
      return result
    })

  return DataSourceResolver.of({
    resolve,
    subscribe,
    writeback,
    resolveAll,

    registerAtom(key, atom) {
      const dir = new Map(registry.get(atomDirectoryAtom))
      dir.set(key, atom)
      registry.set(atomDirectoryAtom, dir)
    },

    registerQuery(key, fn) {
      const dir = new Map(registry.get(queryDirectoryAtom))
      dir.set(key, fn)
      registry.set(queryDirectoryAtom, dir)
    },

    registerRpc(key, fn) {
      const dir = new Map(registry.get(rpcDirectoryAtom))
      dir.set(key, fn)
      registry.set(rpcDirectoryAtom, dir)
    },
  })
})
