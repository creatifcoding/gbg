/**
 * stx - Unified State Library
 *
 * Tri-library composition:
 * - XState (shape/logic)
 * - Legend-State (hydration/data)
 * - effect-atom (Effect bridge)
 *
 * @example
 * ```typescript
 * import { stx, useStxValue, useStxSend } from '@/lib/atoms'
 *
 * const counter = stx({
 *   machine: counterMachine,
 *   data: { count: 0 },
 *   effects: {
 *     save: Effect.gen(function* () { ... }),
 *   },
 *   computed: {
 *     doubled: (get) => get.data.count * 2,
 *   },
 * })
 *
 * function Counter() {
 *   const count = useStxValue(counter, s => s.data.count.get())
 *   const send = useStxSend(counter)
 *   return <button onClick={() => send({ type: 'INC' })}>{count}</button>
 * }
 * ```
 *
 * @module
 */

// =============================================================================
// Core Factory
// =============================================================================

export { stx, stxData, stxMachine, stxSynced } from './stx'
export type { StxBindingsConfig, StxConfigWithBindings } from './stx'

// =============================================================================
// Bindings (XState ↔ Legend-State ↔ Effect)
// =============================================================================

export {
  fromEffect,
  fromEffectCallback,
  fromLegendState,
  fromLegendStateMulti,
  updateLegendState,
  batchLegendState,
  bridgeToActor,
  createTwoWayBridge,
} from './bindings'

// =============================================================================
// React Hooks
// =============================================================================

export {
  useStxValue,
  useStxData,
  useStxSend,
  useStxMachine,
  useStxMatches,
  useStxEffect,
  useStxComputed,
  useStx,
} from './hooks'

// =============================================================================
// Types
// =============================================================================

export type {
  StxConfig,
  Stx,
  StxGetter,
  StxStream,
  StreamStxConfig,
  EffectsConfig,
  ComputedConfig,
  PersistConfig,
  UseStxValueReturn,
  UseStxSendReturn,
  UseStxMachineReturn,
  UseStxEffectReturn,
  DataOf,
  MachineOf,
  EffectsOf,
  ComputedOf,
} from './types'

// =============================================================================
// Primitives (Re-exports)
// =============================================================================

// Legend-State
export {
  observable,
  computed,
  observe,
  batch,
  beginBatch,
  endBatch,
  when,
  whenReady,
  isObservable,
  observer,
  useObservable,
  useComputed,
  useObserve,
  useSelector,
  Memo,
  Computed,
  Show,
  Switch,
  For,
  reactive,
  reactiveComponents,
} from './primitives'

// effect-atom
export {
  Atom,
  Result,
  Registry,
  useAtomValue,
  useAtom,
  useAtomSet,
  useAtomSuspense,
  useAtomMount,
  useAtomRefresh,
  RegistryProvider,
  RegistryContext,
} from './primitives'

// XState
export {
  createMachine,
  setup,
  assign,
  raise,
  sendTo,
  sendParent,
  forwardTo,
  log,
  cancel,
  stop,
  emit,
  createActor,
  interpret,
  waitFor,
  matchesState,
  useActor,
  useMachine,
  useActorRef,
  useActorSelector,
  createActorContext,
} from './primitives'
