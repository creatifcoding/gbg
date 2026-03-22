/**
 * TokenRegistry — Effect Service
 *
 * A branded registry service following Effect's Context.Tag pattern.
 * Creates type-safe, runtime-validated tokens that can only be obtained
 * through registration.
 *
 * Pattern: Effect.Service with Ref-based state.
 *
 * @module
 */

import { Context, Effect, Ref, Layer, pipe, PubSub } from "effect"
import type {
  Token,
  TokenEntry,
  TokenRegistryConfig,
  TokenRegistration,
  TokenRegistryEvent,
  TokenSource,
} from "./types"
import {
  TokenNotFoundError,
  TokenAlreadyExistsError,
  RegistrationDisabledError,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Service Shape
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The shape of a TokenRegistry service instance.
 *
 * Generic over:
 * - N: Namespace string (e.g., "scope", "layer")
 * - M: Metadata type for entries
 */
export interface TokenRegistryShape<N extends string, M = unknown> {
  /** The namespace this registry manages */
  readonly namespace: N

  /** Configuration used to create this registry */
  readonly config: TokenRegistryConfig<N, M>

  // ─── Core Operations ─────────────────────────────────────────────────────────

  /**
   * Register a new token.
   * Returns the branded Token<N> on success.
   */
  readonly register: (
    registration: TokenRegistration<M>
  ) => Effect.Effect<Token<N>, TokenAlreadyExistsError | RegistrationDisabledError>

  /**
   * Get a token by ID, validating it exists.
   * Returns branded Token<N> — proof of membership.
   */
  readonly get: (id: string) => Effect.Effect<Token<N>, TokenNotFoundError>

  /**
   * Get a token's full entry with metadata.
   */
  readonly getEntry: (id: string) => Effect.Effect<TokenEntry<M>, TokenNotFoundError>

  /**
   * Check if a token exists without retrieving it.
   */
  readonly has: (id: string) => Effect.Effect<boolean>

  /**
   * Get all registered tokens.
   */
  readonly all: () => Effect.Effect<ReadonlyArray<Token<N>>>

  /**
   * Get all entries with metadata.
   */
  readonly allEntries: () => Effect.Effect<ReadonlyArray<TokenEntry<M>>>

  /**
   * Remove a token. Returns true if removed, false if not found.
   */
  readonly remove: (id: string) => Effect.Effect<boolean>

  /**
   * Update a token's metadata.
   */
  readonly update: (
    id: string,
    updates: Partial<Omit<TokenRegistration<M>, "id">>
  ) => Effect.Effect<TokenEntry<M>, TokenNotFoundError>

  // ─── Query Operations ────────────────────────────────────────────────────────

  /**
   * Find tokens matching a predicate.
   */
  readonly find: (
    predicate: (entry: TokenEntry<M>) => boolean
  ) => Effect.Effect<ReadonlyArray<Token<N>>>

  /**
   * Find tokens by source.
   */
  readonly findBySource: (source: TokenSource) => Effect.Effect<ReadonlyArray<Token<N>>>

  // ─── Event Subscription ──────────────────────────────────────────────────────

  /**
   * Subscribe to registry events.
   * Returns a queue that emits events as they occur.
   */
  readonly events: PubSub.PubSub<TokenRegistryEvent>
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal State
// ─────────────────────────────────────────────────────────────────────────────

interface RegistryState<M> {
  readonly entries: Map<string, TokenEntry<M>>
  readonly frozen: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a TokenRegistry implementation from configuration.
 *
 * This is the internal factory — use `make()` for the public Layer factory.
 */
const makeImpl = <N extends string, M = unknown>(
  config: TokenRegistryConfig<N, M>
): Effect.Effect<TokenRegistryShape<N, M>> =>
  Effect.gen(function* () {
    // Initialize state with builtins
    const initialEntries = new Map<string, TokenEntry<M>>()
    const now = Date.now()

    for (const builtin of config.builtins ?? []) {
      initialEntries.set(builtin.id, {
        id: builtin.id,
        name: builtin.name,
        description: builtin.description,
        source: builtin.source ?? "builtin",
        metadata: (builtin.metadata ?? config.defaultMetadata) as M,
        registeredAt: now,
      })
    }

    const stateRef = yield* Ref.make<RegistryState<M>>({
      entries: initialEntries,
      frozen: !config.allowRuntimeRegistration,
    })

    // PubSub for events
    const eventsPubSub = yield* PubSub.unbounded<TokenRegistryEvent>()

    // Helper: emit event
    const emitEvent = (event: TokenRegistryEvent) =>
      PubSub.publish(eventsPubSub, event)

    // Helper: brand a string as Token<N>
    const brand = (id: string): Token<N> => id as Token<N>

    // ─── Implementation ────────────────────────────────────────────────────────

    const register: TokenRegistryShape<N, M>["register"] = (registration) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        // Check if runtime registration is allowed
        if (state.frozen) {
          return yield* Effect.fail(new RegistrationDisabledError(config.namespace))
        }

        // Check for existing token
        const existing = state.entries.get(registration.id)
        if (existing && !config.allowOverwrite) {
          return yield* Effect.fail(
            new TokenAlreadyExistsError(config.namespace, registration.id, existing.source)
          )
        }

        // Create entry
        const entry: TokenEntry<M> = {
          id: registration.id,
          name: registration.name,
          description: registration.description,
          source: registration.source ?? "runtime",
          metadata: (registration.metadata ?? config.defaultMetadata) as M,
          registeredAt: Date.now(),
        }

        // Update state
        yield* Ref.update(stateRef, (s) => {
          const newEntries = new Map(s.entries)
          newEntries.set(registration.id, entry)
          return { ...s, entries: newEntries }
        })

        // Emit event
        yield* emitEvent({
          _tag: "TokenRegistered",
          id: registration.id,
          source: entry.source,
          timestamp: entry.registeredAt,
        })

        return brand(registration.id)
      })

    const get: TokenRegistryShape<N, M>["get"] = (id) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const entry = state.entries.get(id)

        if (!entry) {
          return yield* Effect.fail(new TokenNotFoundError(config.namespace, id))
        }

        return brand(id)
      })

    const getEntry: TokenRegistryShape<N, M>["getEntry"] = (id) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const entry = state.entries.get(id)

        if (!entry) {
          return yield* Effect.fail(new TokenNotFoundError(config.namespace, id))
        }

        return entry
      })

    const has: TokenRegistryShape<N, M>["has"] = (id) =>
      pipe(
        Ref.get(stateRef),
        Effect.map((state) => state.entries.has(id))
      )

    const all: TokenRegistryShape<N, M>["all"] = () =>
      pipe(
        Ref.get(stateRef),
        Effect.map((state) => Array.from(state.entries.keys()).map(brand))
      )

    const allEntries: TokenRegistryShape<N, M>["allEntries"] = () =>
      pipe(
        Ref.get(stateRef),
        Effect.map((state) => Array.from(state.entries.values()))
      )

    const remove: TokenRegistryShape<N, M>["remove"] = (id) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)

        if (!state.entries.has(id)) {
          return false
        }

        yield* Ref.update(stateRef, (s) => {
          const newEntries = new Map(s.entries)
          newEntries.delete(id)
          return { ...s, entries: newEntries }
        })

        yield* emitEvent({
          _tag: "TokenRemoved",
          id,
          timestamp: Date.now(),
        })

        return true
      })

    const update: TokenRegistryShape<N, M>["update"] = (id, updates) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(stateRef)
        const existing = state.entries.get(id)

        if (!existing) {
          return yield* Effect.fail(new TokenNotFoundError(config.namespace, id))
        }

        const updated: TokenEntry<M> = {
          ...existing,
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.description !== undefined && { description: updates.description }),
          ...(updates.source !== undefined && { source: updates.source }),
          ...(updates.metadata !== undefined && { metadata: updates.metadata }),
        }

        yield* Ref.update(stateRef, (s) => {
          const newEntries = new Map(s.entries)
          newEntries.set(id, updated)
          return { ...s, entries: newEntries }
        })

        yield* emitEvent({
          _tag: "TokenUpdated",
          id,
          timestamp: Date.now(),
        })

        return updated
      })

    const find: TokenRegistryShape<N, M>["find"] = (predicate) =>
      pipe(
        Ref.get(stateRef),
        Effect.map((state) =>
          Array.from(state.entries.values())
            .filter(predicate)
            .map((e) => brand(e.id))
        )
      )

    const findBySource: TokenRegistryShape<N, M>["findBySource"] = (source) =>
      find((entry) => entry.source === source)

    return {
      namespace: config.namespace,
      config,
      register,
      get,
      getEntry,
      has,
      all,
      allEntries,
      remove,
      update,
      find,
      findBySource,
      events: eventsPubSub,
    }
  })

