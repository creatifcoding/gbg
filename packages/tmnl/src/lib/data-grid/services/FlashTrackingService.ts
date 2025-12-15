/**
 * FlashTrackingService
 *
 * Effect-based service for managing cell flash states.
 * Tracks severity-based visual feedback for data changes.
 *
 * @module
 */

import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as SubscriptionRef from 'effect/SubscriptionRef'
import type { FlashState, FlashSeverity, FlashDirection, CellId } from '../types'
import { makeCellId } from '../types'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default TTL for flashes in milliseconds */
export const DEFAULT_FLASH_TTL = 1500

/** Default maximum delta for intensity calculation */
export const DEFAULT_MAX_DELTA = 20

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
export function calculateIntensity(delta: number, maxDelta: number = DEFAULT_MAX_DELTA): number {
  const absDelta = Math.abs(delta)
  if (absDelta === 0) return 0

  // Logarithmic scaling: small changes visible, large changes don't overwhelm
  const normalized = Math.min(absDelta / maxDelta, 1)
  return Math.min(0.3 + normalized * 0.7, 1) // Range: 0.3 to 1.0
}

/**
 * Determine flash direction from delta.
 */
export function getDirection(delta: number): FlashDirection {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'neutral'
}

/**
 * Create a FlashState from delta value.
 */
export function createFlashState(
  cellId: CellId,
  delta: number,
  maxDelta: number = DEFAULT_MAX_DELTA,
  ttl: number = DEFAULT_FLASH_TTL
): FlashState {
  return {
    cellId,
    severity: calculateSeverity(delta),
    intensity: calculateIntensity(delta, maxDelta),
    direction: getDirection(delta),
    delta,
    timestamp: Date.now(),
    ttl,
    isActive: delta !== 0,
  }
}

// =============================================================================
// SERVICE INTERFACE
// =============================================================================

export interface FlashTrackingServiceApi {
  /**
   * Trigger a flash on a cell.
   */
  readonly flash: (
    rowId: string,
    field: string,
    delta: number,
    ttl?: number
  ) => Effect.Effect<void>

  /**
   * Clear flash for a specific cell.
   */
  readonly clearFlash: (rowId: string, field: string) => Effect.Effect<void>

  /**
   * Clear all flashes.
   */
  readonly clearAll: Effect.Effect<void>

  /**
   * Get current flashes map.
   */
  readonly getFlashes: Effect.Effect<ReadonlyMap<CellId, FlashState>>

  /**
   * Get flash state for a specific cell.
   */
  readonly getFlashState: (rowId: string, field: string) => Effect.Effect<FlashState | undefined>

  /**
   * Check if a cell has an active flash.
   */
  readonly hasFlash: (rowId: string, field: string) => Effect.Effect<boolean>

  /**
   * Subscribe to flash changes.
   */
  readonly subscribe: (
    handler: (flashes: ReadonlyMap<CellId, FlashState>) => void
  ) => Effect.Effect<() => void>

  /**
   * Cleanup expired flashes.
   */
  readonly cleanup: Effect.Effect<number>
}

// =============================================================================
// SERVICE TAG
// =============================================================================

export class FlashTrackingService extends Context.Tag('tmnl/data-grid/FlashTrackingService')<
  FlashTrackingService,
  FlashTrackingServiceApi
>() {}

// =============================================================================
// SERVICE CONFIGURATION
// =============================================================================

export interface FlashTrackingConfig {
  /** Maximum delta for intensity calculation */
  maxDelta: number
  /** Default TTL for flashes */
  defaultTtl: number
}

export const defaultFlashTrackingConfig: FlashTrackingConfig = {
  maxDelta: DEFAULT_MAX_DELTA,
  defaultTtl: DEFAULT_FLASH_TTL,
}

// =============================================================================
// SERVICE IMPLEMENTATION
// =============================================================================

const makeFlashTrackingService = (config: FlashTrackingConfig = defaultFlashTrackingConfig) =>
  Effect.gen(function* () {
    // SubscriptionRef for reactive state
    const flashesRef = yield* SubscriptionRef.make<Map<CellId, FlashState>>(new Map())

    return FlashTrackingService.of({
      flash: (rowId, field, delta, ttl = config.defaultTtl) =>
        Effect.gen(function* () {
          const cellId = makeCellId(rowId, field)
          const state = createFlashState(cellId, delta, config.maxDelta, ttl)

          yield* SubscriptionRef.update(flashesRef, (map) => {
            const next = new Map(map)
            next.set(cellId, state)
            return next
          })

          yield* Effect.logDebug(`[Flash] ${cellId}: ${state.severity} (delta: ${delta})`)
        }),

      clearFlash: (rowId, field) =>
        Effect.gen(function* () {
          const cellId = makeCellId(rowId, field)

          yield* SubscriptionRef.update(flashesRef, (map) => {
            const next = new Map(map)
            next.delete(cellId)
            return next
          })
        }),

      clearAll: SubscriptionRef.set(flashesRef, new Map()),

      getFlashes: Effect.map(SubscriptionRef.get(flashesRef), (map) => map as ReadonlyMap<CellId, FlashState>),

      getFlashState: (rowId, field) =>
        Effect.gen(function* () {
          const cellId = makeCellId(rowId, field)
          const flashes = yield* SubscriptionRef.get(flashesRef)
          return flashes.get(cellId)
        }),

      hasFlash: (rowId, field) =>
        Effect.gen(function* () {
          const cellId = makeCellId(rowId, field)
          const flashes = yield* SubscriptionRef.get(flashesRef)
          const state = flashes.get(cellId)
          return state?.isActive ?? false
        }),

      subscribe: (handler) =>
        Effect.gen(function* () {
          const changes = yield* SubscriptionRef.changes(flashesRef)

          const fiber = yield* Effect.fork(
            Effect.forEach(changes, (flashes) =>
              Effect.sync(() => handler(flashes as ReadonlyMap<CellId, FlashState>))
            )
          )

          return () => {
            Effect.runFork(Effect.interruptWith(fiber, fiber.id()))
          }
        }),

      cleanup: Effect.gen(function* () {
        const now = Date.now()
        let removed = 0

        yield* SubscriptionRef.update(flashesRef, (map) => {
          const next = new Map<CellId, FlashState>()

          for (const [cellId, state] of map) {
            if (now - state.timestamp < state.ttl) {
              next.set(cellId, state)
            } else {
              removed++
            }
          }

          return next
        })

        if (removed > 0) {
          yield* Effect.logDebug(`[Flash] Cleaned up ${removed} expired flashes`)
        }

        return removed
      }),
    })
  })

// =============================================================================
// SERVICE LAYERS
// =============================================================================

/**
 * Default FlashTrackingService layer.
 */
export const FlashTrackingServiceLive = Layer.effect(
  FlashTrackingService,
  makeFlashTrackingService()
)

/**
 * Create a custom FlashTrackingService layer with configuration.
 */
export const FlashTrackingServiceCustom = (config: Partial<FlashTrackingConfig>) =>
  Layer.effect(
    FlashTrackingService,
    makeFlashTrackingService({ ...defaultFlashTrackingConfig, ...config })
  )

// =============================================================================
// NOTE: calculateSeverity, calculateIntensity, getDirection, createFlashState
// are already exported above at line 35-86
// =============================================================================
