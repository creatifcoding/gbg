/**
 * KORI Scenario Runner Panel
 *
 * Predefined stress test scenarios with step-by-step execution.
 * Metrics: entities/sec, queue depth, flush latency.
 *
 * @module
 */

import { useCallback } from "react"

import { useStxData, useStx } from "@/lib/stx"
import {
  getKoriTestbedStx,
  type Scenario,
  type ScenarioStep,
  type ScenarioStepStatus,
} from "../kori-testbed-stx"

// =============================================================================
// Status Indicator
// =============================================================================

const StatusDot = ({ status }: { status: ScenarioStepStatus }) => {
  const colors: Record<ScenarioStepStatus, string> = {
    pending: "bg-neutral-600",
    running: "bg-amber-400 animate-pulse",
    passed: "bg-green-400",
    failed: "bg-red-400",
    skipped: "bg-neutral-500",
  }

  return <div className={`w-2 h-2 rounded-full ${colors[status]}`} />
}

// =============================================================================
// Scenario Card
// =============================================================================

interface ScenarioCardProps {
  scenario: Scenario
  onRun: () => void
  onReset: () => void
}

function ScenarioCard({ scenario, onRun, onReset }: ScenarioCardProps) {
  const isRunning = scenario.status === "running"
  const isComplete = scenario.status === "passed" || scenario.status === "failed"

  const statusColors = {
    idle: "text-neutral-500",
    running: "text-amber-400",
    paused: "text-amber-400",
    passed: "text-green-400",
    failed: "text-red-400",
  }

  const duration =
    scenario.completedAt && scenario.startedAt
      ? scenario.completedAt - scenario.startedAt
      : null

  return (
    <div className="border border-neutral-800 rounded bg-neutral-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span
            className="font-mono text-neutral-200"
            style={{ fontSize: "var(--tmnl-text-sm, 14px)" }}
          >
            {scenario.name}
          </span>
          <span
            className={`font-mono uppercase ${statusColors[scenario.status]}`}
            style={{ fontSize: "10px" }}
          >
            {scenario.status}
          </span>
          {duration && (
            <span
              className="font-mono text-neutral-500"
              style={{ fontSize: "10px" }}
            >
              {duration}ms
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {!isRunning && (
            <button
              onClick={onRun}
              className="px-2 py-0.5 text-cyan-400 hover:bg-cyan-400/10 rounded font-mono"
              style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
            >
              Run
            </button>
          )}
          {isComplete && (
            <button
              onClick={onReset}
              className="px-2 py-0.5 text-neutral-400 hover:bg-neutral-400/10 rounded font-mono"
              style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <div
        className="px-2 py-1 text-neutral-500 border-b border-neutral-800/50"
        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      >
        {scenario.description}
      </div>

      {/* Steps */}
      <div className="p-2 space-y-1">
        {scenario.steps.map((step, idx) => (
          <StepRow key={step.id} step={step} index={idx} />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// Step Row
// =============================================================================

interface StepRowProps {
  step: ScenarioStep
  index: number
}

function StepRow({ step, index }: StepRowProps) {
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={step.status} />
      <span
        className="text-neutral-600 font-mono"
        style={{ fontSize: "10px", minWidth: "16px" }}
      >
        {index + 1}.
      </span>
      <span
        className={`font-mono ${
          step.status === "running"
            ? "text-amber-400"
            : step.status === "passed"
            ? "text-green-400"
            : step.status === "failed"
            ? "text-red-400"
            : "text-neutral-400"
        }`}
        style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
      >
        {step.label}
      </span>
      {step.durationMs !== undefined && (
        <span
          className="text-neutral-600 font-mono"
          style={{ fontSize: "10px" }}
        >
          {step.durationMs}ms
        </span>
      )}
      {step.error && (
        <span
          className="text-red-400 font-mono truncate max-w-[150px]"
          style={{ fontSize: "10px" }}
          title={step.error}
        >
          {step.error}
        </span>
      )}
    </div>
  )
}

// =============================================================================
// Component
// =============================================================================

export function ScenarioPanel() {
  const testbed = getKoriTestbedStx()
  const { runEffect } = useStx(testbed)

  const scenarios = useStxData(testbed, (d) => d.scenarios.get())
  const entities = useStxData(testbed, (d) => d.entities.get())

  const handleRun = useCallback(
    (scenarioId: string) => {
      runEffect("runScenario", scenarioId)
    },
    [runEffect]
  )

  const handleReset = useCallback(
    (scenarioId: string) => {
      runEffect("resetScenario", scenarioId)
    },
    [runEffect]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-neutral-800">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          SCENARIOS
        </span>
        <span
          className="font-mono text-cyan-400"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          {entities.length} entities
        </span>
      </div>

      {/* Scenarios List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {scenarios.map((scenario) => (
          <ScenarioCard
            key={scenario.id}
            scenario={scenario as Scenario}
            onRun={() => handleRun(scenario.id)}
            onReset={() => handleReset(scenario.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-neutral-800 bg-neutral-900/50">
        <div
          className="text-neutral-600"
          style={{ fontSize: "var(--tmnl-text-xs, 12px)" }}
        >
          Click "Run" to execute a scenario. Steps execute sequentially.
        </div>
      </div>
    </div>
  )
}
