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
