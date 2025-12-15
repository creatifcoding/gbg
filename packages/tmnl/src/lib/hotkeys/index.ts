/**
 * TMNL Hotkeys
 *
 * Effect-native command orchestration with emacs-inspired ergonomics.
 *
 * Architecture:
 * - Source atoms hold reactive state
 * - Derived atoms compute from sources
 * - hotkeyActions mutate source atoms via registry
 * - hotkeyOps for Effect-based operations (parsing)
 * - processKeyboardEvent is a pure function
 *
 * Features:
 * - which-key: Prefix-aware hint popups
 * - M-x: Fuzzy command palette (TODO)
 * - Macro DSL: Recordable command sequences (TODO)
 * - Scoped bindings: Layer-aware contexts
 */

// Types
export type {
  KeyChord,
  KeySequence,
  KeyString,
  Modifiers,
  Command,
  CommandConfig,
  CommandContext,
  CommandError,
  Binding,
  BindingMatch,
  BindingSource,
  Scope,
  ScopeId,
  WhichKeyState,
  WhichKeyEntry,
  CommandPaletteState,
  PaletteEntry,
  MacroNode,
  Macro,
  HotkeyConfig,
} from './types'

export { Scopes, DEFAULT_CONFIG, getNativeSuppression } from './types'

// KeyParser service (for parsing key strings)
export { KeyParser, KeyParserError } from './services/KeyParser'
export type { KeyParserService } from './services/KeyParser'

// Atoms — Source of Truth
export {
  // Source atoms (writable)
  bindingsSourceAtom,
  sequenceSourceAtom,
  scopeStackSourceAtom,
  commandsSourceAtom,
  configSourceAtom,
  // Derived atoms (computed)
  activeScopeAtom,
  scopeChainAtom,
  scopedBindingsAtom,
  whichKeyEntriesAtom,
  // Runtime atom (for Effect services)
  hotkeyRuntimeAtom,
  // Operations
  hotkeyOps,
  hotkeyActions,
  processKeyboardEvent,
  // Legacy aliases
  bindingsAtom,
  currentSequenceAtom,
  configAtom,
} from './atoms'

export type { ProcessResult } from './atoms'

// Command palette support (pure functions)
export { searchCommands, getCategories } from './atoms'
export type { CommandSearchResult } from './atoms'

// ─────────────────────────────────────────────────────────────────────────────
// DEPRECATED SERVICES REMOVED
// ─────────────────────────────────────────────────────────────────────────────
//
// CommandRegistry and HotkeyManager services have been removed.
// Use atoms + hotkeyActions instead:
//
//   CommandRegistry.register()  →  hotkeyActions.registerCommand(registry, ...)
//   HotkeyManager.bind()        →  hotkeyActions.addBinding(registry, ...)
//   HotkeyManager.processEvent  →  processKeyboardEvent() pure function
//
// For M-x command palette, use the minibuffer system:
//   import { useMinibuffer } from '@/lib/minibuffer'
//   const { executeCommand } = useMinibuffer()
// ─────────────────────────────────────────────────────────────────────────────
