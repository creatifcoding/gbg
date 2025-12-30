/**
 * @file Fermion Builder API
 * @module @tmnl/fermion/Fermion
 *
 * Fluent builder for creating schema-driven Atom.family instances.
 *
 * @example
 * ```ts
 * import { Schema, Effect, Duration } from "effect"
 * import { Fermion } from "@/lib/fermion"
 *
 * const UserSchema = Schema.Struct({
 *   id: Schema.String.pipe(Schema.brand("UserId")),
 *   name: Schema.NonEmptyString,
 *   email: Schema.String,
 * })
 *
 * const userFamily = Fermion.fromSchema(UserSchema)
 *   .withKey("id")
 *   .withFetch((id) =>
 *     Effect.tryPromise(() => fetch(`/api/users/${id}`).then(r => r.json()))
 *   )
 *   .withTTL(Duration.minutes(5))
 *   .build()
 *
 * // Usage
 * const userAtom = userFamily("user-123")  // Atom<Result<User, E>>
 * await userFamily.fetch("user-123")       // Effect<User, E, R>
 * ```
 */

import { Schema, Effect, Layer, Duration, Context } from "effect"
import type { Fermion, FermionConfig, KeyOf, KeyType, CompositeKeyType, LifecycleConfig } from "./types"
import type { FermionAlgebra } from "./algebra"
import { makeFamily } from "./internal/family"

// ============================================================================
// Builder Implementation
// ============================================================================

/**
 * Fluent builder for creating Fermion families
 *
 * Type parameters track accumulated state through the builder chain:
 * - A: Entity type (decoded)
 * - I: Encoded type (for serialization)
 * - E: Error type (accumulates via withFetch, etc.)
 * - R: Required services (accumulates)
 * - L: Provided layers (accumulates via provideLayer)
 * - K: Key type (set via withKey/withCompositeKey)
 */
class FermionBuilder<
  A,
  I,
  E = never,
  R = never,
  L = never,
  K = never
