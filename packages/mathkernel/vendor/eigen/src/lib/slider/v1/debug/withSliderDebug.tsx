/**
 * withSliderDebug HOC
 *
 * Higher-order component that wraps a slider with a debug overlay.
 * Shows internal state, behavior info, and sensitivity in real-time.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import type { SliderProps } from '../components/Slider'
import type { SliderDebugInfo, SliderBehaviorShape, SliderConfig } from '../types'
import { useSlider } from '../hooks/useSlider'
import { LinearBehavior } from '../services/SliderBehavior'

// =============================================================================
// DEBUG OVERLAY COMPONENT
// =============================================================================

interface DebugOverlayProps {
  debugInfo: SliderDebugInfo
  isExpanded: boolean
  onToggle: () => void
}

function DebugOverlay({ debugInfo, isExpanded, onToggle }: DebugOverlayProps) {
  return (
    <div
      className={`
        absolute z-50 font-mono text-xs
        bg-neutral-900/95 border border-cyan-800/50 rounded-lg shadow-xl
        transition-all duration-200 overflow-hidden
        ${isExpanded ? 'w-64' : 'w-8'}
      `}
      style={{ top: '-8px', right: '-8px' }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/50 rounded"
      >
        {isExpanded ? '×' : '🔍'}
      </button>

      {isExpanded && (
        <div className="p-3 pt-8 space-y-2">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-700">
            <span className="text-cyan-400">⚙</span>
            <span className="text-cyan-300 font-semibold">Slider Debug</span>
          </div>

          {/* Behavior */}
          <DebugRow label="behavior" value={debugInfo.behaviorName} highlight />

          {/* Values */}
          <DebugSection title="Values">
            <DebugRow label="raw" value={debugInfo.rawValue.toFixed(4)} />
            <DebugRow label="normalized" value={debugInfo.normalizedValue.toFixed(4)} />
            <DebugRow label="display" value={debugInfo.displayValue} />
          </DebugSection>

          {/* Range */}
          <DebugSection title="Range">
            <DebugRow label="min" value={debugInfo.min} />
            <DebugRow label="max" value={debugInfo.max} />
            <DebugRow label="step" value={debugInfo.step ?? 'continuous'} />
          </DebugSection>

          {/* State */}
          <DebugSection title="State">
            <DebugRow
              label="dragging"
              value={debugInfo.isDragging ? 'YES' : 'no'}
              highlight={debugInfo.isDragging}
            />
            <DebugRow
              label="focused"
              value={debugInfo.isFocused ? 'YES' : 'no'}
              highlight={debugInfo.isFocused}
            />
            <DebugRow
              label="editing"
              value={debugInfo.isEditing ? 'YES' : 'no'}
              highlight={debugInfo.isEditing}
            />
          </DebugSection>

          {/* Sensitivity */}
          <DebugSection title="Sensitivity">
            <DebugRow label="base" value={`${debugInfo.baseSensitivity}x`} />
            <DebugRow
              label="active"
              value={`${debugInfo.activeSensitivity}x`}
              highlight={debugInfo.activeSensitivity !== debugInfo.baseSensitivity}
            />
            <DebugRow
              label="modifiers"
              value={debugInfo.activeModifiers.length > 0 ? debugInfo.activeModifiers.join('+') : 'none'}
            />
          </DebugSection>

          {/* Visual curve preview */}
          <div className="pt-2 border-t border-neutral-700">
            <div className="text-neutral-500 mb-1">Value Curve</div>
            <CurvePreview normalizedValue={debugInfo.normalizedValue} />
          </div>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// DEBUG SUB-COMPONENTS
// =============================================================================

function DebugSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-neutral-500 uppercase tracking-wider mb-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function DebugRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-neutral-500">{label}:</span>
      <span className={highlight ? 'text-cyan-400' : 'text-neutral-300'}>{value}</span>
    </div>
  )
}

function CurvePreview({ normalizedValue }: { normalizedValue: number }) {
  const width = 220
  const height = 40

  return (
    <svg width={width} height={height} className="bg-neutral-800 rounded">
      {/* Grid */}
      <line x1={width / 2} y1={0} x2={width / 2} y2={height} stroke="#444" strokeWidth={0.5} />
      <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#444" strokeWidth={0.5} />

      {/* Value marker */}
      <line
        x1={normalizedValue * width}
        y1={0}
        x2={normalizedValue * width}
        y2={height}
        stroke="#22d3ee"
        strokeWidth={2}
      />

      {/* Value dot */}
      <circle
        cx={normalizedValue * width}
        cy={height / 2}
        r={4}
        fill="#22d3ee"
      />
    </svg>
  )
}

// =============================================================================
// HOC IMPLEMENTATION
// =============================================================================

export interface WithSliderDebugOptions {
  /** Initial expanded state */
  defaultExpanded?: boolean

