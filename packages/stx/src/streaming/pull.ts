/**
 * @tmnl/stx — stx.pull() v2
 *
 * Manual pull-based streaming with accumulation modes and cursor.
 * Extends the existing fromPull() with:
 *   - "append" mode (default): accumulate across pulls
 *   - "replace" mode: each pull replaces previous items
 *   - cursor atom: tracks pull count
 *   - reset(): clear items + cursor, allow restart
 *
 * Built on Atom.pull() from effect (which wraps Stream.toPull internally).
 *
 * Use for: pagination, infinite scroll, lazy load on demand.
 *
 * @module
 */

import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Option from "effect/Option"
import type * as Stream from "effect/Stream"
import type { PullConfig, StxPullV2 } from "./types.js"

// ─── stx.pull ────────────────────────────────────────────────────────────────

/**
 * Create a pull-based materializer from a stream.
 *
 * @example
 * ```ts
 * const paginated = stxPull(
 *   Stream.paginate(0, cursor => fetchPage(cursor)),
 *   { mode: "append", trackCursor: true },
 *   registry
 * )
 * paginated.pull() // load next page
 * const items = registry.get(paginated.items)
 * const page  = registry.get(paginated.cursor)
 * ```
 */
export function stxPull<A, E = never>(
  source: Stream.Stream<A, E, never>,
  config: PullConfig = {},
  registry: AtomRegistry.AtomRegistry,
): StxPullV2<A, E> {
  const mode = config.mode ?? "append"

  // ── Core pull atom (Atom.pull wraps Stream.toPull) ──────────────────────────
  type PullPayload = { readonly done: boolean; readonly items: ReadonlyArray<A> }
  const pullAtom = Atom.pull(source as any)
  registry.mount(pullAtom)

  // ── Accumulated items + cursor ──────────────────────────────────────────────
  const itemsAtom  = Atom.make<ReadonlyArray<A>>([])
  const cursorAtom = Atom.make<number>(0)
  registry.mount(itemsAtom)
  registry.mount(cursorAtom)

  // ── Derived: loading, done, error ───────────────────────────────────────────
  // Read payload from registry directly (not inside a reactive get context)
  const readPayload = (): PullPayload | undefined => {
    const result = registry.get(pullAtom) as AsyncResult.AsyncResult<PullPayload, E>
    return Option.getOrUndefined(AsyncResult.value(result))
  }

  // Derived atoms use the reactive get context for proper subscription tracking
  const loadingAtom = Atom.make<boolean>((get) => {
    const result = get(pullAtom as any) as AsyncResult.AsyncResult<PullPayload, E>
    return AsyncResult.isWaiting(result) || AsyncResult.isInitial(result)
  })

  const doneAtom = Atom.make<boolean>((get) => {
    const result = get(pullAtom as any) as AsyncResult.AsyncResult<PullPayload, E>
    return Option.getOrUndefined(AsyncResult.value(result))?.done ?? false
  })

  const errorAtom = Atom.make<E | undefined>((get) => {
    const result = get(pullAtom as any) as AsyncResult.AsyncResult<PullPayload, E>
    return Option.getOrUndefined(AsyncResult.error(result))
  })

  registry.mount(loadingAtom)
  registry.mount(doneAtom)
  registry.mount(errorAtom)

  // ── Derive: auto-accumulate when pullAtom changes ─────────────────────────
  //
  // Atom.pull auto-fires on mount for synchronous streams.
  // We EAGERLY process any auto-fired chunk here, then track reference
  // identity to avoid double-processing in the subscription.
  //
  // Pattern:
  //   1. Read initial payload AFTER mount (may already be set for sync streams)
  //   2. If non-empty: process immediately → itemsAtom + cursorAtom
  //   3. Subscribe: skip items we've already seen (by reference identity)
  //   4. Waiting-state fires carry the previous payload.items ref → skip guard
  let lastSeenItems: ReadonlyArray<A> | null = null

  const initialPayload = readPayload()
  if (initialPayload && initialPayload.items.length > 0) {
    // Sync auto-pull fired — process immediately so atoms are populated
    lastSeenItems = initialPayload.items
    registry.set(itemsAtom, [...initialPayload.items])
    registry.set(cursorAtom, 1)
  }

  registry.subscribe(pullAtom, () => {
    const payload = readPayload()

    // Not resolved yet (Waiting/Initial) or empty/done chunk
    if (!payload || payload.items.length === 0) return

    // Already processed this exact chunk (same array ref) — skip.
    // Catches: Waiting-carrying-previous-value, already-processed initial chunk.
    if (payload.items === lastSeenItems) return

    lastSeenItems = payload.items

    const newChunk = payload.items
    const current  = registry.get(itemsAtom)
    const next     = mode === "replace" ? newChunk : [...current, ...newChunk]
    registry.set(itemsAtom, next)
    registry.set(cursorAtom, registry.get(cursorAtom) + 1)
  })

  // ── Pull trigger ────────────────────────────────────────────────────────────
  const pull = () => {
    registry.set(pullAtom as any, undefined)
  }

  // ── Reset: clear all accumulated state ────────────────────────────────────
  const reset = () => {
    registry.set(itemsAtom, [])
    registry.set(cursorAtom, 0)
  }

  // ── Dispose: no fiber to interrupt (pull is on-demand) ────────────────────
  const dispose = () => {
    registry.set(itemsAtom, [])
    registry.set(cursorAtom, 0)
  }

  return {
    items:    itemsAtom,
    cursor:   cursorAtom,
    loading:  loadingAtom,
    done:     doneAtom,
    error:    errorAtom,
    registry,
    pull,
    reset,
    dispose,
  }
}
