/**
 * SPIKE S3 — CRDT Cells
 *
 * Prove concurrent cell edits merge correctly.
 * LWW registers with Lamport clocks, tiebreak by agent_id.
 *
 * H7: Two agents write different cells → both values present after merge
 * H8: Concurrent write to same cell → LWW by Lamport clock
 * H9: Operations logged for audit trail
 */

import { describe, it, expect } from "vitest"
import {
  type CellValue,
  num, str, extractNumber,
  cellKey, type ColRow,
} from "../src/index.js"

// ─── CRDT types ─────────────────────────────────────

interface CellOp {
  readonly sheetId: string
  readonly col: number
  readonly row: number
  readonly payload: CellValue
  readonly clock: number
  readonly agentId: string
  readonly timestamp: number
}

interface MergeResult {
  readonly applied: boolean
  readonly winner: CellOp
  readonly loser?: CellOp
}

// ─── Spike CrdtLayer ────────────────────────────────

class SpikeCrdtLayer {
  private cells: Map<string, CellOp> = new Map()
  private localClocks: Map<string, number> = new Map() // agentId → clock
  private opsLog: CellOp[] = []

  /** Get or init clock for an agent */
  getClock(agentId: string): number {
    return this.localClocks.get(agentId) ?? 0
  }

  /** Create a local write operation */
  localWrite(agentId: string, addr: ColRow, payload: CellValue, sheetId = "default"): CellOp {
    const clock = this.getClock(agentId) + 1
    this.localClocks.set(agentId, clock)

    const op: CellOp = {
      sheetId,
      col: addr.col,
      row: addr.row,
      payload,
      clock,
      agentId,
      timestamp: Date.now(),
    }

    return op
  }

  /** Apply an operation (local or remote) */
  apply(op: CellOp): MergeResult {
    const key = cellKey(op.sheetId, { col: op.col, row: op.row })

    // Update local clock: max(local, remote) + 1
    const currentClock = this.getClock(op.agentId)
    this.localClocks.set(op.agentId, Math.max(currentClock, op.clock))

    const existing = this.cells.get(key)

    if (!existing) {
      // First write — always apply
      this.cells.set(key, op)
      this.opsLog.push({ ...op })
      return { applied: true, winner: op }
    }

    // LWW: higher clock wins
    if (op.clock > existing.clock) {
      this.cells.set(key, op)
      this.opsLog.push({ ...op })
      return { applied: true, winner: op, loser: existing }
    }

    if (op.clock < existing.clock) {
      this.opsLog.push({ ...op })
      return { applied: false, winner: existing, loser: op }
    }

    // Equal clock — tiebreak by agent_id (lexicographic, higher wins)
    if (op.agentId > existing.agentId) {
      this.cells.set(key, op)
      this.opsLog.push({ ...op })
      return { applied: true, winner: op, loser: existing }
    }

    this.opsLog.push({ ...op })
    return { applied: false, winner: existing, loser: op }
  }

  /** Bulk merge */
  merge(ops: CellOp[]): MergeResult[] {
    return ops.map((op) => this.apply(op))
  }

  /** Get current cell value */
  get(addr: ColRow, sheetId = "default"): CellValue | undefined {
    const key = cellKey(sheetId, addr)
    return this.cells.get(key)?.payload
  }

  get log(): readonly CellOp[] {
    return this.opsLog
  }

  get cellCount(): number {
    return this.cells.size
  }
}

// ─── Tests ──────────────────────────────────────────

