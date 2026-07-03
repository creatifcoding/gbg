/**
 * @tmnl/stx — XState Machine Integration
 *
 * `stxMachine(machine, initial)` creates a reactive state container
 * that pairs @tmnl/stx's optic-based state with an XState actor.
 *
 * **Two-way sync** between atom state and machine context:
 * - Machine context changes → atom state updates
 * - Atom state changes → machine events (via `stateToEvent`)
 *
 * **Loop prevention**: Internal flags prevent infinite sync loops.
 *
 * @example
 * ```ts
 * import { stxMachine } from "@tmnl/stx"
 * import { setup } from "xstate"
 *
 * const panelMachine = setup({ ... }).createMachine({ ... })
 *
 * interface PanelData {
 *   activePanel: string | null
 *   zOrder: string[]
 * }
 *
 * const store = stxMachine(panelMachine, {
 *   activePanel: null,
 *   zOrder: [],
 * } satisfies PanelData, {
 *   // Machine context changes → update atom state
 *   contextToState: (ctx) => ({ activePanel: ctx.targetPanel }),
 *   // Atom state changes → send machine event
 *   stateToEvent: (state, prev) =>
 *     state.activePanel !== prev.activePanel
 *       ? { type: 'PANEL_FOCUSED', panelId: state.activePanel }
 *       : undefined,
 * })
 *
 * // Send events
 * store.send({ type: 'OPEN_PANEL', panelId: 'settings' })
 *
 * // Read machine snapshot
 * const snapshot = store.machineSnapshot()
 * snapshot.matches('idle') // boolean
 *
 * // Optic access (from base stx)
 * store.getAt(store.lens.activePanel) // string | null
 * store.setAt(store.lens.zOrder, ['panel-1', 'panel-2'])
 *
 * // React
 * const { value, send } = useStxMachine(store, registry)
 * ```
 *
 * @module
 */

import { Atom, AtomRegistry } from "effect/unstable/reactivity"
import * as Result from "effect/Result"
import { stx } from "./stx.js"
import { isClassInstance } from "./internal/class-patch.js"
import type { StxInstance } from "./types.js"
import {
  createActor,
  type AnyStateMachine,
  type EventFromLogic,
  type SnapshotFrom,
  type ContextFrom,
  type Actor,
} from "xstate"

// ─── Types ───────────────────────────────────────────────────

/**
 * Configuration for machine ↔ state sync.
 */
export interface StxMachineConfig<
  S,
  M extends AnyStateMachine,
> {
  /** AtomRegistry to use (creates one if not provided) */
  registry?: AtomRegistry.AtomRegistry

  /**
   * Sync machine context → atom state.
   * Called on every machine transition.
   * Return the partial state fields to update.
   *
   * @example
   * ```ts
   * contextToState: (ctx) => ({ activePanel: ctx.targetPanel })
   * ```
   */
  contextToState?: (context: ContextFrom<M>, snapshot: SnapshotFrom<M>) => Partial<S>

  /**
   * Sync atom state → machine events.
   * Called after every state mutation (set, setAt, modify).
   * Return an event to send, or undefined to skip.
   *
   * @example
   * ```ts
   * stateToEvent: (state, prev) =>
   *   state.activePanel !== prev.activePanel
   *     ? { type: 'PANEL_FOCUSED', panelId: state.activePanel }
   *     : undefined
   * ```
   */
  stateToEvent?: (state: S, prev: S) => EventFromLogic<M> | undefined

  /**
   * XState actor options — input, snapshot restore, etc.
   */
  actorOptions?: {
    input?: unknown
    snapshot?: unknown
  }
}

/**
 * A machine-backed stx instance — extends StxInstance with XState actor.
 */
export interface StxMachineInstance<S, M extends AnyStateMachine> extends StxInstance<S> {
  /** XState actor ref */
  readonly actor: Actor<M>

  /** Send event to machine */
  readonly send: (event: EventFromLogic<M>) => void

  /** Get current machine snapshot */
  readonly machineSnapshot: () => SnapshotFrom<M>

  /** Atom that holds the current machine snapshot (reactive) */
  readonly snapshotAtom: Atom.Writable<SnapshotFrom<M>, SnapshotFrom<M>>

  /** Check if machine matches a state value */
  readonly matches: (stateValue: string) => boolean

  /** Dispose: stop actor + cleanup subscriptions */
  readonly dispose: () => void

  /** Reset: restore state + restart actor from initial snapshot */
  readonly reset: () => void
}

// ─── Factory ─────────────────────────────────────────────────

/**
 * Create a machine-backed stx instance.
 *
 * Combines @tmnl/stx's optic-based reactive state with an XState actor.
 * Supports bidirectional sync between atom state and machine context.
 *
 * @param machine - XState machine definition
 * @param initial - Initial state value
 * @param config - Optional sync config + registry
 * @returns StxMachineInstance with all stx APIs + machine APIs
 */
