/**
 * @tmnl/stx — Async / Streaming integration
 *
 * Bridges Effect v4's Atom.make(Effect|Stream) → AsyncResult pattern
 * with STX's autoLens + focus atoms.
 *
 * Key v4 overloads used:
 *   Atom.make(effect)  → Atom<AsyncResult<A, E>>
 *   Atom.make(stream)  → Atom<AsyncResult<A, E>>
 *   Atom.pull(stream)  → Writable<PullResult<A, E>, void>
 *
 * STX adds:
 *   - autoLens on the SUCCESS value (not the AsyncResult wrapper)
 *   - Focus atoms that skip Initial/Waiting transitions
 *   - Type-safe unwrap helpers
 *
 * @module
 * @internal
 */

import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Option from "effect/Option"
import * as Cause from "effect/Cause"
import type * as Effect from "effect/Effect"
import type * as Stream from "effect/Stream"
import { autoLens, type AutoLens } from "./auto-lens.js"
import { createFocusAtom } from "./focus.js"

// ─── Types ──────────────────────────────────────────

/**
 * An async STX instance wrapping Atom<AsyncResult<A, E>>.
 * autoLens operates on the SUCCESS value type A.
 */
export interface StxAsync<A, E = never> {
  /** Raw atom — Atom<AsyncResult<A, E>> */
  readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>

  /** AutoLens on the success value type A */
  readonly lens: AutoLens<A>

  /** Registry powering this instance */
  readonly registry: AtomRegistry.AtomRegistry

  /**
   * Create a focus atom that:
   * 1. Unwraps AsyncResult to get the success value
   * 2. Applies the lens to extract the focused field
   * 3. Only notifies when that field's VALUE changes
   *
   * Returns undefined for Initial/Waiting/Failure states.
   */
  readonly focus: <B>(lens: { get: (s: A) => B; _optic: object }) => Atom.Atom<B | undefined>

  /**
   * Derived atom: just the success value (or undefined).
   * Skips AsyncResult wrapper noise.
   */
  readonly value: Atom.Atom<A | undefined>

  /**
   * Derived atom: loading state.
   * true during Initial(waiting) or any Success/Failure with waiting=true.
   */
  readonly loading: Atom.Atom<boolean>

  /**
   * Derived atom: error (or undefined).
   */
  readonly error: Atom.Atom<E | undefined>

  /**
   * Get current AsyncResult snapshot.
   */
  readonly getResult: () => AsyncResult.AsyncResult<A, E>

  /**
   * Get current success value (or undefined).
   */
  readonly get: () => A | undefined

  /**
   * Refresh/re-run the effect or stream.
   */
  readonly refresh: () => void
}

/**
 * A pull-based streaming STX instance.
 * Writable<PullResult<A, E>, void> — write void to pull next chunk.
 */
export interface StxPull<A, E = never> {
  /** Raw pull atom — write void to trigger next pull */
  readonly atom: Atom.Writable<Atom.PullResult<A, E>, void>

  /** Registry */
  readonly registry: AtomRegistry.AtomRegistry

  /** Trigger next pull */
  readonly pull: () => void

  /** Derived atom: accumulated items (or empty array) */
  readonly items: Atom.Atom<ReadonlyArray<A>>

  /** Derived atom: done flag */
  readonly done: Atom.Atom<boolean>

  /** Derived atom: loading */
  readonly loading: Atom.Atom<boolean>

  /** Derived atom: error */
  readonly error: Atom.Atom<E | undefined>
}

// ─── Helpers (canonical v4 AsyncResult accessors) ───

/** Extract success value → A | undefined */
function unwrapValue<A, E>(result: AsyncResult.AsyncResult<A, E>): A | undefined {
  return Option.getOrUndefined(AsyncResult.value(result))
}

/** Extract waiting / initial state */
function unwrapWaiting<A, E>(result: AsyncResult.AsyncResult<A, E>): boolean {
  return AsyncResult.isWaiting(result) || AsyncResult.isInitial(result)
}

/** Extract typed error → E | undefined */
function unwrapError<A, E>(result: AsyncResult.AsyncResult<A, E>): E | undefined {
  return Option.getOrUndefined(AsyncResult.error(result))
}

// ─── Factories ──────────────────────────────────────

/**
 * Create an async STX instance from an Effect.
 *
 * The Effect runs once and the result becomes an Atom<AsyncResult<A, E>>.
 * autoLens and focus operate on the SUCCESS value.
 *
 * @example
 * ```ts
 * const users = fromEffect(
 *   Effect.tryPromise(() => fetch("/api/users").then(r => r.json())),
 *   registry
 * )
 * const nameAtom = users.focus(users.lens.name) // only fires on name change
 * ```
 */
