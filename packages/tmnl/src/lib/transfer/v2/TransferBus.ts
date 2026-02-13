/**
 * Transfer v2 — TransferBus
 *
 * Cross-surface atom namespace. Plain atoms — registry subscribes,
 * Registry.toStream when streaming needed, overlay system reads activeDrag.
 *
 * Not an Effect service — just module-level atoms. React hooks do the mutation
 * via registry.set(). No Layer ceremony needed for what's essentially a
 * shared atom namespace.
 *
 * See: src/lib/transfer/docs/redesign/03-transfer-scope-model.md §TransferBus
 *
 * @since v2
 */
import { Atom } from '@effect-atom/atom'
import type { TransferSession } from './schemas'

// ── Bus Atoms (singleton — one per app) ──────────────────────

/** Active drag session broadcast — overlay system reads this */
export const activeDragAtom = Atom.make<TransferSession | null>(null)

/** Registered surface IDs — for cross-surface discovery */
export const registeredSurfacesAtom = Atom.make<ReadonlySet<string>>(new Set())
