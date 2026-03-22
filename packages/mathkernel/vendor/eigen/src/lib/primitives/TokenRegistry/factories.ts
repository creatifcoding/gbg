/**
 * TokenRegistry — Factory & Builder Patterns
 *
 * Follows Effect's dual() pattern for data-first/data-last flexibility.
 * Provides fluent builders for complex registry configurations.
 *
 * @module
 */

import { Effect, Layer, Context, pipe } from "effect"
import { dual } from "effect/Function"
import type {
  Token,
  TokenEntry,
  TokenRegistryConfig,
  TokenRegistration,
  TokenSource,
} from "./types"
import { type TokenRegistryShape, make, makeTag, makeSync } from "./TokenRegistry"

// ─────────────────────────────────────────────────────────────────────────────
// Builder Pattern
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mutable builder for constructing TokenRegistry configurations.
 * Fluent API that collects configuration, then finalizes with build().
 */
class RegistryBuilderImpl<N extends string, M = unknown> {
  private _namespace: N | undefined
  private _name: string | undefined
  private _allowRuntimeRegistration = false
  private _allowOverwrite = false
  private _defaultMetadata: M | undefined
  private _builtins: TokenRegistration<M>[] = []

  /** Set the namespace */
  namespace<NS extends string>(ns: NS): RegistryBuilderImpl<NS, M> {
    const self = this as unknown as RegistryBuilderImpl<NS, M>
    self._namespace = ns
    return self
  }

  /** Set the human-readable name */
  name(name: string): this {
    this._name = name
    return this
  }

  /** Enable runtime registration (default: false) */
  allowRuntimeRegistration(allow = true): this {
    this._allowRuntimeRegistration = allow
    return this
  }

  /** Enable overwriting existing tokens (default: false) */
  allowOverwrite(allow = true): this {
    this._allowOverwrite = allow
    return this
  }

  /** Set default metadata for tokens */
  defaultMetadata(meta: M): this {
    this._defaultMetadata = meta
    return this
  }

  /** Add a builtin token */
  builtin(id: string, name: string, metadata?: M, description?: string): this {
    this._builtins.push({
      id,
      name,
      description,
      metadata,
      source: "builtin",
    })
    return this
  }

  /** Add multiple builtin tokens */
  builtins(entries: ReadonlyArray<TokenRegistration<M>>): this {
    this._builtins.push(...entries)
    return this
  }

  /** Build the configuration */
  build(): TokenRegistryConfig<N, M> {
    if (!this._namespace) {
      throw new Error("TokenRegistry builder: namespace is required")
    }
    if (!this._name) {
      throw new Error("TokenRegistry builder: name is required")
    }
    return {
      namespace: this._namespace,
      name: this._name,
      allowRuntimeRegistration: this._allowRuntimeRegistration,
      allowOverwrite: this._allowOverwrite,
      defaultMetadata: this._defaultMetadata,
      builtins: this._builtins,
    }
  }
}

/**
 * Create a new registry builder.
 *
 * @example
 * ```ts
 * const config = TokenRegistry.builder<"scope">()
 *   .namespace("scope")
 *   .name("Hotkey Scopes")
 *   .allowRuntimeRegistration()
 *   .builtin("global", "Global")
 *   .builtin("editor", "Editor")
 *   .build()
 * ```
 */
export const builder = <N extends string = string, M = unknown>(): RegistryBuilderImpl<N, M> =>
  new RegistryBuilderImpl<N, M>()

// ─────────────────────────────────────────────────────────────────────────────
// Dual APIs (data-first / data-last)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a token in a registry.
 *
 * @example
 * ```ts
 * // Data-first
 * const token = yield* registerToken(registry, { id: "custom", name: "Custom" })
 *
 * // Data-last (pipeable)
 * const token = yield* pipe(
 *   { id: "custom", name: "Custom" },
 *   registerToken(registry)
 * )
 * ```
 */
export const registerToken: {
  // Data-first
  <N extends string, M>(
    registry: TokenRegistryShape<N, M>,
    registration: TokenRegistration<M>
  ): Effect.Effect<Token<N>, import("./types").TokenAlreadyExistsError | import("./types").RegistrationDisabledError>

  // Data-last
  <N extends string, M>(
    registry: TokenRegistryShape<N, M>
  ): (
    registration: TokenRegistration<M>
  ) => Effect.Effect<Token<N>, import("./types").TokenAlreadyExistsError | import("./types").RegistrationDisabledError>
} = dual(
  2,
  <N extends string, M>(
    registry: TokenRegistryShape<N, M>,
    registration: TokenRegistration<M>
  ) => registry.register(registration)
)

/**
 * Get a token from a registry.
 *
 * @example
 * ```ts
 * // Data-first
 * const token = yield* getToken(registry, "global")
 *
 * // Data-last (pipeable)
 * const token = yield* pipe("global", getToken(registry))
 * ```
 */
