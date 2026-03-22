/**
 * Minibuffer v2 — XState + Event-Driven
 *
 * Replaces Deferred-based blocking with XState machine.
 * React sends events, Effect streams react to result changes.
 *
 * Architecture: Approach C (Hybrid)
 * - XState machine is source of truth
 * - Single snapshotAtom bridges to effect-atom
 * - Selector atoms derive from snapshot (consistent with codebase)
 * - ops send events to actor
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────
// Machine
// ─────────────────────────────────────────────────────────────

export {
  minibufferMachine,
  type MinibufferMachine,
  type MinibufferActor,
  type MinibufferSnapshot,
  type MinibufferContext,
  type MinibufferEvent,
  type MinibufferMode,
  type MinibufferResult,
  type Completion,
  type ProviderId,
  type WhichKeyEntry,
} from "./machine"

// ─────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────

export {
  createProviderId,
  providerRegistry,
  getCompletions,
  executeSelection,
  COMMAND_PROVIDER_ID,
  type CompletionProvider,
  type ProviderRegistry,
} from "./providers"

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

export { useMinibuffer } from "./hooks"
export type { UseMinibufferReturn } from "./hooks"

// ─────────────────────────────────────────────────────────────
// Bridge Atoms (Approach C: Hybrid)
// ─────────────────────────────────────────────────────────────

export {
  // Bridge
  snapshotAtom,
  // Selectors
  modeAtom,
  isActiveAtom,
  promptAtom,
  inputAtom,
  completionsAtom,
  selectedIndexAtom,
  providerIdAtom,
  whichKeyPrefixAtom,
  whichKeyEntriesAtom,
  errorAtom,
  resultAtom,
  // Derived
  selectedCompletionAtom,
  contextAtom,
  // Operations
  send,
  ops,
  // Actor access
  getActor,
  getSnapshot,
} from "./atoms"

// ─────────────────────────────────────────────────────────────
// Command Execution (Effect streams)
// ─────────────────────────────────────────────────────────────

export {
  createExecutionStream,
  runExecutionStream,
  scopedExecutionStream,
  pollAndExecute,
  type CommandHandler,
  type CommandExecutionResult,
} from "./execution"

// ─────────────────────────────────────────────────────────────
// React Context & Hooks (XState native — use atoms for effect-atom)
// ─────────────────────────────────────────────────────────────

export {
  MinibufferReactContext,
  MinibufferProvider,
  useMinibufferActor,
  useMinibufferSelector,
  // Note: useMinibuffer exported from ./hooks (primary API)
  // Selectors (XState native)
  selectMode,
  selectIsActive,
  selectPrompt,
  selectInput,
  selectCompletions,
  selectSelectedIndex,
  selectSelectedCompletion,
  selectResult,
  selectWhichKeyPrefix,
  selectWhichKeyEntries,
  selectError,
} from "./context"

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

export { MinibufferContent } from "./components"
