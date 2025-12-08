/**
 * Alarm Overlay
 *
 * Reactive overlay for alarm annunciation with state machine for
 * acknowledgment, shelving, and clearing operations.
 *
 * Port convention: alarm:{tagId}:active, alarm:{tagId}:state
 *
 * State Machine:
 * ```
 *            ┌─────────────┐
 *   activate │             │ clear
 *      ┌────►│   ACTIVE    ├────┐
 *      │     │             │    │
 *      │     └──────┬──────┘    │
 *      │            │           │
 *      │       ack  │           ▼
 *      │            ▼      ┌─────────────┐
 *      │     ┌──────────┐  │             │
 *      │     │          │  │   CLEARED   │
 *      └─────┤   ACKED  │  │             │
 *    rearm   │          │  └─────────────┘
 *            └────┬─────┘
 *                 │
 *            shelve│
 *                 ▼
 *          ┌───────────┐
 *          │           │
 *          │  SHELVED  │
 *          │           │
 *          └───────────┘
 * ```
 *
 * @example
 * ```tsx
 * const { alarm, acknowledge, shelve, unshelve } = useAlarm({
 *   containerId,
 *   tagId: "FIC-101" as TagId,
 * })
 *
 * return (
 *   <AlarmBanner
 *     alarm={alarm}
 *     onAcknowledge={acknowledge}
 *     onShelve={() => shelve("8h")}
 *   />
 * )
 * ```
 */

import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import { Overlay, createOverlay } from "../Overlay"
import type { OverlayId, PortId, ContainerId } from "../schemas"
import {
  type TagId,
  type Alarm,
  type AlarmPriority,
  type AlarmState,
  alarmPort,
} from "./types"

// ─────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────

/** Alarm overlay configuration */
export interface AlarmOverlayConfig {
  /** Tag identifier for the alarm */
  readonly tagId: TagId
  /** Alarm priority */
  readonly priority: AlarmPriority
  /** Alarm message */
  readonly message: string
  /** Optional custom name */
  readonly name?: string
  /** Auto-acknowledge after duration (ms), disabled if undefined */
  readonly autoAckMs?: number
  /** Shelve duration options (e.g., ["1h", "8h", "24h"]) */
  readonly shelveDurations?: readonly string[]
}

// ─────────────────────────────────────────────────────────────
// Priority Utilities
// ─────────────────────────────────────────────────────────────

const PRIORITY_RANK: Record<AlarmPriority, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
}

/** Get priority color for rendering */
export const getPriorityColor = (priority: AlarmPriority): string => {
  switch (priority) {
    case "critical":
      return "#ef4444" // red-500
    case "high":
      return "#f97316" // orange-500
    case "medium":
      return "#f59e0b" // amber-500
    case "low":
      return "#3b82f6" // blue-500
    case "info":
      return "#6b7280" // gray-500
  }
}

/** Get state indicator style */
export const getStateStyle = (
  state: AlarmState
): { color: string; pulse: boolean } => {
  switch (state) {
    case "active":
      return { color: "#ef4444", pulse: true }
    case "acknowledged":
      return { color: "#f59e0b", pulse: false }
    case "cleared":
      return { color: "#22c55e", pulse: false }
    case "shelved":
      return { color: "#6b7280", pulse: false }
  }
}

// ─────────────────────────────────────────────────────────────
// Alarm State Machine Helpers
// ─────────────────────────────────────────────────────────────

/** State transitions for alarm machine */
export type AlarmAction =
  | { readonly type: "ACTIVATE" }
  | { readonly type: "ACKNOWLEDGE"; readonly by: string }
  | { readonly type: "CLEAR" }
  | { readonly type: "SHELVE"; readonly until: number }
  | { readonly type: "UNSHELVE" }
  | { readonly type: "REARM" }

/** Apply action to alarm state */
export const applyAlarmAction = (
  alarm: Alarm,
  action: AlarmAction
): Alarm => {
  switch (action.type) {
    case "ACTIVATE":
      return {
        ...alarm,
        state: "active",
        timestamp: Date.now(),
        acknowledgedBy: undefined,
        acknowledgedAt: undefined,
      }

    case "ACKNOWLEDGE":
      if (alarm.state !== "active") return alarm
      return {
        ...alarm,
        state: "acknowledged",
        acknowledgedBy: action.by,
        acknowledgedAt: Date.now(),
      }

    case "CLEAR":
      return {
        ...alarm,
        state: "cleared",
        timestamp: Date.now(),
      }

    case "SHELVE":
      if (alarm.state !== "acknowledged") return alarm
      return {
        ...alarm,
        state: "shelved",
      }

    case "UNSHELVE":
      if (alarm.state !== "shelved") return alarm
      return {
        ...alarm,
        state: "acknowledged",
      }

    case "REARM":
      if (alarm.state === "active") return alarm
      return {
        ...alarm,
        state: "active",
        timestamp: Date.now(),
        acknowledgedBy: undefined,
        acknowledgedAt: undefined,
      }
  }
}

// ─────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create an Alarm overlay for a specific tag.
 *
 * @param config - Alarm configuration
 * @returns Overlay instance
 */