> {
  constructor(
    private readonly schema: Schema.Schema<A, I>,
    private readonly config: {
      key?: string | readonly string[]
      algebra?: Partial<FermionAlgebra<A, E, R, K>>
      lifecycle?: LifecycleConfig
      reactivityKeys?: (key: K, value: A) => readonly unknown[]
    } = {},
    private readonly layers: Layer.Layer<any, any, any>[] = []
  ) {}

  // ==========================================================================
  // Key Configuration
  // ==========================================================================

  /**
   * Set the primary key field for entity identification
   *
   * @example
   * ```ts
   * Fermion.fromSchema(UserSchema).withKey("id")
   * // Key type inferred as: Schema.Type<UserSchema>["id"]
   * ```
   */
  withKey<KF extends string & KeyOf<Schema.Schema<A, I>>>(
    key: KF
  ): FermionBuilder<A, I, E, R, L, KeyType<Schema.Schema<A, I>, KF>> {
    return new FermionBuilder(
      this.schema,
      { ...this.config, key } as any,
      this.layers
    ) as any
  }

  /**
   * Set composite key fields for multi-field identification
   *
   * @example
   * ```ts
   * Fermion.fromSchema(OrderSchema).withCompositeKey(["userId", "orderId"])
   * // Key type: { readonly userId: string; readonly orderId: string }
   * ```
   */
  withCompositeKey<KF extends readonly (string & KeyOf<Schema.Schema<A, I>>)[]>(
    keys: KF
  ): FermionBuilder<A, I, E, R, L, CompositeKeyType<Schema.Schema<A, I>, KF>> {
    return new FermionBuilder(
      this.schema,
      { ...this.config, key: keys } as any,
      this.layers
    ) as any
  }

  // ==========================================================================
  // Operations (Accumulate R and E)
  // ==========================================================================

  /**
   * Define the fetch operation (required)
   *
   * @example
   * ```ts
   * .withFetch((id) =>
   *   Effect.tryPromise(() => fetch(`/api/users/${id}`).then(r => r.json()))
   * )
   * ```
   */
  withFetch<E2, R2>(
    fetch: (key: K) => Effect.Effect<A, E2, R2>
  ): FermionBuilder<A, I, E | E2, R | R2, L, K> {
    const algebra = { ...this.config.algebra, fetch } as Partial<FermionAlgebra<A, E | E2, R | R2, K>>
    return new FermionBuilder(
      this.schema,
      { ...this.config, algebra } as any,
      this.layers
    ) as any
  }

  /**
   * Define the persist operation (optional)
   *
   * @example
   * ```ts
   * .withPersist((user) =>
   *   Effect.tryPromise(() =>
   *     fetch(`/api/users/${user.id}`, { method: "PUT", body: JSON.stringify(user) })
   *   )
   * )
   * ```
   */
  withPersist<E2, R2>(
    persist: (value: A) => Effect.Effect<void, E2, R2>
  ): FermionBuilder<A, I, E | E2, R | R2, L, K> {
    const algebra = { ...this.config.algebra, persist } as Partial<FermionAlgebra<A, E | E2, R | R2, K>>
    return new FermionBuilder(
      this.schema,
      { ...this.config, algebra } as any,
      this.layers
    ) as any
  }

  /**
   * Define the remove operation (optional)
   *
   * @example
   * ```ts
   * .withRemove((id) =>
   *   Effect.tryPromise(() => fetch(`/api/users/${id}`, { method: "DELETE" }))
   * )
   * ```
   */
  withRemove<E2, R2>(
    remove: (key: K) => Effect.Effect<void, E2, R2>
  ): FermionBuilder<A, I, E | E2, R | R2, L, K> {
    const algebra = { ...this.config.algebra, remove } as Partial<FermionAlgebra<A, E | E2, R | R2, K>>
    return new FermionBuilder(
      this.schema,
      { ...this.config, algebra } as any,
      this.layers
    ) as any
  }

  // ==========================================================================
  // Lifecycle Hooks
  // ==========================================================================

  /**
   * Add a beforeFetch hook
   */
  withBeforeFetch<E2, R2>(
    hook: (key: K) => Effect.Effect<void, E2, R2>
  ): FermionBuilder<A, I, E | E2, R | R2, L, K> {
    const algebra = { ...this.config.algebra, beforeFetch: hook } as Partial<FermionAlgebra<A, E | E2, R | R2, K>>
    return new FermionBuilder(
      this.schema,
      { ...this.config, algebra } as any,
      this.layers
    ) as any
  }

  /**
   * Add an afterFetch hook (can transform the fetched value)
   */
  withAfterFetch<E2, R2>(
    hook: (key: K, value: A) => Effect.Effect<A, E2, R2>
  ): FermionBuilder<A, I, E | E2, R | R2, L, K> {
    const algebra = { ...this.config.algebra, afterFetch: hook } as Partial<FermionAlgebra<A, E | E2, R | R2, K>>
    return new FermionBuilder(
      this.schema,
      { ...this.config, algebra } as any,
      this.layers
    ) as any
  }

  // ==========================================================================
  // Service/Layer Provision
  // ==========================================================================

  /**
   * Provide a Layer that satisfies part of R
   *
   * @example
   * ```ts
   * .provideLayer(HttpClient.layer)
   * .provideLayer(UserCacheLive)
   * ```
   */
  provideLayer<RIn, EL, ROut>(
    layer: Layer.Layer<ROut, EL, RIn>
  ): FermionBuilder<A, I, E | EL, Exclude<R, ROut> | RIn, L | ROut, K> {
    return new FermionBuilder(
      this.schema,
      this.config as any,
      [...this.layers, layer]
    ) as any
  }

  /**
   * Provide a service implementation directly
   *
   * @example
   * ```ts
   * .provideService(UserCache, { get: ..., set: ... })
   * ```
   */
  provideService<S, SI>(
    tag: Context.Tag<S, SI>,
    impl: SI
  ): FermionBuilder<A, I, E, Exclude<R, S>, L | S, K> {
    return new FermionBuilder(
      this.schema,
      this.config as any,
      [...this.layers, Layer.succeed(tag, impl)]
    ) as any
  }

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Configure atom lifecycle behavior
   *
   * Controls how atoms behave when subscribers come and go.
   *
   * @example
   * ```ts
   * // Entity cache - persist indefinitely (default)
   * .withLifecycle({ keepAlive: true })
   *
   * // Transient data - reset when no subscribers
   * .withLifecycle({ keepAlive: false })
   *
   * // Time-limited cache - persist for 5 minutes idle
   * .withLifecycle({ keepAlive: true, ttl: Duration.minutes(5) })
   * ```
   */
  withLifecycle(lifecycle: LifecycleConfig): FermionBuilder<A, I, E, R, L, K> {
    return new FermionBuilder(
      this.schema,
      { ...this.config, lifecycle },
      this.layers
    )
  }

  /**
   * Convenience method for setting TTL with implicit keepAlive
   *
   * Equivalent to `.withLifecycle({ keepAlive: true, ttl })`
   *
   * @example
   * ```ts
   * .withTTL(Duration.minutes(5))
   * ```
   */
  withTTL(ttl: Duration.Duration): FermionBuilder<A, I, E, R, L, K> {
    return new FermionBuilder(
      this.schema,
      { ...this.config, lifecycle: { ...this.config.lifecycle, keepAlive: true, ttl } },
      this.layers
    )
  }

  /**
   * Define additional reactivity keys for fine-grained subscriptions
   *
   * @example
   * ```ts
   * .withReactivity((key, user) => [user.email, user.role])
   * ```
   */
  withReactivity(
    fn: (key: K, value: A) => readonly unknown[]
  ): FermionBuilder<A, I, E, R, L, K> {
    return new FermionBuilder(
      this.schema,
      { ...this.config, reactivityKeys: fn },
      this.layers
    )
  }

  // ==========================================================================
  // Build Methods
  // ==========================================================================

  /**
   * Build the Fermion family (all dependencies must be satisfied)
   *
   * This method requires that R is `never` - all service dependencies
   * must be provided via provideLayer/provideService.
   *
   * @example
   * ```ts
   * const userFamily = Fermion.fromSchema(UserSchema)
   *   .withKey("id")
   *   .withFetch(...)
   *   .provideLayer(HttpClient.layer)
   *   .build()  // ✓ Type-safe if all deps satisfied
   * ```
   */
  build(
    this: FermionBuilder<A, I, E, never, L, K>
  ): Fermion<A, I, E, never, K> {
    if (!this.config.algebra?.fetch) {
      throw new Error("Fermion requires a fetch operation. Use .withFetch() before .build()")
    }
    if (!this.config.key) {
      throw new Error("Fermion requires a key field. Use .withKey() or .withCompositeKey() before .build()")
    }

    const mergedLayer = this.layers.length > 0
      ? Layer.mergeAll(...(this.layers as [Layer.Layer<any, any, any>, ...Layer.Layer<any, any, any>[]]))
      : undefined

    return makeFamily(
      this.schema,
      this.config as FermionConfig<A, I, E, never, K>,
      mergedLayer
    )
  }

  /**
   * Build with remaining service requirements
   *
   * Use when layers will be provided at runtime via Atom.runtime.
   *
   * @example
   * ```ts
   * const userFamily = Fermion.fromSchema(UserSchema)
   *   .withKey("id")
   *   .withFetch((id) => Effect.flatMap(UserApi, api => api.fetch(id)))
   *   .buildWithDeps()  // R = UserApi
   *
   * // Provide at runtime
   * const runtimeAtom = Atom.runtime(UserApiLive)
   * ```
   */
  buildWithDeps(): Fermion<A, I, E, R, K> {
    if (!this.config.algebra?.fetch) {
      throw new Error("Fermion requires a fetch operation. Use .withFetch() before .buildWithDeps()")
    }
    if (!this.config.key) {
      throw new Error("Fermion requires a key field. Use .withKey() or .withCompositeKey() before .buildWithDeps()")
    }

    const mergedLayer = this.layers.length > 0
      ? Layer.mergeAll(...(this.layers as [Layer.Layer<any, any, any>, ...Layer.Layer<any, any, any>[]]))
      : undefined

    return makeFamily(
      this.schema,
      this.config as FermionConfig<A, I, E, R, K>,
      mergedLayer
    )
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a Fermion builder from an Effect Schema
 *
 * @example
 * ```ts
 * const userFamily = Fermion.fromSchema(UserSchema)
 *   .withKey("id")
 *   .withFetch(fetchUser)
 *   .build()
 * ```
 */
export const fromSchema = <A, I, R>(
  schema: Schema.Schema<A, I, R>
): FermionBuilder<A, I, never, never, never, never> => {
  return new FermionBuilder(schema as Schema.Schema<A, I>)
}

/**
 * Create a Fermion directly from configuration
 *
 * @example
 * ```ts
 * const userFamily = Fermion.make({
 *   schema: UserSchema,
 *   key: "id",
 *   algebra: { fetch: fetchUser },
 *   ttl: Duration.minutes(5),
 * })
 * ```
 */
export const make = <A, I, E, R, K>(
  config: FermionConfig<A, I, E, R, K>
): Fermion<A, I, E, R, K> => {
  return makeFamily(config.schema, config)
}

// Re-export the builder class for advanced usage
export { FermionBuilder }