export const getToken: {
  <N extends string, M>(
    registry: TokenRegistryShape<N, M>,
    id: string
  ): Effect.Effect<Token<N>, import("./types").TokenNotFoundError>

  <N extends string, M>(
    registry: TokenRegistryShape<N, M>
  ): (id: string) => Effect.Effect<Token<N>, import("./types").TokenNotFoundError>
} = dual(
  2,
  <N extends string, M>(registry: TokenRegistryShape<N, M>, id: string) =>
    registry.get(id)
)

/**
 * Check if a token exists in a registry.
 *
 * @example
 * ```ts
 * const exists = yield* hasToken(registry, "global")
 * ```
 */
export const hasToken: {
  <N extends string, M>(
    registry: TokenRegistryShape<N, M>,
    id: string
  ): Effect.Effect<boolean>

  <N extends string, M>(
    registry: TokenRegistryShape<N, M>
  ): (id: string) => Effect.Effect<boolean>
} = dual(
  2,
  <N extends string, M>(registry: TokenRegistryShape<N, M>, id: string) =>
    registry.has(id)
)

/**
 * Remove a token from a registry.
 *
 * @example
 * ```ts
 * const removed = yield* removeToken(registry, "custom")
 * ```
 */
export const removeToken: {
  <N extends string, M>(
    registry: TokenRegistryShape<N, M>,
    id: string
  ): Effect.Effect<boolean>

  <N extends string, M>(
    registry: TokenRegistryShape<N, M>
  ): (id: string) => Effect.Effect<boolean>
} = dual(
  2,
  <N extends string, M>(registry: TokenRegistryShape<N, M>, id: string) =>
    registry.remove(id)
)

// ─────────────────────────────────────────────────────────────────────────────
// Convenience Factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quick factory for creating a complete registry setup.
 *
 * Returns { Tag, Live, config } for immediate use.
 *
 * @example
 * ```ts
 * const Scopes = TokenRegistry.create({
 *   identifier: "tmnl/ScopeRegistry",
 *   namespace: "scope",
 *   name: "Hotkey Scopes",
 *   allowRuntimeRegistration: true,
 *   builtins: [
 *     { id: "global", name: "Global" },
 *     { id: "editor", name: "Editor" },
 *   ],
 * })
 *
 * // Use in program
 * const program = Effect.gen(function* (_) {
 *   const registry = yield* _(Scopes.Tag)
 *   const token = yield* _(registry.get("global"))
 * }).pipe(Effect.provide(Scopes.Live))
 * ```
 */
export const create = <N extends string, M = unknown>(
  options: TokenRegistryConfig<N, M> & { identifier: string }
): {
  Tag: Context.Tag<TokenRegistryShape<N, M>, TokenRegistryShape<N, M>>
  Live: Layer.Layer<TokenRegistryShape<N, M>>
  config: TokenRegistryConfig<N, M>
} => {
  const { identifier, ...config } = options
  const Tag = makeTag<N, M>(identifier)
  const Live = make(Tag, config as TokenRegistryConfig<N, M>)

  return { Tag, Live, config: config as TokenRegistryConfig<N, M> }
}

/**
 * Create a registry with builder pattern.
 *
 * @example
 * ```ts
 * const Scopes = TokenRegistry.createWithBuilder<"scope">("tmnl/ScopeRegistry", (b) =>
 *   b.namespace("scope")
 *     .name("Hotkey Scopes")
 *     .allowRuntimeRegistration()
 *     .builtin("global", "Global")
 *     .builtin("editor", "Editor")
 * )
 * ```
 */
export const createWithBuilder = <N extends string, M = unknown>(
  identifier: string,
  configure: (builder: RegistryBuilderImpl<string, M>) => RegistryBuilderImpl<N, M>
): {
  Tag: Context.Tag<TokenRegistryShape<N, M>, TokenRegistryShape<N, M>>
  Live: Layer.Layer<TokenRegistryShape<N, M>>
  config: TokenRegistryConfig<N, M>
} => {
  const config = configure(builder<string, M>()).build()
  return create({ ...config, identifier })
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Integration Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all token IDs from a registry as an array.
 *
 * Useful for creating Schema.Literal or validation.
 *
 * @example
 * ```ts
 * const scopeIds = yield* TokenRegistry.toLiteralValues(scopeRegistry)
 * // ["global", "editor", "grid", ...]
 * ```
 */
export const toLiteralValues = <N extends string, M>(
  registry: TokenRegistryShape<N, M>
): Effect.Effect<readonly string[]> =>
  pipe(
    registry.all(),
    Effect.map((tokens) => tokens as readonly string[])
  )

/**
 * Validate that a string is a valid token in a registry.
 *
 * @example
 * ```ts
 * const validated = yield* validateToken(registry, userInput)
 * ```
 */
export const validateToken: {
  <N extends string, M>(
    registry: TokenRegistryShape<N, M>,
    id: string
  ): Effect.Effect<Token<N>, import("./types").TokenNotFoundError>

  <N extends string, M>(
    registry: TokenRegistryShape<N, M>
  ): (id: string) => Effect.Effect<Token<N>, import("./types").TokenNotFoundError>
} = dual(
  2,
  <N extends string, M>(registry: TokenRegistryShape<N, M>, id: string) =>
    registry.get(id)
)
