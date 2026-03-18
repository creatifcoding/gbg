/**
 * @tmnl/stx — autoLens: Proxy-based optic tree
 *
 * `autoLens<S>()` returns a Proxy that lazily composes Optic.id<S>().key(prop)
 * for each property access. The result IS an optic AND a nested accessor.
 *
 * Class-aware: replace/modify operations use the class-patch module to
 * preserve class prototypes while maintaining Optic's structural sharing.
 *
 * Memoized: each unique path through the tree is computed once and cached.
 *
 * @example
 * ```ts
 * type S = { user: { name: string; level: number }; items: Item[] }
 * const lens = autoLens<S>()
 *
 * // Access builds the optic chain lazily
 * lens.user.name           // Optic.id<S>().key("user").key("name")
 * lens.user.name.get(s)    // "Alice"
 * lens.user.name.replace("Bob", s) // new S with name changed (class-aware)
 *
 * // Same path → same proxy instance (memoized)
 * lens.user.name === lens.user.name  // true
 * ```
 *
 * @module
 * @internal
 */

import { Optic } from "effect-v4"
import { classAwareReplace, classAwareModify } from "./class-patch.js"

// ─── Sentinel for forwarded optic methods ───────────

const FORWARD_METHODS = new Set(["get", "getResult", "getAll"])

// ─── Factory ────────────────────────────────────────

/**
 * Create a class-aware autoLens Proxy tree rooted at `Optic.id<S>()`.
 *
 * @typeParam S - Root state type
 * @param optic - Starting optic (default: Optic.id<S>())
 * @returns Proxy that chains .key() on property access, with class-aware replace/modify
 */
export function autoLens<S>(optic?: any): AutoLens<S> {
  const root = optic ?? Optic.id<S>()
  const cache = new Map<string | symbol, any>()

  return new Proxy(root, {
    get(target: any, prop: string | symbol) {
      // Symbols pass through (for React devtools, iterators, etc.)
      if (typeof prop === "symbol") return target[prop]

      // Forward read-only optic methods directly
      if (FORWARD_METHODS.has(prop)) return target[prop].bind(target)

      // Escape hatch: access raw optic
      if (prop === "_optic") return target

      // Class-aware replace
      if (prop === "replace") {
        return (value: any, state: any) => classAwareReplace(target, value, state)
      }

      // Class-aware modify
      if (prop === "modify") {
        return (fn: any) => (state: any) => classAwareModify(target, fn, state)
      }

      // Memoized child lens
      if (!cache.has(prop)) {
        cache.set(prop, autoLens(target.key(String(prop))))
      }
      return cache.get(prop)
    },
  }) as any
}

// ─── Types ──────────────────────────────────────────

/**
 * AutoLens type: each property access returns a nested AutoLens,
 * while also exposing optic methods (get, replace, modify).
 *
 * This is intentionally loose (`any` at boundaries) because the Proxy
 * is doing things TypeScript's type system can't express:
 * an object that IS both an optic and a recursive property accessor.
 *
 * Type safety comes from the consumer side (stx factory, focus atoms).
 */
export type AutoLens<S> = {
  /** Get value from state */
  get: (state: S) => any
  /** Get Result<value, error> from state */
  getResult: (state: S) => any
  /** Get all matching values */
  getAll: (state: S) => any[]
  /** Replace value (class-aware) */
  replace: (value: any, state: S) => S
  /** Modify value with function (class-aware) */
  modify: (fn: (a: any) => any) => (state: S) => S
  /** Access raw optic */
  _optic: any
} & {
  /** Property access returns nested AutoLens */
  [K in keyof S]-?: AutoLens<S[K]>
}
