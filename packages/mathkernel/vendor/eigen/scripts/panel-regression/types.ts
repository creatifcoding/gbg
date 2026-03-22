/**
 * Panel regression test types — combinatorial fuzzing harness.
 *
 * @module panel-regression/types
 */

import type { ExpectedPanelState } from './assertions'

// ─── Atomic Operation ────────────────────────────────────────────────────────

export interface Op {
  readonly tag: string
  readonly label: string
  readonly keys: readonly string[]   // agent-browser `press` args
  readonly wait?: number             // ms after last key (default: 150)
}

// ─── Checkpoint ──────────────────────────────────────────────────────────────

export interface Checkpoint {
  readonly _type: 'checkpoint'
  readonly name: string
  readonly description?: string
  /** Expected state assertions — verified against runtime stx snapshot */
  readonly expect?: ExpectedPanelState
  readonly verifyFn?: (ctx: RunContext) => Promise<VerifyResult>
}

export interface VerifyResult {
  passed: boolean
  message: string
  actual?: string
  expected?: string
}

// ─── Scenario ────────────────────────────────────────────────────────────────

export type Step = Op | Checkpoint

export interface Scenario {
  readonly id: string             // petname
  readonly title: string
  readonly description: string
  readonly steps: readonly Step[]
  readonly modes: readonly ('strip' | 'tree' | 'both')[]
  readonly tags: readonly string[]
}

// ─── Run Context ─────────────────────────────────────────────────────────────

export interface RunContext {
  readonly runId: string
  readonly scenarioId: string
  screenshotDir: string
  readonly baseUrl: string
  readonly session: string
  screenshotIndex: number
}

// ─── Run Result ──────────────────────────────────────────────────────────────

export interface Screenshot {
  readonly name: string
  readonly path: string
  readonly step: number
  readonly timestamp: number
}

export interface StepLog {
  readonly index: number
  readonly tag: string
  readonly label: string
  readonly timestamp: number
  readonly durationMs: number
  readonly error?: string
}

export interface ScenarioResult {
  readonly scenarioId: string
  readonly title: string
  readonly runId: string
  readonly mode: string
  readonly passed: boolean
  readonly screenshots: Screenshot[]
  readonly steps: StepLog[]
  readonly errors: string[]
  readonly durationMs: number
  readonly startedAt: string
}

export interface RunReport {
  readonly runId: string
  readonly startedAt: string
  readonly completedAt: string
  readonly totalScenarios: number
  readonly passed: number
  readonly failed: number
  readonly scenarios: ScenarioResult[]
}