export const createAlarmOverlay = (config: AlarmOverlayConfig): Overlay => {
  const { tagId, priority, message, name } = config
  const overlayId = `alarm:${tagId}` as OverlayId
  const activePort = alarmPort.active(tagId)
  const statePort = alarmPort.state(tagId)

  return createOverlay({
    id: overlayId,
    name: name ?? `Alarm: ${tagId}`,
    visualPriority: PRIORITY_RANK[priority] * 10, // Higher priority = higher visual

    // Reactive overlay — responds to port data
    handlers: {},

    ports: {
      subscriptions: [activePort, statePort],
      publications: [statePort],
    },

    onEnable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Alarm] Enabled alarm for ${tagId} in ${containerId}`)
        yield* Effect.log(`[Alarm] Priority: ${priority}, Message: ${message}`)
      }),

    onDisable: (containerId: ContainerId) =>
      Effect.gen(function* () {
        yield* Effect.log(`[Alarm] Disabled alarm for ${tagId} in ${containerId}`)
      }),
  })
}

// ─────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────

import { useCallback, useMemo } from "react"
import { useOverlay, usePort, usePublish } from "../hooks"
import type { UseOverlayResult } from "../hooks/useOverlay"

/** Result of useAlarm hook */
export interface UseAlarmResult {
  /** Current alarm state */
  readonly alarm: Alarm | undefined
  /** Whether alarm is active */
  readonly isActive: boolean
  /** Whether alarm is acknowledged */
  readonly isAcknowledged: boolean
  /** Whether alarm is shelved */
  readonly isShelved: boolean
  /** Whether alarm is cleared */
  readonly isCleared: boolean
  /** Priority color */
  readonly priorityColor: string
  /** State style (color + pulse) */
  readonly stateStyle: { color: string; pulse: boolean }
  /** Acknowledge the alarm */
  readonly acknowledge: (by?: string) => void
  /** Shelve the alarm */
  readonly shelve: (durationMs?: number) => void
  /** Unshelve the alarm */
  readonly unshelve: () => void
  /** Clear the alarm */
  readonly clear: () => void
  /** Rearm the alarm (make it active again) */
  readonly rearm: () => void
  /** Overlay control */
  readonly overlay: UseOverlayResult
}

/** Options for useAlarm hook */
export interface UseAlarmOptions {
  /** Container ID */
  readonly containerId: ContainerId
  /** Tag ID */
  readonly tagId: TagId
  /** Priority (default: "medium") */
  readonly priority?: AlarmPriority
  /** Alarm message */
  readonly message?: string
  /** Auto-enable on mount (default: true) */
  readonly autoEnable?: boolean
}

/**
 * Hook for alarm state management.
 *
 * @param options - Alarm options
 * @returns Alarm state and control functions
 */
export const useAlarm = (options: UseAlarmOptions): UseAlarmResult => {
  const {
    containerId,
    tagId,
    priority = "medium",
    message = `Alarm on ${tagId}`,
    autoEnable = true,
  } = options

  // Create overlay instance
  const overlayInstance = useMemo(
    () =>
      createAlarmOverlay({
        tagId,
        priority,
        message,
      }),
    [tagId, priority, message]
  )

  // Register overlay
  const overlay = useOverlay({
    containerId,
    overlay: overlayInstance,
    autoRegister: true,
    autoEnable,
  })

  // Subscribe to alarm state
  const port = usePort<Alarm>({
    containerId,
    portId: alarmPort.state(tagId),
  })

  // Publisher for state changes
  const publish = usePublish<Alarm>(containerId, alarmPort.state(tagId))

  const alarm = port.value

  // Action handlers
  const acknowledge = useCallback(
    (by: string = "operator") => {
      if (!alarm) return
      const next = applyAlarmAction(alarm, { type: "ACKNOWLEDGE", by })
      publish(next)
    },
    [alarm, publish]
  )

  const shelve = useCallback(
    (durationMs: number = 8 * 60 * 60 * 1000) => {
      if (!alarm) return
      const next = applyAlarmAction(alarm, {
        type: "SHELVE",
        until: Date.now() + durationMs,
      })
      publish(next)
    },
    [alarm, publish]
  )

  const unshelve = useCallback(() => {
    if (!alarm) return
    const next = applyAlarmAction(alarm, { type: "UNSHELVE" })
    publish(next)
  }, [alarm, publish])

  const clear = useCallback(() => {
    if (!alarm) return
    const next = applyAlarmAction(alarm, { type: "CLEAR" })
    publish(next)
  }, [alarm, publish])

  const rearm = useCallback(() => {
    if (!alarm) return
    const next = applyAlarmAction(alarm, { type: "REARM" })
    publish(next)
  }, [alarm, publish])

  // Derived state
  const isActive = alarm?.state === "active"
  const isAcknowledged = alarm?.state === "acknowledged"
  const isShelved = alarm?.state === "shelved"
  const isCleared = alarm?.state === "cleared"
  const priorityColor = alarm ? getPriorityColor(alarm.priority) : "#6b7280"
  const stateStyle = alarm
    ? getStateStyle(alarm.state)
    : { color: "#6b7280", pulse: false }

  return {
    alarm,
    isActive,
    isAcknowledged,
    isShelved,
    isCleared,
    priorityColor,
    stateStyle,
    acknowledge,
    shelve,
    unshelve,
    clear,
    rearm,
    overlay,
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Helper (for testing)
// ─────────────────────────────────────────────────────────────

/**
 * Create an alarm instance for testing.
 */
export const createAlarm = (
  tagId: TagId,
  priority: AlarmPriority,
  message: string,
  state: AlarmState = "active"
): Alarm => ({
  _tag: "Alarm",
  tagId,
  priority,
  state,
  message,
  timestamp: Date.now(),
})
