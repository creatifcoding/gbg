/**
 * harness-adapter/ — decomposed from useHarnessAdapter.ts (1735 LOC).
 *
 * Module topology (no cycles):
 *   types.ts     ← (leaf)
 *   logging.ts   ← (leaf)
 *   atoms.ts     ← types
 *   helpers.ts   ← types, atoms
 *   persistence.ts ← atoms
 *   panel-replay.ts ← types
 *   lifecycle.ts ← atoms, helpers, logging, panel-replay
 *   operations.ts ← atoms, helpers, logging, lifecycle
 *   hook.ts      ← atoms, helpers, operations, persistence, panel-replay
 *   compat.ts    ← atoms, operations
 *
 * @module morphchat/hooks/harness-adapter
 */

// ── Module-level side effects (registry wiring) ──────────────────────────────
import {
  setShellRegistry,
} from '@/lib/harness/interactive-shell/shell-session-atoms'
import { setGeniferPanelRegistry } from '@/lib/genifer/harness/panel-visitor'
import { morphChatRegistry } from '../../atoms/registry'

setShellRegistry(morphChatRegistry)
setGeniferPanelRegistry(morphChatRegistry)

// ── Re-exports ───────────────────────────────────────────────────────────────

// types
export type {
  HarnessModelOption,
  HarnessStatusRow,
  ContextUsage,
  HarnessInstanceConfig,
  ReplaySafePanelEventDeps,
  UseHarnessAdapterConfig,
  HarnessAdapterStatus,
  UseHarnessAdapterResult,
} from './types'
export { HARNESS_ROLES } from './types'

// atoms
export {
  harnessRuntimeAtom,
  messages$, messageIds$, getMessageAtom, clearMessageAtoms,
  connection$, streaming$, agents$, sessionId$,
  metrics$, provider$, contextUsage$, statusRows$,
  availableModels$, selectedModel$, lastError$, cancelledAt$,
  modelsLoading$, modelsError$,
} from './atoms'

// panel replay
export { applyReplaySafeRemotePanelEvent } from './panel-replay'

// hook
export { useHarnessAdapter } from './hook'

// compat (deprecated)
export {
  harnessMessages$,
  harnessConnection$,
  harnessStreaming$,
  harnessAgents$,
  harnessAvailableModels$,
  harnessSelectedModel$,
  harnessStatusRows$,
  harnessMetrics$,
  harnessProvider$,
  harnessSessionId$,
  harnessOps,
} from './compat'
