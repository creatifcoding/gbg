import type { FaultKind, FaultOperation, FaultScenario, FaultStep, FaultTargetLayer } from "./faults.js"

export interface FaultMatchInput {
  readonly atMs: number
  readonly targetLayer: FaultTargetLayer
  readonly operation: FaultOperation
  readonly attempt?: number
}

export interface FaultMatch {
  readonly step: FaultStep
  readonly fault: FaultKind
}

export interface FaultMockDriver {
  readonly scenario: FaultScenario
  readonly match: (input: FaultMatchInput) => FaultMatch | null
  readonly shouldFail: (input: FaultMatchInput) => boolean
}

const stepIsActive = (step: FaultStep, atMs: number): boolean => {
  if (atMs < step.atMs) return false
  const durationMs = step.durationMs
  if (durationMs === undefined) return atMs === step.atMs
  return atMs < step.atMs + durationMs
}

const attemptIsActive = (step: FaultStep, attempt: number | undefined): boolean => {
  if (step.failCount === undefined) return true
  return (attempt ?? 1) <= step.failCount
}

export const makeFaultMockDriver = (scenario: FaultScenario): FaultMockDriver => {
  const orderedSteps = [...scenario.steps].sort((a, b) => a.atMs - b.atMs || a.stepId.localeCompare(b.stepId))

  const match = (input: FaultMatchInput): FaultMatch | null => {
    const step = orderedSteps.find((candidate) =>
      candidate.mode === "mock" &&
      candidate.targetLayer === input.targetLayer &&
      candidate.operation === input.operation &&
      stepIsActive(candidate, input.atMs) &&
      attemptIsActive(candidate, input.attempt),
    )
    return step === undefined ? null : { step, fault: step.fault }
  }

  return {
    scenario,
    match,
    shouldFail: (input) => match(input) !== null,
  }
}