  /** Position of debug overlay */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
}

/**
 * HOC that wraps a slider component with debug overlay.
 *
 * Usage:
 * ```tsx
 * const DebugSlider = withSliderDebug(Slider)
 * // or
 * const DebugSlider = withSliderDebug(Slider, { defaultExpanded: true })
 * ```
 */
export function withSliderDebug<P extends SliderProps>(
  SliderComponent: React.ComponentType<P>,
  options: WithSliderDebugOptions = {}
) {
  const { defaultExpanded = false, position = 'top-right' } = options

  return function DebugSliderWrapper(props: P) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded)

    // We need to intercept the slider to get debug info
    // This requires duplicating some slider logic
    const behavior = props.behavior ?? LinearBehavior.shape
    const slider = useSlider({
      value: props.value,
      controlledValue: props.controlledValue,
      onChange: props.onChange,
      onChangeEnd: props.onChangeEnd,
      config: props.config,
      behavior,
      debug: true,
    })

    const toggleExpanded = useCallback(() => setIsExpanded((e) => !e), [])

    // Position classes
    const positionClasses = {
      'top-right': 'top-0 right-0',
      'top-left': 'top-0 left-0',
      'bottom-right': 'bottom-0 right-0',
      'bottom-left': 'bottom-0 left-0',
    }

    return (
      <div className="relative">
        <SliderComponent {...props} />

        {slider.debugInfo && (
          <div className={`absolute ${positionClasses[position]}`}>
            <DebugOverlay
              debugInfo={slider.debugInfo}
              isExpanded={isExpanded}
              onToggle={toggleExpanded}
            />
          </div>
        )}
      </div>
    )
  }
}

// =============================================================================
// STANDALONE DEBUG PANEL
// =============================================================================

/**
 * Standalone debug panel that can be used alongside any slider.
 * Useful when you want the debug info in a separate location.
 */
export function SliderDebugPanel({
  debugInfo,
  className = '',
}: {
  debugInfo: SliderDebugInfo | null
  className?: string
}) {
  if (!debugInfo) {
    return (
      <div className={`p-4 bg-neutral-900 border border-neutral-700 rounded-lg ${className}`}>
        <div className="text-neutral-500 text-sm font-mono">No debug info available</div>
      </div>
    )
  }

  return (
    <div className={`p-4 bg-neutral-900 border border-neutral-700 rounded-lg space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-neutral-700">
        <span className="text-cyan-400">⚙</span>
        <span className="text-cyan-300 font-mono font-semibold">Slider Debug</span>
        <span className="text-neutral-500 text-xs">({debugInfo.behaviorName})</span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-sm font-mono">
        {/* Values Column */}
        <div>
          <div className="text-neutral-500 text-xs uppercase mb-2">Values</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">raw:</span>
              <span className="text-neutral-300">{debugInfo.rawValue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">norm:</span>
              <span className="text-neutral-300">{debugInfo.normalizedValue.toFixed(3)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">display:</span>
              <span className="text-cyan-400">{debugInfo.displayValue}</span>
            </div>
          </div>
        </div>

        {/* State Column */}
        <div>
          <div className="text-neutral-500 text-xs uppercase mb-2">State</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">drag:</span>
              <span className={debugInfo.isDragging ? 'text-green-400' : 'text-neutral-600'}>
                {debugInfo.isDragging ? 'YES' : 'no'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">focus:</span>
              <span className={debugInfo.isFocused ? 'text-green-400' : 'text-neutral-600'}>
                {debugInfo.isFocused ? 'YES' : 'no'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">edit:</span>
              <span className={debugInfo.isEditing ? 'text-green-400' : 'text-neutral-600'}>
                {debugInfo.isEditing ? 'YES' : 'no'}
              </span>
            </div>
          </div>
        </div>

        {/* Sensitivity Column */}
        <div>
          <div className="text-neutral-500 text-xs uppercase mb-2">Sensitivity</div>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-500">base:</span>
              <span className="text-neutral-300">{debugInfo.baseSensitivity}x</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">active:</span>
              <span
                className={
                  debugInfo.activeSensitivity !== debugInfo.baseSensitivity
                    ? 'text-amber-400'
                    : 'text-neutral-300'
                }
              >
                {debugInfo.activeSensitivity}x
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">mods:</span>
              <span className="text-neutral-300">
                {debugInfo.activeModifiers.length > 0
                  ? debugInfo.activeModifiers.join('+')
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Visual indicator bar */}
      <div className="pt-2 border-t border-neutral-700">
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-cyan-500 transition-all duration-100"
            style={{ width: `${debugInfo.normalizedValue * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-neutral-500">
          <span>{debugInfo.min}</span>
          <span>{debugInfo.max}</span>
        </div>
      </div>
    </div>
  )
}

export default withSliderDebug