export function fromEffect<A, E>(
  effect: Effect.Effect<A, E, any> | ((get: Atom.FnContext) => Effect.Effect<A, E, any>),
  registry: AtomRegistry.AtomRegistry,
  options?: { readonly initialValue?: A },
): StxAsync<A, E> {
  const atom = Atom.make(effect as any, options) as Atom.Atom<AsyncResult.AsyncResult<A, E>>
  return makeStxAsync(atom, registry)
}

/**
 * Create an async STX instance from a Stream.
 *
 * The atom tracks the LATEST emitted value.
 * Each emission updates the AsyncResult to Success(latestValue).
 *
 * @example
 * ```ts
 * const prices = fromStream(
 *   Stream.fromAsyncIterable(websocket, identity),
 *   registry
 * )
 * const priceAtom = prices.focus(prices.lens.bid)
 * ```
 */
export function fromStream<A, E>(
  stream: Stream.Stream<A, E, any> | ((get: Atom.FnContext) => Stream.Stream<A, E, any>),
  registry: AtomRegistry.AtomRegistry,
  options?: { readonly initialValue?: A },
): StxAsync<A, E> {
  const atom = Atom.make(stream as any, options) as Atom.Atom<AsyncResult.AsyncResult<A, E>>
  return makeStxAsync(atom, registry)
}

/**
 * Create a pull-based streaming STX instance.
 *
 * Items accumulate by default. Write void to pull next chunk.
 *
 * @example
 * ```ts
 * const feed = fromPull(
 *   Stream.fromIterable(allItems).pipe(Stream.grouped(10)),
 *   registry
 * )
 * feed.pull() // load next 10
 * const items = registry.get(feed.items) // accumulated items
 * ```
 */
export function fromPull<A, E>(
  stream: Stream.Stream<A, E, any> | ((get: Atom.FnContext) => Stream.Stream<A, E, any>),
  registry: AtomRegistry.AtomRegistry,
  options?: { readonly disableAccumulation?: boolean },
): StxPull<A, E> {
  const atom = Atom.pull(stream as any, options)
  registry.mount(atom)

  // PullResult<A, E> = AsyncResult<{ done: boolean; items: [A, ...A[]] }, E>
  type PullPayload = { readonly done: boolean; readonly items: ReadonlyArray<A> }

  const pullValue = (get: Atom.FnContext): PullPayload | undefined =>
    Option.getOrUndefined(AsyncResult.value(get(atom) as AsyncResult.AsyncResult<PullPayload, E>))

  const items = Atom.make((get: Atom.FnContext): ReadonlyArray<A> =>
    pullValue(get)?.items ?? []
  )

  const done = Atom.make((get: Atom.FnContext): boolean =>
    pullValue(get)?.done ?? false
  )

  const loading = Atom.make((get: Atom.FnContext): boolean =>
    unwrapWaiting(get(atom) as AsyncResult.AsyncResult<PullPayload, E>)
  )

  const error = Atom.make((get: Atom.FnContext): E | undefined =>
    unwrapError(get(atom) as AsyncResult.AsyncResult<PullPayload, E>)
  )

  registry.mount(items)
  registry.mount(done)
  registry.mount(loading)
  registry.mount(error)

  return {
    atom,
    registry,
    pull: () => registry.set(atom, undefined),
    items,
    done,
    loading,
    error,
  } as unknown as StxPull<A, E>
}

// ─── Internal builder ───────────────────────────────

function makeStxAsync<A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  registry: AtomRegistry.AtomRegistry,
): StxAsync<A, E> {
  registry.mount(atom)

  const lens = autoLens<A>()

  // Derived atoms — canonical v4 AsyncResult accessors
  const value = Atom.make((get: Atom.FnContext): A | undefined => unwrapValue(get(atom)))
  const loading = Atom.make((get: Atom.FnContext): boolean => unwrapWaiting(get(atom)))
  const error = Atom.make((get: Atom.FnContext): E | undefined => unwrapError(get(atom)))

  registry.mount(value)
  registry.mount(loading)
  registry.mount(error)

  // Focus factory: unwrap AsyncResult → apply lens → memoize
  const focusCache = new WeakMap<object, Atom.Atom<any>>()

  const focus = <B>(l: { get: (s: A) => B; _optic: object }): Atom.Atom<B | undefined> => {
    const rawOptic = l._optic
    const existing = focusCache.get(rawOptic)
    if (existing) return existing

    const focusAtom = Atom.make<B | undefined>((get) => {
      const v = unwrapValue(get(atom))
      return v !== undefined ? l.get(v) : undefined
    })
    registry.mount(focusAtom)
    focusCache.set(rawOptic, focusAtom)
    return focusAtom
  }

  return {
    atom,
    lens,
    registry,
    focus,
    value,
    loading,
    error,
    getResult: () => registry.get(atom),
    get: () => unwrapValue(registry.get(atom)),
    refresh: () => {
      // Trigger re-evaluation by refreshing the atom
      // This works because the atom's read function re-runs
      ;(atom as any).refresh?.(atom)
    },
  }
}