// ─────────────────────────────────────────────────────────────────────────────
// Public Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a TokenRegistry Tag for a specific namespace.
 *
 * This follows Effect's pattern of creating Context.Tag per service type.
 *
 * @example
 * ```ts
 * // Define the tag
 * class ScopeRegistry extends TokenRegistry.Tag<ScopeRegistry>()("ScopeRegistry")<"scope", ScopeMetadata>() {}
 *
 * // Or use the factory
 * const ScopeRegistry = TokenRegistry.makeTag<"scope", ScopeMetadata>("ScopeRegistry")
 * ```
 */
export const makeTag = <N extends string, M = unknown>(identifier: string) =>
  Context.GenericTag<TokenRegistryShape<N, M>>(identifier)

/**
 * Create a Layer that provides a TokenRegistry.
 *
 * This is the primary factory for creating registries.
 *
 * @example
 * ```ts
 * const ScopeRegistry = TokenRegistry.makeTag<"scope">("ScopeRegistry")
 *
 * const ScopeRegistryLive = TokenRegistry.make(ScopeRegistry, {
 *   namespace: "scope",
 *   name: "Hotkey Scopes",
 *   allowRuntimeRegistration: true,
 *   allowOverwrite: false,
 *   builtins: [
 *     { id: "global", name: "Global" },
 *     { id: "editor", name: "Editor" },
 *   ],
 * })
 * ```
 */
export const make = <N extends string, M = unknown>(
  tag: Context.Tag<TokenRegistryShape<N, M>, TokenRegistryShape<N, M>>,
  config: TokenRegistryConfig<N, M>
): Layer.Layer<TokenRegistryShape<N, M>> =>
  Layer.effect(tag, makeImpl(config))

/**
 * Create a TokenRegistry directly (without Layer).
 *
 * Useful for testing or when you need immediate access.
 */
export const makeSync = <N extends string, M = unknown>(
  config: TokenRegistryConfig<N, M>
): Effect.Effect<TokenRegistryShape<N, M>> => makeImpl(config)
