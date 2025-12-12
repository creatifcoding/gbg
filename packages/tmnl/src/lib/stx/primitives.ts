/**
 * stx Primitives
 *
 * Re-exports from the tri-library composition:
 * - Legend-State (hydration/data)
 * - effect-atom (Effect bridge)
 * - XState (shape/logic)
 *
 * @module
 */

// =============================================================================
// Legend-State (Hydration Layer)
// =============================================================================

export {
  // Core
  observable,
  computed,
  observe,
  batch,
  beginBatch,
  endBatch,
  // Utilities
  when,
  whenReady,
  isObservable,
  // Types
  type Observable,
  type ObservableObject,
  type ObservablePrimitive,
  type ObservableArray,
} from '@legendapp/state'

export {
  // React hooks
  useObservable,
  useComputed,
  useObserve,
  useSelector,
  useMount,
  useUnmount,
  // Components
  observer,
  Memo,
  Computed,
  Show,
  Switch,
  For,
  // Reactive bindings
  reactive,
  reactiveComponents,
} from '@legendapp/state/react'

// =============================================================================
// effect-atom (Effect Bridge)
// =============================================================================

export {
  Atom,
} from '@effect-atom/atom'

export {
  Result,
} from '@effect-atom/atom/Result'

export * as Registry from '@effect-atom/atom/Registry'

export {
  useAtomValue,
  useAtom,
  useAtomSet,
  useAtomSuspense,
  useAtomMount,
  useAtomRefresh,
  RegistryProvider,
  RegistryContext,
} from '@effect-atom/atom-react'

// =============================================================================
// XState (Shape/Logic)
// =============================================================================

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
  // Actor utilities
  createActor,
  interpret,
  waitFor,
  // State utilities
  matchesState,
  // Types
  type AnyStateMachine,
  type Actor,
  type ActorRefFrom,
  type SnapshotFrom,
  type EventFromLogic,
  type StateFrom,
  type MachineContext,
} from 'xstate'

export {
  useActor,
  useMachine,
  useActorRef,
  useSelector as useActorSelector,
  createActorContext,
} from '@xstate/react'