describe("S3: CRDT Cells", () => {

  it("H7: two agents write different cells → both present", () => {
    const crdt = new SpikeCrdtLayer()

    const opA = crdt.localWrite("agent-a", { col: 0, row: 0 }, num(10))
    const opB = crdt.localWrite("agent-b", { col: 1, row: 0 }, num(20))

    const [resA, resB] = crdt.merge([opA, opB])

    expect(resA.applied).toBe(true)
    expect(resB.applied).toBe(true)

    expect(extractNumber(crdt.get({ col: 0, row: 0 })!)).toBe(10)
    expect(extractNumber(crdt.get({ col: 1, row: 0 })!)).toBe(20)
    expect(crdt.cellCount).toBe(2)
  })

  it("H8: concurrent write to same cell → higher clock wins", () => {
    const crdt = new SpikeCrdtLayer()

    // Agent A writes first (clock 1)
    const opA = crdt.localWrite("agent-a", { col: 0, row: 0 }, num(10))
    crdt.apply(opA)

    // Agent B writes second (clock 1 on its own counter)
    // But agent B bumps clock manually to simulate higher clock
    const opB: CellOp = {
      sheetId: "default",
      col: 0,
      row: 0,
      payload: num(20),
      clock: 5, // Higher clock
      agentId: "agent-b",
      timestamp: Date.now(),
    }

    const result = crdt.apply(opB)

    expect(result.applied).toBe(true)
    expect(result.winner.agentId).toBe("agent-b")
    expect(result.loser?.agentId).toBe("agent-a")
    expect(extractNumber(crdt.get({ col: 0, row: 0 })!)).toBe(20)
  })

  it("H8: equal clock → tiebreak by agent_id (lexicographic)", () => {
    const crdt = new SpikeCrdtLayer()

    const opA: CellOp = {
      sheetId: "default", col: 0, row: 0,
      payload: num(10), clock: 5, agentId: "agent-a", timestamp: Date.now(),
    }
    const opB: CellOp = {
      sheetId: "default", col: 0, row: 0,
      payload: num(20), clock: 5, agentId: "agent-b", timestamp: Date.now(),
    }

    crdt.apply(opA) // agent-a writes first
    const result = crdt.apply(opB) // agent-b same clock

    // "agent-b" > "agent-a" lexicographically → agent-b wins
    expect(result.applied).toBe(true)
    expect(result.winner.agentId).toBe("agent-b")
    expect(extractNumber(crdt.get({ col: 0, row: 0 })!)).toBe(20)
  })

  it("H8: lower clock loses even if later timestamp", () => {
    const crdt = new SpikeCrdtLayer()

    const opHigh: CellOp = {
      sheetId: "default", col: 0, row: 0,
      payload: num(100), clock: 10, agentId: "agent-a", timestamp: Date.now() - 1000,
    }
    const opLow: CellOp = {
      sheetId: "default", col: 0, row: 0,
      payload: num(1), clock: 3, agentId: "agent-b", timestamp: Date.now(), // newer but lower clock
    }

    crdt.apply(opHigh)
    const result = crdt.apply(opLow)

    expect(result.applied).toBe(false)
    expect(result.winner.clock).toBe(10)
    expect(extractNumber(crdt.get({ col: 0, row: 0 })!)).toBe(100)
  })

  it("H9: all operations logged for audit trail", () => {
    const crdt = new SpikeCrdtLayer()

    const op1 = crdt.localWrite("agent-a", { col: 0, row: 0 }, num(1))
    const op2 = crdt.localWrite("agent-b", { col: 0, row: 0 }, num(2))
    const op3 = crdt.localWrite("agent-a", { col: 1, row: 0 }, str("hello"))

    crdt.apply(op1)
    crdt.apply(op2)
    crdt.apply(op3)

    expect(crdt.log.length).toBe(3)
    expect(crdt.log[0].agentId).toBe("agent-a")
    expect(crdt.log[1].agentId).toBe("agent-b")
    expect(crdt.log[2].agentId).toBe("agent-a")
  })

  it("merge throughput: 100K ops in < 200ms", () => {
    const crdt = new SpikeCrdtLayer()

    // Generate 100K ops from 10 agents, each writing to different cells
    const ops: CellOp[] = []
    for (let i = 0; i < 100_000; i++) {
      ops.push({
        sheetId: "default",
        col: i % 1000,
        row: Math.floor(i / 1000),
        payload: num(i),
        clock: Math.floor(i / 10_000) + 1,
        agentId: `agent-${i % 10}`,
        timestamp: Date.now(),
      })
    }

    const start = performance.now()
    const results = crdt.merge(ops)
    const elapsed = performance.now() - start

    const applied = results.filter((r) => r.applied).length
    console.log(`  S3/merge-perf: 100K ops merged in ${elapsed.toFixed(2)}ms (${(100_000 / elapsed * 1000).toFixed(0)} ops/sec, ${applied} applied)`)
    expect(elapsed).toBeLessThan(200)
    expect(applied).toBeGreaterThan(0)
  })

  it("conflict rate: 10 agents × 1000 writes to same 100 cells", () => {
    const crdt = new SpikeCrdtLayer()

    const ops: CellOp[] = []
    for (let agent = 0; agent < 10; agent++) {
      for (let write = 0; write < 1000; write++) {
        ops.push({
          sheetId: "default",
          col: write % 10,
          row: Math.floor(write / 10) % 10,
          payload: num(agent * 1000 + write),
          clock: write + 1,
          agentId: `agent-${String.fromCharCode(65 + agent)}`, // A-J
          timestamp: Date.now() + write,
        })
      }
    }

    const start = performance.now()
    const results = crdt.merge(ops)
    const elapsed = performance.now() - start

    const applied = results.filter((r) => r.applied).length
    const rejected = results.filter((r) => !r.applied).length
    console.log(`  S3/conflict-rate: ${applied} applied, ${rejected} rejected in ${elapsed.toFixed(2)}ms`)
    expect(applied + rejected).toBe(10_000)
    expect(crdt.cellCount).toBe(100) // Only 100 unique cells
  })
})
