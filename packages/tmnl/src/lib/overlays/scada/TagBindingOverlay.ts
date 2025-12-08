/**
 * TagBinding Overlay
 *
 * Reactive overlay that binds to tag process values.
 * This is a VIEW overlay — it responds to port data, not user events.
 *
 * Port convention: tag:{tagId}:pv
 *
 * @example
 * ```tsx
 * // Register overlay
 * useOverlay({ containerId, overlay: createTagBindingOverlay("FIC-101") })
 *
 * // Subscribe to tag value
 * const { value } = usePort<NumericTagValue>({
 *   containerId,
 *   portId: tagPort.pv("FIC-101" as TagId),
 * })
 * ```
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Overlay, createOverlay } from "../Overlay"
import type { OverlayId, PortId, ContainerId } from "../schemas"
import {
  type TagId,
  type NumericTagValue,
  type TagQuality,
  tagPort,
} from "./types"

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/** TagBinding overlay configuration */
export interface TagBindingConfig {
  /** Tag identifier */
  readonly tagId: TagId
  /** Optional display name */
  readonly name?: string
  /** Quality threshold below which value is considered unreliable */
  readonly qualityThreshold?: TagQuality
  /** Update debounce in ms (default: 0) */
  readonly debounceMs?: number
}

// ─────────────────────────────────────────────────────────────
// Quality Utilities
// ─────────────────────────────────────────────────────────────

const QUALITY_RANK: Record<TagQuality, number> = {
  good: 4,
  uncertain: 3,
  stale: 2,
  bad: 1,
}

/** Check if quality meets threshold */
export const qualityMeetsThreshold = (
  quality: TagQuality,
  threshold: TagQuality
): boolean => QUALITY_RANK[quality] >= QUALITY_RANK[threshold]

/** Get quality color for rendering */
export const getQualityColor = (quality: TagQuality): string => {
  switch (quality) {
    case "good":
      return "#22c55e" // green-500
    case "uncertain":
      return "#f59e0b" // amber-500
    case "stale":
      return "#6b7280" // gray-500
    case "bad":
      return "#ef4444" // red-500
  }
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create a TagBinding overlay for a specific tag.
 *
 * TagBinding is a REACTIVE overlay — it subscribes to a port and
 * updates when data arrives. It doesn't handle user events directly.
 *
 * @param config - Tag binding configuration
 * @returns Overlay instance
 *
 * @example
 * ```tsx
 * const flowControllerOverlay = createTagBindingOverlay({
 *   tagId: "FIC-101" as TagId,
 *   name: "Flow Controller 101",
 *   qualityThreshold: "uncertain",
 * })
 *
 * // In component
 * useOverlay({ containerId, overlay: flowControllerOverlay })
 * ```
 */
export const createTagBindingOverlay = (config: TagBindingConfig): Overlay => {
  const { tagId, name, qualityThreshold = "bad" } = config
  const overlayId = `tag-binding:${tagId}` as OverlayId
  const pvPort = tagPort.pv(tagId)

  return createOverlay({
    id: overlayId,
    name: name ?? `Tag: ${tagId}`,
    visualPriority: 0, // Reactive overlays don't compete for visual priority

    // Reactive overlays don't typically handle pointer events
    // They respond to port messages instead
    handlers: {},

    // Port declarations
    ports: {
      subscriptions: [pvPort],
      publications: [], // TagBinding is read-only
    },

    // Called when overlay is enabled
    onEnable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[TagBinding] Enabled for ${tagId} in ${containerId}`)
        yield* Effect.log(`[TagBinding] Subscribing to ${pvPort}`)
      }),

    // Called when overlay is disabled
    onDisable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[TagBinding] Disabled for ${tagId} in ${containerId}`)
      }),
  })
}

// ─────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────

import { useCallback, useMemo } from "react"
import { useOverlay, usePort } from "../hooks"
import type { UseOverlayResult } from "../hooks/useOverlay"

/** Result of useTagBinding hook */
export interface UseTagBindingResult {
  /** Current tag value */
  readonly value: number | undefined
  /** Current quality */
  readonly quality: TagQuality | undefined
  /** Timestamp of last update */
  readonly timestamp: number | undefined
  /** Engineering units */
  readonly units: string | undefined
  /** Whether quality meets threshold */
  readonly isReliable: boolean
  /** Quality indicator color */
  readonly qualityColor: string
  /** Whether overlay is active */
  readonly isActive: boolean
  /** Raw tag value object */
  readonly tagValue: NumericTagValue | undefined
  /** Overlay control */
  readonly overlay: UseOverlayResult
}

/** Options for useTagBinding hook */
export interface UseTagBindingOptions {
  /** Container ID */
  readonly containerId: ContainerId
  /** Tag ID to bind */
  readonly tagId: TagId
  /** Optional display name */
  readonly name?: string
  /** Quality threshold (default: "bad") */
  readonly qualityThreshold?: TagQuality
  /** Auto-enable overlay on mount (default: true) */
  readonly autoEnable?: boolean
}

/**
 * Hook to bind to a tag's process value with quality tracking.
 *
 * @param options - Binding options
 * @returns Tag binding result with value, quality, and overlay control
 *
 * @example
 * ```tsx
 * function TagDisplay({ containerId, tagId }: Props) {
 *   const { value, quality, isReliable, qualityColor } = useTagBinding({
 *     containerId,
 *     tagId: tagId as TagId,
 *     qualityThreshold: "uncertain",
 *   })
 *
 *   return (
 *     <div style={{ borderColor: qualityColor }}>
 *       <span>{value?.toFixed(2) ?? "—"}</span>
 *       {!isReliable && <span>⚠️ Unreliable</span>}
 *     </div>
 *   )
 * }
 * ```
 */
export const useTagBinding = (options: UseTagBindingOptions): UseTagBindingResult => {
  const {
    containerId,
    tagId,
    name,
    qualityThreshold = "bad",
    autoEnable = true,
  } = options

  // Create overlay instance (memoized)
  const overlayInstance = useMemo(
    () =>
      createTagBindingOverlay({
        tagId,
        name,
        qualityThreshold,
      }),
    [tagId, name, qualityThreshold]
  )

  // Register and manage overlay
  const overlay = useOverlay({
    containerId,
    overlay: overlayInstance,
    autoRegister: true,
    autoEnable,
  })

  // Subscribe to tag value port
  const port = usePort<NumericTagValue>({
    containerId,
    portId: tagPort.pv(tagId),
  })

  // Derive convenience values
  const tagValue = port.value
  const quality = tagValue?.quality
  const isReliable = quality ? qualityMeetsThreshold(quality, qualityThreshold) : false
  const qualityColor = quality ? getQualityColor(quality) : "#6b7280"

  return {
    value: tagValue?.value,
    quality,
    timestamp: tagValue?.timestamp,
    units: tagValue?.units,
    isReliable,
    qualityColor,
    isActive: overlay.isActive,
    tagValue,
    overlay,
  }
}

// ─────────────────────────────────────────────────────────────
// Simulation Helper (for testing)
// ─────────────────────────────────────────────────────────────

/**
 * Create a simulated tag value for testing.
 *
 * @param value - Numeric value
 * @param quality - Quality indicator
 * @param units - Engineering units
 * @returns NumericTagValue object
 */
export const createTagValue = (
  value: number,
  quality: TagQuality = "good",
  units?: string
): NumericTagValue => ({
  _tag: "TagValue",
  value,
  quality,
  timestamp: Date.now(),
  units,
})
