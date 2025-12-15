/**
 * Minibuffer Module
 *
 * Emacs-inspired minibuffer system for TMNL.
 * Provides M-x command execution, prompt/completion/history, which-key hints.
 *
 * @module
 */

// ─────────────────────────────────────────────────────────────
// Schemas
// ─────────────────────────────────────────────────────────────

export {
  MinibufferMode,
  ProviderId,
  Completion,
  HistoryKey,
  WhichKeyEntry,
  MINIBUFFER_DRAWER_DEFAULTS,
} from "./schemas/minibuffer"

export type {
  MinibufferMode as MinibufferModeType,
  ProviderId as ProviderIdType,
  Completion as CompletionType,
  HistoryKey as HistoryKeyType,
  WhichKeyEntry as WhichKeyEntryType,
} from "./schemas/minibuffer"

// ─────────────────────────────────────────────────────────────
// Services
// ─────────────────────────────────────────────────────────────

export { MinibufferService } from "./services/MinibufferService"
export type { MinibufferServiceImpl } from "./services/MinibufferService"

// ─────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────

export {
  providerRegistry,
  createProviderId,
  CommandProvider,
  COMMAND_PROVIDER_ID,
} from "./providers"

export type {
  CompletionProvider,
  ProviderRegistry,
  ProviderReadOptions,
} from "./providers"

// ─────────────────────────────────────────────────────────────
// Atoms
// ─────────────────────────────────────────────────────────────

export * as MinibufferAtoms from "./atoms"

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

export { useMinibuffer } from "./hooks/useMinibuffer"
export type { UseMinibufferReturn } from "./hooks/useMinibuffer"

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

export { MinibufferContent } from "./components/MinibufferContent"
