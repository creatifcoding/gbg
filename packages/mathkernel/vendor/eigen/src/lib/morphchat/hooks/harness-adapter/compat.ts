/**
 * Harness adapter compat — deprecated singleton aliases for default instance.
 *
 * @deprecated Use per-instance atoms via Atom.family: messages$(instanceId)
 * @module morphchat/hooks/harness-adapter/compat
 */

import {
  messages$, connection$, streaming$, agents$, availableModels$,
  selectedModel$, statusRows$, metrics$, provider$, sessionId$,
} from './atoms'
import {
  connectOp$, sendOp$, cancelOp$, clearOp$, disposeOp$,
  fetchModelsOp$, newSessionOp$, resumeSessionOp$,
} from './operations'

const DEFAULT_ID = '__default__'

/** @deprecated Use per-instance atoms via Atom.family: messages$(instanceId) */
export const harnessMessages$ = messages$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: connection$(instanceId) */
export const harnessConnection$ = connection$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: streaming$(instanceId) */
export const harnessStreaming$ = streaming$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: agents$(instanceId) */
export const harnessAgents$ = agents$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: availableModels$(instanceId) */
export const harnessAvailableModels$ = availableModels$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: selectedModel$(instanceId) */
export const harnessSelectedModel$ = selectedModel$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: statusRows$(instanceId) */
export const harnessStatusRows$ = statusRows$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: metrics$(instanceId) */
export const harnessMetrics$ = metrics$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: provider$(instanceId) */
export const harnessProvider$ = provider$(DEFAULT_ID)
/** @deprecated Use per-instance atoms via Atom.family: sessionId$(instanceId) */
export const harnessSessionId$ = sessionId$(DEFAULT_ID)
/** @deprecated Use per-instance ops via connectOp$(instanceId), sendOp$(instanceId), etc. */
export const harnessOps = {
  connect: connectOp$(DEFAULT_ID),
  send: sendOp$(DEFAULT_ID),
  cancel: cancelOp$(DEFAULT_ID),
  clear: clearOp$(DEFAULT_ID),
  dispose: disposeOp$(DEFAULT_ID),
  fetchModels: fetchModelsOp$(DEFAULT_ID),
  newSession: newSessionOp$(DEFAULT_ID),
  resumeSession: resumeSessionOp$(DEFAULT_ID),
}
