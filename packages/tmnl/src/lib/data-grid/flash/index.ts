/**
 * Hybrid Flash System
 *
 * Combines AG-Grid's native flash with custom severity-based visual feedback.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                         FLASH SYSTEM                                │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  Native Flash (AG-Grid)         │  Custom Flash (Renderer)         │
 * │  ─────────────────────────────  │  ──────────────────────────────  │
 * │  • Simple up/down indication    │  • Severity-based intensity      │
 * │  • enableCellChangeFlash=true   │  • Delta-proportional glow       │
 * │  • Uses flashCells() API        │  • Status change pulse           │
 * │  • Controlled by variant.flash  │  • Custom animation timing       │
 * └─────────────────────────────────┴───────────────────────────────────┘
 * ```
 *
 * ## Severity Mapping
 *
 * | Delta Range | Severity | Intensity | Visual Effect           |
 * |-------------|----------|-----------|-------------------------|
 * | 0           | none     | 0         | No flash                |
 * | 1-5         | low      | 0.3       | Subtle background pulse |
 * | 6-10        | medium   | 0.6       | Visible background glow |
 * | 11-15       | high     | 0.8       | Strong background glow  |
 * | 16+         | critical | 1.0       | Full glow + border      |
 */

import type { GridVariantType, FlashColorsType } from '../schemas'

// =============================================================================
// FLASH SEVERITY
// =============================================================================

export type FlashSeverity = 'none' | 'low' | 'medium' | 'high' | 'critical'

export interface FlashState {
  /** Severity level based on delta magnitude */
  severity: FlashSeverity
  /** Intensity 0-1 for visual effects */
  intensity: number
  /** Direction: up (positive), down (negative), or neutral */
  direction: 'up' | 'down' | 'neutral'
  /** Raw delta value */
  delta: number
  /** Timestamp when flash was triggered */
  timestamp: number
  /** Whether flash is currently active */
  isActive: boolean
}

// =============================================================================
// SEVERITY CALCULATION
// =============================================================================

/**
 * Calculate flash severity from delta magnitude.
 */
export function calculateSeverity(delta: number): FlashSeverity {
  const absDelta = Math.abs(delta)

  if (absDelta === 0) return 'none'
  if (absDelta <= 5) return 'low'
  if (absDelta <= 10) return 'medium'
  if (absDelta <= 15) return 'high'
  return 'critical'
}

/**
 * Calculate intensity (0-1) from delta magnitude.
 * Uses logarithmic scaling for perceptual uniformity.
 */
export function calculateIntensity(delta: number, maxDelta: number = 20): number {
  const absDelta = Math.abs(delta)
  if (absDelta === 0) return 0

  // Logarithmic scaling: small changes visible, large changes don't overwhelm
  const normalized = Math.min(absDelta / maxDelta, 1)
  return Math.min(0.3 + normalized * 0.7, 1) // Range: 0.3 to 1.0
}

/**
 * Create a complete flash state from a delta value.
 */
export function createFlashState(delta: number, maxDelta: number = 20): FlashState {
  return {
    severity: calculateSeverity(delta),
    intensity: calculateIntensity(delta, maxDelta),
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral',
    delta,
    timestamp: Date.now(),
    isActive: delta !== 0,
  }
}

// =============================================================================
// CSS GENERATION
// =============================================================================

export interface FlashStyleConfig {
  /** Flash colors from variant */
  colors: FlashColorsType
  /** Animation duration multiplier (1.0 = default) */
  durationScale?: number
  /** Maximum delta for intensity calculation */
  maxDelta?: number
}

/**
 * Generate CSS styles for flash effect.
 */
export function generateFlashStyles(
  state: FlashState,
  config: FlashStyleConfig
): React.CSSProperties {
  if (!state.isActive || state.severity === 'none') {
    return {}
  }

  const { colors, durationScale = 1 } = config
  const baseColor = state.direction === 'up' ? colors.up : colors.down
  const duration = colors.durationMs * durationScale

  // Base styles
  const styles: React.CSSProperties = {
    transition: `background-color ${duration}ms ease-out, box-shadow ${duration}ms ease-out`,
  }

  // Severity-based effects
  switch (state.severity) {
    case 'low':
      styles.backgroundColor = `${baseColor}15` // 15% opacity
      break
    case 'medium':
      styles.backgroundColor = `${baseColor}25` // 25% opacity
      break
    case 'high':
      styles.backgroundColor = `${baseColor}40` // 40% opacity
      styles.boxShadow = `inset 0 0 8px ${baseColor}30`
      break
    case 'critical':
      styles.backgroundColor = `${baseColor}50` // 50% opacity
      styles.boxShadow = `inset 0 0 12px ${baseColor}50, 0 0 4px ${baseColor}30`
      break
  }

  return styles
}

/**
 * Generate CSS keyframes for flash animation.
 * Returns a style object with animation property.
 */
export function generateFlashAnimation(
  state: FlashState,
  config: FlashStyleConfig
): React.CSSProperties {
  if (!state.isActive || state.severity === 'none') {
    return {}
  }

  const { colors, durationScale = 1 } = config
  const duration = colors.durationMs * durationScale

  // Animation name based on direction and intensity
  const animationName = `flash-${state.direction}-${state.severity}`

  return {
    animation: `${animationName} ${duration}ms ease-out forwards`,
  }
}

// =============================================================================
// FLASH TRACKER
// =============================================================================

export interface FlashTracker {
  /** Map of row ID -> field -> flash state */
  states: Map<string, Map<string, FlashState>>
  /** Update flash state for a cell */
  update: (rowId: string, field: string, delta: number) => void
  /** Get flash state for a cell */
  get: (rowId: string, field: string) => FlashState | undefined
  /** Clear expired flashes */
  cleanup: (maxAgeMs: number) => void
  /** Clear all flashes */
  clear: () => void
}

