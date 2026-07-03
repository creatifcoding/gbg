/**
 * CrdtLayer — Lamport clocks + LWW registers + operation log.
 *
 * @module
 */

import { Effect, Context, Layer } from "effect"
import type { CellValue } from "../schemas/cell-value"
import type { ColRow } from "../schemas/addressing"
import { cellKey } from "../schemas/addressing"

// ─── Types ──────────────────────────────────────────

export interface CellOp {
  readonly sheetId: string
  readonly col: number
  readonly row: number
  readonly payload: CellValue
  readonly clock: number
  readonly agentId: string
}

export interface MergeResult {
  readonly applied: boolean
  readonly reason: "accepted" | "rejected-stale" | "rejected-tiebreak"
  readonly winningClock: number
  readonly winningAgent: string
}

export interface OpLogEntry extends CellOp {
  readonly outcome: "applied" | "rejected-stale" | "rejected-tiebreak"
  readonly timestamp: string
}

// ─── Config ─────────────────────────────────────────

export interface CrdtLayerConfigShape {
  readonly sheetId: string
  readonly agentId: string
  readonly onApply: (op: CellOp) => void
}

export class CrdtLayerConfig extends Context.Service<CrdtLayerConfig, CrdtLayerConfigShape>()(
  "@tmnl/datagrid/CrdtLayerConfig",
) {}

// ─── Service interface ──────────────────────────────

export interface CrdtLayerShape {
  readonly apply: (op: CellOp) => Effect.Effect<MergeResult>
  readonly merge: (ops: ReadonlyArray<CellOp>) => Effect.Effect<ReadonlyArray<MergeResult>>
  readonly clock: () => number
  readonly tick: () => number
  readonly agentId: string
  readonly cellClock: (addr: ColRow) => number
  readonly recentOps: (limit?: number) => ReadonlyArray<OpLogEntry>
}

// ─── Service tag ────────────────────────────────────

export class CrdtLayer extends Context.Service<CrdtLayer, CrdtLayerShape>()(
  "@tmnl/datagrid/CrdtLayer",
) {}

// ─── Layer ──────────────────────────────────────────

export const CrdtLayerLive = Layer.effect(
  CrdtLayer,
  Effect.gen(function*() {
    const config = yield* CrdtLayerConfig
    const sheetId = config.sheetId

    let lamportClock = 0
    const cellClocks = new Map<string, { clock: number; agentId: string }>()
    const opsLog: OpLogEntry[] = []

    const receiveClock = (remote: number): void => {
      lamportClock = Math.max(lamportClock, remote) + 1
    }

    const shouldApply = (key: string, op: CellOp): MergeResult => {
      const current = cellClocks.get(key)
      if (!current) return { applied: true, reason: "accepted", winningClock: op.clock, winningAgent: op.agentId }
      if (op.clock > current.clock) return { applied: true, reason: "accepted", winningClock: op.clock, winningAgent: op.agentId }
      if (op.clock < current.clock) return { applied: false, reason: "rejected-stale", winningClock: current.clock, winningAgent: current.agentId }
      // Equal clocks — tiebreak by agent_id (lexicographic, higher wins)
      if (op.agentId > current.agentId) return { applied: true, reason: "accepted", winningClock: op.clock, winningAgent: op.agentId }
      return { applied: false, reason: "rejected-tiebreak", winningClock: current.clock, winningAgent: current.agentId }
    }

    return CrdtLayer.of({
      apply: (op) => Effect.sync(() => {
        const key = cellKey(sheetId, { col: op.col, row: op.row })
        receiveClock(op.clock)
        const result = shouldApply(key, op)
        opsLog.push({
          ...op,
          outcome: result.reason === "accepted" ? "applied" : result.reason,
          timestamp: new Date().toISOString(),
        })
        if (result.applied) {
          cellClocks.set(key, { clock: op.clock, agentId: op.agentId })
          config.onApply(op)
        }
        return result
      }),

      merge: (ops) => Effect.forEach(ops, (op) =>
        Effect.sync(() => {
          const key = cellKey(sheetId, { col: op.col, row: op.row })
          receiveClock(op.clock)
          const result = shouldApply(key, op)
          opsLog.push({
            ...op,
            outcome: result.reason === "accepted" ? "applied" : result.reason,
            timestamp: new Date().toISOString(),
          })
          if (result.applied) {
            cellClocks.set(key, { clock: op.clock, agentId: op.agentId })
            config.onApply(op)
          }
          return result
        }),
      ),

      clock: () => lamportClock,
      tick: () => ++lamportClock,
      agentId: config.agentId,
      cellClock: (addr) => cellClocks.get(cellKey(sheetId, addr))?.clock ?? 0,
      recentOps: (limit = 100) => opsLog.slice(-limit),
    })
  }),
)
