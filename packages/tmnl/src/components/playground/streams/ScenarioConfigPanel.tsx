/**
 * ScenarioConfigPanel - Unified stress test configuration UI
 *
 * Controls:
 * - Throughput slider (logarithmic: 1 → 10k)
 * - Duration input (0-300s)
 * - Payload profile dropdown (SenML/OPC-UA/Prometheus)
 * - Size tier badges (S/M/L)
 * - Preset dropdown (quick selection)
 *
 * @module
 */

import { useAtom } from '@effect-atom/atom-react'
import {
  scenarioConfigAtom,
  type UnifiedScenarioConfig,
} from '@/lib/streams/playground/atoms'
import {
  SCENARIO_PRESETS,
  PAYLOAD_PROFILE_META,
  PAYLOAD_TIER_META,
  type PayloadProfile,
  type PayloadTier,
  type ScenarioPresetKey,
  UnifiedScenarioConfig as UnifiedScenarioConfigClass,
} from '@/lib/streams/playground/scenarios/types'

// ============================================================================
// LOGARITHMIC SLIDER
// ============================================================================

interface LogSliderProps {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
}

/**
 * Logarithmic slider for exponential ranges (1 → 10k).
 */
function LogSlider({ value, min, max, onChange, disabled }: LogSliderProps) {
  // Convert linear to log scale
  const logMin = Math.log10(min)
  const logMax = Math.log10(max)
  const logValue = Math.log10(Math.max(min, value))

  // Linear position (0-100)
  const position = ((logValue - logMin) / (logMax - logMin)) * 100

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const linearPos = parseFloat(e.target.value)
    const logVal = logMin + (linearPos / 100) * (logMax - logMin)
    const actualValue = Math.round(Math.pow(10, logVal))
    onChange(Math.max(min, Math.min(max, actualValue)))
  }

  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={0.5}
        value={position}
        onChange={handleChange}
        disabled={disabled}
        className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <span
        className="min-w-[4rem] text-right font-mono tabular-nums"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {value.toLocaleString()}
      </span>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface ScenarioConfigPanelProps {
  /** Whether the scenario is currently running */
  isRunning?: boolean
  /** Callback when config changes */
  onConfigChange?: (config: UnifiedScenarioConfig) => void
}

export function ScenarioConfigPanel({
  isRunning = false,
  onConfigChange,
}: ScenarioConfigPanelProps) {
  const [config, setConfig] = useAtom(scenarioConfigAtom)

  const updateConfig = (partial: Partial<{
    eventsPerSecond: number
    durationSec: number
    payloadProfile: PayloadProfile
    payloadTier: PayloadTier
  }>) => {
    const newConfig = new UnifiedScenarioConfigClass({
      eventsPerSecond: partial.eventsPerSecond ?? config.eventsPerSecond,
      durationSec: partial.durationSec ?? config.durationSec,
      payloadProfile: partial.payloadProfile ?? config.payloadProfile,
      payloadTier: partial.payloadTier ?? config.payloadTier,
      burst: config.burst,
      failureRate: config.failureRate,
    })
    setConfig(newConfig)
    onConfigChange?.(newConfig)
  }

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const key = e.target.value as ScenarioPresetKey
    if (key && SCENARIO_PRESETS[key]) {
      const preset = SCENARIO_PRESETS[key]
      setConfig(preset)
      onConfigChange?.(preset)
    }
  }

  return (
    <div className="space-y-4 p-4 bg-neutral-900/80 rounded-lg border border-neutral-700/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          className="font-semibold text-neutral-200 uppercase tracking-wide"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Scenario Configuration
        </h3>
        {isRunning && (
          <span
            className="px-2 py-0.5 bg-cyan-600/20 text-cyan-400 rounded border border-cyan-600/30"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            RUNNING
          </span>
        )}
      </div>

      {/* Presets */}
      <div>
        <label
          className="block text-neutral-400 uppercase tracking-wide mb-1.5"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Preset
        </label>
        <select
          onChange={handlePresetChange}
          disabled={isRunning}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-cyan-500"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          defaultValue=""
        >
          <option value="">-- Select Preset --</option>
          {(Object.keys(SCENARIO_PRESETS) as ScenarioPresetKey[]).map((key) => (
            <option key={key} value={key}>
              {key.replace(/-/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Throughput */}
      <div>
        <label
          className="block text-neutral-400 uppercase tracking-wide mb-1.5"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Events/sec
        </label>
        <LogSlider
          value={config.eventsPerSecond}
          min={1}
          max={10000}
          onChange={(v) => updateConfig({ eventsPerSecond: v })}
          disabled={isRunning}
        />
      </div>

      {/* Duration */}
      <div>
        <label
          className="block text-neutral-400 uppercase tracking-wide mb-1.5"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Duration (seconds)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={300}
            value={config.durationSec}
            onChange={(e) => updateConfig({ durationSec: parseInt(e.target.value, 10) || 0 })}
            disabled={isRunning}
            className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 font-mono tabular-nums disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-cyan-500"
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          />
          <span
            className="text-neutral-500"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {config.durationSec === 0 ? '(indefinite)' : ''}
          </span>
        </div>
      </div>

      {/* Payload Profile */}
      <div>
        <label
          className="block text-neutral-400 uppercase tracking-wide mb-1.5"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Payload Profile
        </label>
        <select
          value={config.payloadProfile}
          onChange={(e) => updateConfig({ payloadProfile: e.target.value as PayloadProfile })}
          disabled={isRunning}
          className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-cyan-500"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {(Object.entries(PAYLOAD_PROFILE_META) as [PayloadProfile, typeof PAYLOAD_PROFILE_META['senml']][]).map(
            ([key, meta]) => (
              <option key={key} value={key}>
                {meta.icon} {meta.name}
              </option>
            )
          )}
        </select>
        <p
          className="mt-1 text-neutral-500"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {PAYLOAD_PROFILE_META[config.payloadProfile].description}
        </p>
      </div>

      {/* Payload Size Tier */}
      <div>
        <label
          className="block text-neutral-400 uppercase tracking-wide mb-1.5"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Payload Size
        </label>
        <div className="flex gap-2">
          {(Object.entries(PAYLOAD_TIER_META) as [PayloadTier, typeof PAYLOAD_TIER_META['small']][]).map(
            ([tier, meta]) => (
              <button
                key={tier}
                onClick={() => updateConfig({ payloadTier: tier })}
                disabled={isRunning}
                className={`
                  flex-1 px-3 py-2 rounded border transition-colors
                  disabled:cursor-not-allowed
                  ${
                    config.payloadTier === tier
                      ? 'bg-cyan-600/30 border-cyan-500 text-cyan-300'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'
                  }
                `}
              >
                <div
                  className="font-bold"
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  {meta.label}
                </div>
                <div
                  className="text-neutral-500"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {meta.size}
                </div>
              </button>
            )
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="pt-3 border-t border-neutral-700/50">
        <div
          className="flex justify-between text-neutral-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          <span>Estimated throughput:</span>
          <span className="font-mono text-cyan-400">
            ~{((config.eventsPerSecond * (PAYLOAD_TIER_META[config.payloadTier].size === '~0.5 kB' ? 512 : config.payloadTier === 'medium' ? 3072 : 20480)) / 1024 / 1024).toFixed(2)} MB/s
          </span>
        </div>
      </div>
    </div>
  )
}
