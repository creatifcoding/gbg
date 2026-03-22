/**
 * TokenRegistry — Public Exports
 *
 * Effect-native branded registry with runtime validation.
 * Create type-safe, runtime-validated tokens that can only be obtained
 * through registration.
 *
 * @example
 * ```ts
 * import { TokenRegistry } from "@/lib/primitives/TokenRegistry"
 *
 * // Quick setup
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
 * // Use in Effect
 * const program = Effect.gen(function* () {
 *   const registry = yield* Scopes.Tag
 *
 *   // Get validated token (proof of membership)
 *   const globalScope = yield* registry.get("global")
 *
 *   // Register new token at runtime
 *   const customScope = yield* registry.register({
 *     id: "custom",
 *     name: "Custom Scope",
 *   })
 * }).pipe(Effect.provide(Scopes.Live))
 * ```
 *
 * @example Builder Pattern
 * ```ts
 * const Scopes = TokenRegistry.createWithBuilder<"scope">("tmnl/ScopeRegistry", (b) =>
 *   b.namespace("scope")
 *     .name("Hotkey Scopes")
 *     .allowRuntimeRegistration()
 *     .builtin("global", "Global")
 *     .builtin("editor", "Editor")
 *     .builtin("grid", "Grid")
 * )
 * ```
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  Token,
  TokenEntry,
  TokenRegistryConfig,
  TokenRegistration,
  TokenSource,
  TokenRegistryEvent,
} from "./types"

export {
  TokenSchema,
  TokenNotFoundError,
  TokenAlreadyExistsError,
  RegistrationDisabledError,
  type TokenRegistryError,
} from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

export type { TokenRegistryShape } from "./TokenRegistry"
export { make, makeTag, makeSync } from "./TokenRegistry"

// ─────────────────────────────────────────────────────────────────────────────
// Factories & Builders
// ─────────────────────────────────────────────────────────────────────────────

export {
  builder,
  create,
  createWithBuilder,
  // Dual APIs
  registerToken,
  getToken,
  hasToken,
  removeToken,
  validateToken,
  // Schema helpers
  toLiteralValues,
} from "./factories"

// ─────────────────────────────────────────────────────────────────────────────
// Namespace Export (for `TokenRegistry.create(...)` style)
// ─────────────────────────────────────────────────────────────────────────────

import { make, makeTag, makeSync } from "./TokenRegistry"
import {
  builder,
  create,
  createWithBuilder,
  registerToken,
  getToken,
  hasToken,
  removeToken,
  validateToken,
  toLiteralValues,
} from "./factories"
import {
  TokenSchema,
  TokenNotFoundError,
  TokenAlreadyExistsError,
  RegistrationDisabledError,
} from "./types"

/**
 * TokenRegistry namespace for fluent API access.
 *
 * @example
 * ```ts
 * const Scopes = TokenRegistry.create({ ... })
 * const config = TokenRegistry.builder<"scope">().namespace("scope").name("Scopes").build()
 * ```
 */
export const TokenRegistry = {
  // Service creation
  make,
  makeTag,
  makeSync,

  // Factories
  builder,
  create,
  createWithBuilder,

  // Dual APIs
  registerToken,
  getToken,
  hasToken,
  removeToken,
  validateToken,

  // Schema helpers
  toLiteralValues,
  TokenSchema,

  // Errors
  TokenNotFoundError,
  TokenAlreadyExistsError,
  RegistrationDisabledError,
} as const
