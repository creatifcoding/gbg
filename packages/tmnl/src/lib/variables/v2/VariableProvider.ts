/**
 * TMNL Variables v2 — VariableProvider Module
 *
 * Public API for creating and combining variable providers.
 * Analogous to Effect's ConfigProvider module.
 *
 * @example
 * ```typescript
 * import { VariableProvider } from '@/lib/variables/v2'
 *
 * // Create providers for each scope
 * const defaults = VariableProvider.fromDefaults()
 * const user = VariableProvider.fromObject(userConfig, { name: 'user' })
 *
 * // Combine with fallback (user → defaults)
 * const combined = VariableProvider.orElse(user, () => defaults)
 *
 * // Use defuFn for computed defaults
 * const withComputed = VariableProvider.fromObjectWithDefuFn(
 *   {
 *     'editor.fontSize': 16,
 *     'editor.lineHeight': (fontSize) => fontSize * 1.5,
 *   },
 *   defaults
 * )
 * ```
 */

import * as internal from './internal/core'

// ─────────────────────────────────────────────────────────────────────────────
// Re-exports
// ─────────────────────────────────────────────────────────────────────────────

export {
  /** VariableProvider TypeId symbol */
  VariableProviderTypeId,
  /** VariableProvider type */
  type VariableProvider,
} from './internal/core'

// ─────────────────────────────────────────────────────────────────────────────
// Constructors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a VariableProvider from a Map.
 * Values are validated against variable schemas at load time.
 *
 * @example
 * ```typescript
 * const provider = VariableProvider.fromMap(new Map([
 *   ['editor.tabWidth', 2],
 *   ['editor.fontSize', 16],
 * ]))
 * ```
 */
export const fromMap = internal.fromMap

/**
 * Create a VariableProvider from a plain object.
 * Supports nested keys via dot notation.
 *
 * @example
 * ```typescript
 * const provider = VariableProvider.fromObject({
 *   editor: {
 *     tabWidth: 2,
 *     fontSize: 16,
 *   },
 * })
 * // Equivalent to 'editor.tabWidth' and 'editor.fontSize'
 * ```
 */
export const fromObject = internal.fromObject

/**
 * Create a VariableProvider that returns default values.
 * This is typically the "bottom" of the scope chain.
 *
 * @example
 * ```typescript
 * const defaults = VariableProvider.fromDefaults()
 * ```
 */
export const fromDefaults = internal.fromDefaults

/**
 * Create a VariableProvider with defuFn semantics.
 * Functions in the object are called with values from the fallback provider.
 *
 * This is the KEY feature for computed defaults:
 *
 * @example
 * ```typescript
 * const provider = VariableProvider.fromObjectWithDefuFn(
 *   {
 *     'editor.fontSize': 16,
 *     // Computed: lineHeight is 1.5x fontSize from lower scope
 *     'editor.lineHeight': (lower) => lower * 1.5,
 *   },
 *   fallbackProvider
 * )
 * ```
 */
export const fromObjectWithDefuFn = internal.fromObjectWithDefuFn

/**
 * Create a custom VariableProvider.
 *
 * @example
 * ```typescript
 * const provider = VariableProvider.make({
 *   load: (def) => Effect.gen(function* () {
 *     // Custom loading logic
 *   }),
 *   enumerate: () => Effect.succeed(['var1', 'var2']),
 * })
 * ```
 */
export const make = internal.makeProvider

// ─────────────────────────────────────────────────────────────────────────────
// Combinators
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Combine two providers with fallback.
 * If `self` fails with missing data, try `that`.
 *
 * This is the KEY combinator for hierarchical scope resolution:
 *
 * @example
 * ```typescript
 * // editor → workspace → user → defaults
 * const scopeChain = VariableProvider.orElse(
 *   editorProvider,
 *   () => VariableProvider.orElse(
 *     workspaceProvider,
 *     () => VariableProvider.orElse(
 *       userProvider,
 *       () => defaultProvider
 *     )
 *   )
 * )
 * ```
 */
export const orElse = internal.orElse

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load a variable with Option-based return.
 * Returns Option.none() if not found.
 */
export const loadOption = internal.loadOption

/**
 * Load a variable by string ID.
 * Returns Option.none() if not found.
 */
export const loadById = internal.loadById

/**
 * Load a variable by string ID with type assertion.
 * Returns Option.none() if not found or wrong type.
 */
export const loadByIdAs = internal.loadByIdAs
