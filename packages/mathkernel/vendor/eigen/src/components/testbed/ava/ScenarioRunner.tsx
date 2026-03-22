/**
 * AVA Scenario Runner
 *
 * Predefined test sequences for validating AVA client behavior.
 * Supports run/pause/reset with step-by-step visualization.
 *
 * @pattern stx tri-library composition
 * @module
 */

import { useCallback } from 'react'

import { useStxData, useStx } from '@/lib/stx'
import {
  getTestbedStx,
  type Scenario,
  type ScenarioStep,
  type ScenarioStatus,
  type ScenarioStepStatus,
} from './testbed-stx'

// =============================================================================
// Helpers
// =============================================================================

const getStatusColor = (status: ScenarioStatus | ScenarioStepStatus): string => {
  switch (status) {
    case 'passed':
      return '#22c55e' // green
    case 'failed':
      return '#ef4444' // red
    case 'running':
      return '#22d3ee' // cyan
    case 'paused':
      return '#f59e0b' // amber
    case 'skipped':
      return '#737373' // gray
    default:
      return '#525252' // neutral
  }
}

const getStatusIcon = (status: ScenarioStepStatus): string => {
  switch (status) {
    case 'passed':
      return '✓'
    case 'failed':
      return '✗'
    case 'running':
      return '●'
    case 'skipped':
      return '○'
    default:
      return '○'
  }
}

// =============================================================================
// Sub-Components
// =============================================================================

interface ScenarioCardProps {
  scenario: Scenario
  onRun: () => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
}

function ScenarioCard({ scenario, onRun, onPause, onResume, onReset }: ScenarioCardProps) {
  const isRunning = scenario.status === 'running'
  const isPaused = scenario.status === 'paused'
  const isComplete = scenario.status === 'passed' || scenario.status === 'failed'

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getStatusColor(scenario.status) }}
          />
          <span
            className="font-mono text-neutral-200"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {scenario.name}
          </span>
        </div>
        <span
          className="font-mono uppercase"
          style={{
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: getStatusColor(scenario.status),
          }}
        >
          {scenario.status}
        </span>
      </div>

      {/* Description */}
      <p
        className="text-neutral-500 mb-3"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {scenario.description}
      </p>

      {/* Steps */}
      <div className="space-y-1 mb-3">
        {scenario.steps.map((step, idx) => (
          <div
            key={step.id}
            className={`flex items-center gap-2 px-2 py-1 rounded ${
              idx === scenario.currentStepIndex && isRunning
                ? 'bg-cyan-950/30 border border-cyan-800/50'
                : ''
            }`}
          >
            <span
              className={`font-mono ${step.status === 'running' ? 'animate-pulse' : ''}`}
              style={{
                fontSize: 'var(--tmnl-text-xs, 12px)',
                color: getStatusColor(step.status),
              }}
            >
              {getStatusIcon(step.status)}
            </span>
            <span
              className="font-mono flex-1"
              style={{
                fontSize: 'var(--tmnl-text-xs, 12px)',
                color: step.status === 'pending' ? '#525252' : '#a3a3a3',
              }}
            >
              {step.label}
            </span>
            {step.durationMs !== undefined && (
              <span
                className="font-mono text-neutral-600"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {step.durationMs}ms
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Error Display */}
      {scenario.steps.some(s => s.error) && (
        <div
          className="mb-3 p-2 bg-red-950/30 border border-red-800/50 rounded"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <span className="text-red-400 font-mono">
            {scenario.steps.find(s => s.error)?.error}
          </span>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2">
        {!isRunning && !isPaused && (
          <button
            onClick={onRun}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-mono transition-colors"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Run
          </button>
        )}
        {isRunning && (
          <button
            onClick={onPause}
            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-mono transition-colors"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Pause
          </button>
        )}
        {isPaused && (
          <button
            onClick={onResume}
            className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-mono transition-colors"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Resume
          </button>
        )}
        {(isComplete || isPaused) && (
          <button
            onClick={onReset}
            className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded font-mono transition-colors"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function ScenarioRunner() {
  const testbed = getTestbedStx()
  const { runEffect } = useStx(testbed)

  // Subscribe to scenario state
  const scenarios = useStxData(testbed, d => d.scenarios.get())
  const activeScenarioId = useStxData(testbed, d => d.activeScenarioId.get())

  // Handlers
  const handleRun = useCallback((scenarioId: string) => {
    runEffect('runScenario', scenarioId).catch(() => {})
  }, [runEffect])

  const handlePause = useCallback((scenarioId: string) => {
    runEffect('pauseScenario', scenarioId).catch(() => {})
  }, [runEffect])

  const handleResume = useCallback((scenarioId: string) => {
    runEffect('resumeScenario', scenarioId).catch(() => {})
  }, [runEffect])

  const handleReset = useCallback((scenarioId: string) => {
    runEffect('resetScenario', scenarioId).catch(() => {})
  }, [runEffect])

  const handleResetAll = useCallback(() => {
    runEffect('resetAllScenarios').catch(() => {})
  }, [runEffect])

  // Statistics
  const passed = scenarios.filter(s => s.status === 'passed').length
  const failed = scenarios.filter(s => s.status === 'failed').length
  const total = scenarios.length

  return (
    <div className="flex flex-col h-full bg-neutral-950 border border-neutral-800 rounded overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/50">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          SCENARIO RUNNER
        </span>
        <div className="flex items-center gap-3">
          <span
            className="font-mono"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            <span className="text-green-500">{passed}</span>
            <span className="text-neutral-600"> / </span>
            <span className="text-red-500">{failed}</span>
            <span className="text-neutral-600"> / </span>
            <span className="text-neutral-400">{total}</span>
          </span>
          <button
            onClick={handleResetAll}
            className="px-2 py-1 text-neutral-500 hover:text-neutral-300 font-mono transition-colors"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="flex-1 overflow-auto p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {scenarios.map((scenario: Scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              onRun={() => handleRun(scenario.id)}
              onPause={() => handlePause(scenario.id)}
              onResume={() => handleResume(scenario.id)}
              onReset={() => handleReset(scenario.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
