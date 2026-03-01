/**
 * useHarnessAdapter — re-export shim.
 *
 * Logic decomposed into ./harness-adapter/ (8 focused modules).
 * This file re-exports everything for backward compatibility.
 * New code should import from './harness-adapter' directly.
 *
 * @module morphchat/hooks/useHarnessAdapter
 */
export {
  // ── Types ──
  HARNESS_ROLES,

  // ── Atoms ──
  harnessRuntimeAtom,
  messages$,
  messageIds$,
  getMessageAtom,
  clearMessageAtoms,
  connection$,
  streaming$,
  agents$,
  sessionId$,
  metrics$,
  provider$,
  contextUsage$,
  statusRows$,
  availableModels$,
  selectedModel$,
  lastError$,
  cancelledAt$,
  modelsLoading$,
  modelsError$,

  // ── Panel replay ──
  applyReplaySafeRemotePanelEvent,

  // ── Hook ──
  useHarnessAdapter,

  // ── Compat (deprecated) ──
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
} from './harness-adapter'

export type {
  HarnessModelOption,
  HarnessStatusRow,
  ContextUsage,
  HarnessInstanceConfig,
  ReplaySafePanelEventDeps,
  UseHarnessAdapterConfig,
  HarnessAdapterStatus,
  UseHarnessAdapterResult,
} from './harness-adapter'
