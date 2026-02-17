/**
 * NuCmdk
 *
 * Standalone command-palette runtime + shell module.
 *
 * Ownership boundary:
 * - commands/: command registry/execution domain
 * - nu-cmdk/: palette runtime, shell composition, provider bridge wiring
 */

// Wiring / bootstrap
export {
  useNuCmdkWire,
  NuCmdkProviderRegistrationError,
} from './wire/useNuCmdkWire'
export type {
  UseNuCmdkWireOptions,
  UseNuCmdkWireResult,
} from './wire/useNuCmdkWire'

// Shell API
export {
  NuCmdkShell,
  NuCmdkShellOverlay,
} from './shell'
export type {
  NuCmdkShellProps,
  NuCmdkShellOverlayProps,
  NuCmdkShellState,
  NuCmdkShellRow,
  NuCmdkShellKind,
  NuCmdkShellMode,
  NuCmdkShellBridge,
  NuCmdkCompletionBridge,
  NuCmdkExecutionBridge,
  NuCmdkHostBridge,
  NuCmdkItemProviderBridge,
  NuCmdkSearchRequest,
  NuCmdkSelectionRequest,
  NuCmdkItemModel,
  NuCmdkItemSemantic,
  NuCmdkItemActionIntent,
  NuCmdkItemDisplay,
  NuCmdkItemLayoutHints,
  NuCmdkItemTelemetry,
  NuCmdkItemProviderDescriptor,
  NuCmdkItemProviderContextContract,
  NuCmdkItemProviderAtoms,
  NuCmdkItemProviderEffects,
} from './shell'

// Runtime
export * from './runtime'