export function stxMachine<S, M extends AnyStateMachine>(
  machine: M,
  initial: S,
  config?: StxMachineConfig<S, M>,
): StxMachineInstance<S, M> {
  const reg = config?.registry ?? AtomRegistry.make()

  // Create base stx instance
  const base = stx(initial, reg)

  // ─── Safe Snapshot (Fix #2: no structuredClone for class instances) ─────

  function safeSnapshot(value: S): S {
    if (isClassInstance(value)) {
      // Class instances (Schema.TaggedClass, etc.) are immutable by convention —
      // stx creates new instances on mutation via classAwareReplace.
      // Safe to hold reference; structuredClone would throw.
      return value
    }
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) return [...value] as S
      return { ...value } as S
    }
    return value
  }

  // ─── Actor Lifecycle ────────────────────────────

  let actor = createActor(machine as any, {
    ...(config?.actorOptions?.input !== undefined ? { input: config.actorOptions.input } : {}),
    ...(config?.actorOptions?.snapshot !== undefined ? { snapshot: config.actorOptions.snapshot as any } : {}),
  }) as Actor<M>

  // Capture initial state for reset (safe for class instances)
  const initialState = safeSnapshot(initial)
  let initialPersistedSnapshot: unknown | undefined

  // ─── Snapshot Atom (reactive) ───────────────────

  const snapshotAtom = Atom.make(
    actor.getSnapshot(),
  ) as unknown as Atom.Writable<SnapshotFrom<M>, SnapshotFrom<M>>
  reg.mount(snapshotAtom)

  // ─── Loop Prevention ────────────────────────────

  let isUpdatingFromMachine = false
  let isUpdatingFromState = false
  let prevState: S = safeSnapshot(initial)

  // ─── Subscription Factory (Fix #3: single source of truth) ─────

  const cleanupFns: (() => void)[] = []

  /**
   * Create and register a machine subscription.
   * Handles: snapshotAtom updates + contextToState sync.
   * Called once at init and again on each reset().
   */
  function subscribeMachine(): void {
    const sub = actor.subscribe((snapshot: any) => {
      // Update snapshot atom
      reg.set(snapshotAtom, snapshot as SnapshotFrom<M>)

      // Sync context → state (if configured)
      if (config?.contextToState && !isUpdatingFromState) {
        isUpdatingFromMachine = true
        try {
          const updates = config.contextToState(
            snapshot.context as ContextFrom<M>,
            snapshot as SnapshotFrom<M>,
          )
          if (updates && Object.keys(updates).length > 0) {
            const current = base.get()
            const merged = typeof current === 'object' && current !== null
              ? { ...current, ...updates }
              : current
            base.set(merged as S)
            prevState = safeSnapshot(base.get())
          }
        } finally {
          isUpdatingFromMachine = false
        }
      }
    })
    cleanupFns.push(() => sub.unsubscribe())
  }

  // Initial machine subscription
  subscribeMachine()

  // State → Machine sync (via atom subscription)
  if (config?.stateToEvent) {
    const stateToEvent = config.stateToEvent
    const unsub = reg.subscribe(base.atom, () => {
      if (isUpdatingFromMachine) return
      isUpdatingFromState = true
      try {
        const current = base.get()
        const event = stateToEvent(current, prevState)
        if (event) {
          actor.send(event as any)
        }
        prevState = safeSnapshot(current)
      } finally {
        isUpdatingFromState = false
      }
    })
    cleanupFns.push(unsub)
  }

  // Start actor after bindings
  actor.start()
  initialPersistedSnapshot = actor.getPersistedSnapshot()
  reg.set(snapshotAtom, actor.getSnapshot() as SnapshotFrom<M>)

  // ─── API ────────────────────────────────────────

  const send = (event: EventFromLogic<M>): void => {
    actor.send(event as any)
  }

  const machineSnapshot = (): SnapshotFrom<M> => {
    return actor.getSnapshot() as SnapshotFrom<M>
  }

  const matches = (stateValue: string): boolean => {
    return (actor.getSnapshot() as any).matches(stateValue)
  }

  const dispose = (): void => {
    for (const cleanup of cleanupFns) {
      cleanup()
    }
    cleanupFns.length = 0
    actor.stop()
  }

  const reset = (): void => {
    // Stop current actor
    actor.stop()

    // Reset state (safe for class instances)
    base.set(safeSnapshot(initialState))
    prevState = safeSnapshot(initialState)

    // Restart actor from initial snapshot
    actor = createActor(machine as any, {
      ...(config?.actorOptions?.input !== undefined ? { input: config.actorOptions.input } : {}),
      ...(initialPersistedSnapshot !== undefined ? { snapshot: initialPersistedSnapshot as any } : {}),
    }) as Actor<M>

    // Re-subscribe (uses the same factory — no duplication)
    subscribeMachine()

    actor.start()
    reg.set(snapshotAtom, actor.getSnapshot() as SnapshotFrom<M>)
  }

  // ─── Compose Instance (Fix #1: live actor getter via defineProperty) ────

  const instance = {
    // Base stx API
    atom: base.atom,
    lens: base.lens,
    focus: base.focus,
    set: (value: S) => {
      base.set(value)
    },
    setAt: base.setAt,
    modify: base.modify,
    trySet: base.trySet,
    trySetAt: base.trySetAt,
    tryModify: base.tryModify,
    filter: base.filter,
    when: base.when,
    get: base.get,
    getAt: base.getAt,
    registry: reg,
    entityMeta: base.entityMeta,
    debugSnapshot: base.debugSnapshot,

    // Machine API
    send,
    machineSnapshot,
    snapshotAtom,
    matches,
    dispose,
    reset,
  } as StxMachineInstance<S, M>

  // Live getter — always returns current actor (survives reset)
  Object.defineProperty(instance, 'actor', {
    get: () => actor,
    enumerable: true,
  })

  return instance
}
