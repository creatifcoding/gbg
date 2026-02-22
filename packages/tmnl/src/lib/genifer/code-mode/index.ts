/**
 * Code Mode SDK — sandboxed Effect runtime for LLM-generated code.
 *
 * @module genifer/code-mode
 */

// Schemas + interfaces
export {
  GeniferCodeParams,
  type GeniferCodeDetails,
  CodeModeResult,
  CodeModeSandboxError,
  CodeModeTimeoutError,
  type GeniferCodeSDK,
  type ExposeSpec,
} from './schemas'

// Sandbox
export {
  createCodeSDK,
  allowUrl,
  getAuditLog,
  clearAuditLog,
  getDynamicTools,
  getDynamicComponents,
  resetSandboxState,
} from './sandbox'

// Executor
export { executeCodeMode } from './executor'

// Surface Bridge
export { setSurfaceBridge, resetSurfaceBridge } from './surface-bridge'

// Tree Mutator
export {
  updateElementProps,
  addChildElement,
  removeElement,
  getElement as getTreeElement,
  listElements as listTreeElements,
} from './tree-mutator'

// React hooks
export { useCodeModeAtom, useCodeModeAtoms } from './useCodeModeAtom'

// Shared Atom Bridge
export {
  setCodeModeAtom,
  getCodeModeAtom,
  subscribeCodeModeAtom,
  subscribeStore,
  getStoreSnapshot,
  listAtomKeys,
  hasAtom,
  resetSharedAtomStore,
} from './shared-atoms'
