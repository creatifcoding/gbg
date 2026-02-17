import { Effect } from "effect"
import type { NuCmdkItemProviderContextContract } from './item-contract'
import type { NuCmdkShellKind, NuCmdkShellMode, NuCmdkShellRow } from "./types"

export interface NuCmdkSearchRequest {
  readonly query: string
  readonly mode: NuCmdkShellMode
  readonly kind: NuCmdkShellKind
}

export interface NuCmdkSelectionRequest {
  readonly rowId: string
}

export interface NuCmdkCompletionBridge {
  readonly search: (request: NuCmdkSearchRequest) => Effect.Effect<ReadonlyArray<NuCmdkShellRow>, unknown, never>
}

export interface NuCmdkExecutionBridge {
  readonly execute: (request: NuCmdkSelectionRequest) => Effect.Effect<void, unknown, never>
}

export interface NuCmdkShellBridge {
  readonly completion: NuCmdkCompletionBridge
  readonly execution: NuCmdkExecutionBridge
}

export interface NuCmdkHostBridge {
  readonly onCancel: () => void
  readonly onClose: () => void
  readonly onModeChange?: (mode: NuCmdkShellMode) => void
}

/**
 * Provider-facing contract surface for item rendering.
 *
 * State is atom-first (`context.atoms`), operations are effect-first (`context.effects`).
 */
export interface NuCmdkItemProviderBridge {
  readonly context: NuCmdkItemProviderContextContract
}
