/**
 * effect-atom state management for questionnaire runtime.
 *
 * Uses Registry for get/set/subscribe outside React.
 * Single registry instance shared across engine + renderer.
 */

import { Atom } from '@effect-atom/atom'
import { Registry } from '@effect-atom/atom'
import type { Question, Answer, Questionnaire, DynamicMutationTrace } from './schema.ts'

// =============================================================================
// State shape
// =============================================================================

export interface InputTarget {
  value: string
  label: string
}

export interface PendingAnswer {
  value: string
  label: string
  wasCustom?: boolean
}

export interface RuntimeMutationFrame {
  fromQuestionId: string
  injectedIds: string[]
  modified: Array<{ id: string; previous: Question | null }>
}

export interface QuestionnaireState {
  spec: Questionnaire | null
  current: Question | null
  answers: Map<string, Answer[]>
  history: string[]
  status: 'idle' | 'active' | 'complete' | 'cancelled'
  optionIndex: number
  inputText: string
  inputMode: boolean
  inputKind: 'answer' | 'note' | null
  inputTarget: InputTarget | null
  pendingAnswer: PendingAnswer | null

  // Runtime dynamic-branch overlay
  runtimeQuestions: Map<string, Question>
  mutationLog: RuntimeMutationFrame[]
  dynamicTrace: DynamicMutationTrace[]
  dynamicPending: boolean
  dynamicPendingSinceMs: number | null
  dynamicInterruptRequested: boolean
}

export const initialState: QuestionnaireState = {
  spec: null,
  current: null,
  answers: new Map(),
  history: [],
  status: 'idle',
  optionIndex: 0,
  inputText: '',
  inputMode: false,
  inputKind: null,
  inputTarget: null,
  pendingAnswer: null,

  runtimeQuestions: new Map(),
  mutationLog: [],
  dynamicTrace: [],
  dynamicPending: false,
  dynamicPendingSinceMs: null,
  dynamicInterruptRequested: false,
}

// =============================================================================
// Atoms
// =============================================================================

export const stateAtom = Atom.make<QuestionnaireState>({ ...initialState })

export const progressAtom = Atom.make((get) => {
  const s = get(stateAtom)
  if (!s.spec) return { answered: 0, total: 0, pct: 0 }
  const total = s.spec.questions.length
  const answered = s.answers.size
  return { answered, total, pct: total > 0 ? Math.round((answered / total) * 100) : 0 }
})

// =============================================================================
// Registry — the runtime for atom operations outside React
// =============================================================================

let _registry: Registry.AtomRegistry | null = null

export function getRegistry(): Registry.AtomRegistry {
  if (!_registry) _registry = Registry.make()
  return _registry
}

/** Reset registry between questionnaire runs. */
export function resetRegistry(): void {
  if (_registry) _registry.reset()
  _registry = Registry.make()
}

// Convenience wrappers
export function get<A>(atom: Atom.Atom<A>): A {
  return getRegistry().get(atom)
}

export function set<R, W>(atom: Atom.Writable<R, W>, value: W): void {
  getRegistry().set(atom, value)
}

export function subscribe<A>(atom: Atom.Atom<A>, fn: (value: A) => void): () => void {
  return getRegistry().subscribe(atom, fn)
}
