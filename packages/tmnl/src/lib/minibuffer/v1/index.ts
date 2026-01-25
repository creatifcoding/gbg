/**
 * Minibuffer v1 — Deferred-based Implementation
 *
 * Original Emacs-inspired minibuffer using Effect.Deferred for blocking semantics.
 * Preserved for reference and gradual migration to v2.
 *
 * @deprecated Use v2 when available. This implementation uses fiber suspension
 * which is adversarial to React's event-driven model.
 *
 * @module
 */

import { Layer } from "effect"

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

// ─────────────────────────────────────────────────────────────
// Layers
// ─────────────────────────────────────────────────────────────

import { MinibufferService } from "./services/MinibufferService"

/**
 * v1 Minibuffer Layer — Deferred-based implementation.
 *
 * Provides MinibufferService using Effect.Deferred for blocking prompts.
 * Use this layer when you need the current (blocking) behavior.
 *
 * @deprecated Prefer v2 layer when available.
 */
export const MinibufferV1Layer = MinibufferService.Default

/**
 * Combined v1 Layer with all dependencies.
 */
export const MinibufferV1Live = Layer.mergeAll(
  MinibufferService.Default
)

// ─────────────────────────────────────────────────────────────
// Debug (development only)
// ─────────────────────────────────────────────────────────────

// Side-effect import: registers window.__MINIBUFFER_DEBUG__
import "./debug"
