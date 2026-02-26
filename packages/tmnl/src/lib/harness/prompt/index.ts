/**
 * EPOCH-0003: Self-Adapting System Prompt Architecture — Public API
 *
 * @module harness/prompt
 */

export { PromptRegistry, makePromptRegistry, PromptRegistryLive, type PromptRegistryShape } from './PromptRegistry'
export {
  PromptEntry,
  PromptEntryMeta,
  PromptBudget,
  PromptBudgetExceededError,
  PromptReservedKeyError,
  RESERVED_KEYS,
  isReservedKey,
  DEFAULT_AGENT_BUDGET_BYTES,
  DEFAULT_AGENT_PRIORITY,
} from './types'
export type { ReservedKey } from './types'

// Sections
export { makeIdentitySection } from './sections/identity'
export type { IdentitySectionConfig } from './sections/identity'
export { makeToolManifestSection } from './sections/tool-manifest'
export { makeGuidelinesSection } from './sections/guidelines'
export { makeProjectContextSection } from './sections/project-context'
export { makeRuntimeStampSection } from './sections/runtime-stamp'

// Factory
export { makeDefaultRegistry } from './factory'
export type { DefaultRegistryConfig } from './factory'
