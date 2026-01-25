/**
 * useIdleDetection Hook
 *
 * Detects user inactivity and triggers callback after timeout.
 * Resets on any user input (mouse, keyboard, touch, scroll).
 *
 * @module
 */

import { useState, useEffect, useCallback, useRef } from "react"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IdleDetectionOptions {
  /** Idle timeout in milliseconds (default: 60000 = 1 minute) */
  timeout?: number
  /** Events to track for activity (default: all standard input events) */
  events?: string[]
  /** Whether detection is enabled (default: true) */
  enabled?: boolean
  /** Callback when idle state is entered */
  onIdle?: () => void
  /** Callback when activity resumes */
  onActive?: () => void
}

export interface IdleDetectionState {
  /** Whether user is currently idle */
  isIdle: boolean
  /** Time remaining until idle (ms) */
  timeRemaining: number
  /** Last activity timestamp */
  lastActivity: number
  /** Reset the idle timer manually */
  reset: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT = 60_000 // 1 minute

const DEFAULT_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
]

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useIdleDetection(options: IdleDetectionOptions = {}): IdleDetectionState {
  const {
    timeout = DEFAULT_TIMEOUT,
    events = DEFAULT_EVENTS,
    enabled = true,
    onIdle,
    onActive,
  } = options

  const [isIdle, setIsIdle] = useState(false)
  const [lastActivity, setLastActivity] = useState(Date.now())
  const [timeRemaining, setTimeRemaining] = useState(timeout)

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const onIdleRef = useRef(onIdle)
  const onActiveRef = useRef(onActive)

  // Keep callback refs fresh
  onIdleRef.current = onIdle
  onActiveRef.current = onActive

  const reset = useCallback(() => {
    const now = Date.now()
    setLastActivity(now)
    setTimeRemaining(timeout)

    // If was idle, trigger onActive
    setIsIdle((prev) => {
      if (prev) {
        onActiveRef.current?.()
      }
      return false
    })

    // Clear and restart timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (enabled) {
      timeoutRef.current = setTimeout(() => {
        setIsIdle(true)
        setTimeRemaining(0)
        onIdleRef.current?.()
      }, timeout)
    }
  }, [timeout, enabled])

  // Activity handler
  const handleActivity = useCallback(() => {
    reset()
  }, [reset])

  // Set up event listeners
  useEffect(() => {
    if (!enabled) {
      // Clear timers when disabled
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      setIsIdle(false)
      return
    }

    // Initial timeout
    timeoutRef.current = setTimeout(() => {
      setIsIdle(true)
      setTimeRemaining(0)
      onIdleRef.current?.()
    }, timeout)

    // Update time remaining every second
    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => Math.max(0, prev - 1000))
    }, 1000)

    // Add event listeners
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [timeout, events, enabled, handleActivity])

  return {
    isIdle,
    timeRemaining,
    lastActivity,
    reset,
  }
}
