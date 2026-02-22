import { Atom, Registry } from '@effect-atom/atom'
import type { BreakdownRunState } from '../schema.ts'

const now = () => new Date().toISOString()

const createInitialState = (): BreakdownRunState => ({
  status: 'idle',
  runs: 0,
  updatedAt: now(),
})

const REGISTRY_KEY = '__pi_component_breakdown_registry__'
const STATE_ATOM_KEY = '__pi_component_breakdown_state_atom__'
const STATE_VALUE_KEY = '__pi_component_breakdown_state_value__'

type GlobalWithBreakdownState = typeof globalThis & {
  [REGISTRY_KEY]?: Registry.AtomRegistry
  [STATE_ATOM_KEY]?: Atom.Writable<BreakdownRunState, BreakdownRunState>
  [STATE_VALUE_KEY]?: BreakdownRunState
}

const globalState = globalThis as GlobalWithBreakdownState

export const breakdownStateAtom =
  globalState[STATE_ATOM_KEY] ??
  (globalState[STATE_ATOM_KEY] = Atom.make<BreakdownRunState>(createInitialState()) as Atom.Writable<
    BreakdownRunState,
    BreakdownRunState
  >)

function ensureStateValue(): BreakdownRunState {
  if (!globalState[STATE_VALUE_KEY]) {
    globalState[STATE_VALUE_KEY] = createInitialState()
  }

  return globalState[STATE_VALUE_KEY]
}

export function getRegistry(): Registry.AtomRegistry {
  if (!globalState[REGISTRY_KEY]) {
    globalState[REGISTRY_KEY] = Registry.make()
    globalState[REGISTRY_KEY].set(breakdownStateAtom, ensureStateValue())
  }

  return globalState[REGISTRY_KEY]
}

export function getState(): BreakdownRunState {
  return ensureStateValue()
}

export function setState(next: BreakdownRunState): void {
  globalState[STATE_VALUE_KEY] = next
  getRegistry().set(breakdownStateAtom, next)
}

export function resetState(): void {
  const next = createInitialState()
  globalState[STATE_VALUE_KEY] = next

  if (globalState[REGISTRY_KEY]) {
    globalState[REGISTRY_KEY].set(breakdownStateAtom, next)
  }
}