/**
 * Create a flash state tracker for managing cell flash states.
 */
export function createFlashTracker(maxDelta: number = 20): FlashTracker {
  const states = new Map<string, Map<string, FlashState>>()

  return {
    states,

    update(rowId: string, field: string, delta: number) {
      if (!states.has(rowId)) {
        states.set(rowId, new Map())
      }
      states.get(rowId)!.set(field, createFlashState(delta, maxDelta))
    },

    get(rowId: string, field: string) {
      return states.get(rowId)?.get(field)
    },

    cleanup(maxAgeMs: number) {
      const now = Date.now()
      for (const [rowId, fields] of states) {
        for (const [field, state] of fields) {
          if (now - state.timestamp > maxAgeMs) {
            fields.delete(field)
          }
        }
        if (fields.size === 0) {
          states.delete(rowId)
        }
      }
    },

    clear() {
      states.clear()
    },
  }
}

// =============================================================================
// REACT HOOK
// =============================================================================

import { useRef, useCallback, useEffect } from 'react'
import type { RowUpdate } from '../mocking'

export interface UseFlashTrackerOptions {
  /** Maximum delta for intensity calculation */
  maxDelta?: number
  /** Auto-cleanup interval in ms (0 to disable) */
  cleanupIntervalMs?: number
  /** Flash expiration time in ms */
  flashExpirationMs?: number
}

export interface UseFlashTrackerResult {
  /** Process updates from stream */
  processUpdates: (updates: readonly RowUpdate[]) => void
  /** Get flash state for a cell */
  getFlashState: (rowId: string, field: string) => FlashState | undefined
  /** Check if a cell has an active flash */
  hasFlash: (rowId: string, field: string) => boolean
  /** Clear all flash states */
  clearAll: () => void
}

/**
 * React hook for tracking cell flash states.
 */
export function useFlashTracker(
  options: UseFlashTrackerOptions = {}
): UseFlashTrackerResult {
  const {
    maxDelta = 20,
    cleanupIntervalMs = 2000,
    flashExpirationMs = 1500,
  } = options

  const trackerRef = useRef(createFlashTracker(maxDelta))

  // Auto-cleanup expired flashes
  useEffect(() => {
    if (cleanupIntervalMs <= 0) return

    const handle = setInterval(() => {
      trackerRef.current.cleanup(flashExpirationMs)
    }, cleanupIntervalMs)

    return () => clearInterval(handle)
  }, [cleanupIntervalMs, flashExpirationMs])

  const processUpdates = useCallback((updates: readonly RowUpdate[]) => {
    for (const update of updates) {
      if (update.field === 'value' && typeof update.delta === 'number') {
        trackerRef.current.update(update.id, update.field, update.delta)
      } else if (update.field === 'status') {
        // Status changes get a fixed "medium" intensity flash
        trackerRef.current.update(update.id, update.field, 8)
      }
    }
  }, [])

  const getFlashState = useCallback((rowId: string, field: string) => {
    return trackerRef.current.get(rowId, field)
  }, [])

  const hasFlash = useCallback((rowId: string, field: string) => {
    const state = trackerRef.current.get(rowId, field)
    return state?.isActive ?? false
  }, [])

  const clearAll = useCallback(() => {
    trackerRef.current.clear()
  }, [])

  return {
    processUpdates,
    getFlashState,
    hasFlash,
    clearAll,
  }
}

// =============================================================================
// CSS KEYFRAMES (inject once)
// =============================================================================

let keyframesInjected = false

/**
 * Inject flash keyframe animations into document head.
 * Call once at app startup.
 */
export function injectFlashKeyframes(colors: FlashColorsType): void {
  if (keyframesInjected || typeof document === 'undefined') return

  const style = document.createElement('style')
  style.id = 'tmnl-flash-keyframes'
  style.textContent = `
    @keyframes flash-up-low {
      0% { background-color: ${colors.up}15; }
      100% { background-color: transparent; }
    }
    @keyframes flash-up-medium {
      0% { background-color: ${colors.up}25; }
      100% { background-color: transparent; }
    }
    @keyframes flash-up-high {
      0% { background-color: ${colors.up}40; box-shadow: inset 0 0 8px ${colors.up}30; }
      100% { background-color: transparent; box-shadow: none; }
    }
    @keyframes flash-up-critical {
      0% { background-color: ${colors.up}50; box-shadow: inset 0 0 12px ${colors.up}50, 0 0 4px ${colors.up}30; }
      100% { background-color: transparent; box-shadow: none; }
    }
    @keyframes flash-down-low {
      0% { background-color: ${colors.down}15; }
      100% { background-color: transparent; }
    }
    @keyframes flash-down-medium {
      0% { background-color: ${colors.down}25; }
      100% { background-color: transparent; }
    }
    @keyframes flash-down-high {
      0% { background-color: ${colors.down}40; box-shadow: inset 0 0 8px ${colors.down}30; }
      100% { background-color: transparent; box-shadow: none; }
    }
    @keyframes flash-down-critical {
      0% { background-color: ${colors.down}50; box-shadow: inset 0 0 12px ${colors.down}50, 0 0 4px ${colors.down}30; }
      100% { background-color: transparent; box-shadow: none; }
    }
    @keyframes flash-neutral-low {
      0% { background-color: rgba(255, 255, 255, 0.1); }
      100% { background-color: transparent; }
    }
    @keyframes flash-neutral-medium {
      0% { background-color: rgba(255, 255, 255, 0.15); }
      100% { background-color: transparent; }
    }
  `

  document.head.appendChild(style)
  keyframesInjected = true
}
