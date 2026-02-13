/**
 * Transfer v2 — TransferScope
 *
 * Surface-scoped transfer state via Atom.family keyed by surfaceId.
 * Atoms are the state. Registry handles subscription.
 * Registry.toStream() when streaming needed.
 * Overlay system reads activeDragAtom for drag feedback.
 *
 * See: src/lib/transfer/docs/redesign/03-transfer-scope-model.md
 *
 * @since v2
 */
import { Atom } from '@effect-atom/atom'
import { Effect } from 'effect'
import type {
  TransferKind,
  TransferInsertMode,
  TransferToken,
  TransferResult,
  TransferSession,
  TransferClipboardEntry,
} from './schemas'
import type { TransferRejectError } from './errors'

// ── Atom Families (keyed by surfaceId) ───────────────────────

/** Active drag session per surface */
export const sessionFamily = Atom.family(
  (_surfaceId: string) => Atom.make<TransferSession | null>(null),
)

/** Selection state per surface */
export const selectionFamily = Atom.family(
  (_surfaceId: string) => Atom.make<ReadonlySet<string>>(new Set()),
)

/** Local clipboard per surface */
export const clipboardFamily = Atom.family(
  (_surfaceId: string) => Atom.make<TransferClipboardEntry | null>(null),
)

// ── TransferScope Config ─────────────────────────────────────

/**
 * First curry application — bind surface identity + capabilities.
 * React hooks call lift/evaluate/lower. Registry mutates the family atoms.
 */
export interface TransferScopeConfig {
  readonly surfaceId: string
  readonly sourceKinds: ReadonlyArray<TransferKind>
  readonly acceptKinds: ReadonlyArray<TransferKind>

  /** Produce tokens from a selection within this surface */
  readonly lift: (
    selection: ReadonlyArray<string>,
  ) => ReadonlyArray<TransferToken>

  /** Evaluate whether an incoming token is acceptable */
  readonly evaluate: (token: TransferToken) => TransferResult

  /** Insert an accepted token into this surface */
  readonly lower: (
    token: TransferToken,
    mode: TransferInsertMode,
  ) => Effect.Effect<void, TransferRejectError>
}

// ── TransferScope Handle ─────────────────────────────────────

/**
 * What the compound hook produces after binding config to family atoms.
 * This is the scope — config + keyed atoms for this surfaceId.
 */
export interface TransferScopeHandle {
  readonly config: TransferScopeConfig

  /** Keyed atoms for this surface — registry.get/set/subscribe directly */
  readonly session: ReturnType<typeof sessionFamily>
  readonly selection: ReturnType<typeof selectionFamily>
  readonly clipboard: ReturnType<typeof clipboardFamily>
}

/** Create a scope handle from config — binds config to family atoms */
export function createScopeHandle(config: TransferScopeConfig): TransferScopeHandle {
  return {
    config,
    session: sessionFamily(config.surfaceId),
    selection: selectionFamily(config.surfaceId),
    clipboard: clipboardFamily(config.surfaceId),
  }
}
