/**
 * useScreensaver Hook
 *
 * Combines idle detection with screensaver overlay state.
 * Provides show/hide controls and configuration.
 *
 * Uses overlayRegistry directly for atom access (not RegistryContext)
 * because commands write to the global singleton registry.
 *
 * @module
 */

import { useState, useCallback, useEffect, useSyncExternalStore } from "react"
import { useIdleDetection } from "./useIdleDetection"
import { forceScreensaverAtom, screensaverEnabledAtom } from "../atoms"
import { overlayRegistry } from "@/lib/overlays/atoms"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ScreensaverConfig {
  /** Idle timeout before screensaver activates (ms). Default: 60000 (1 min) */
  idleTimeout?: number
  /** Whether screensaver is enabled. Default: true */
  enabled?: boolean
  /** Fade-in duration (ms). Default: 500 */
  fadeInDuration?: number
  /** Fade-out duration (ms). Default: 300 */
  fadeOutDuration?: number
}

export interface UseScreensaverReturn {
  /** Whether screensaver is currently visible */
  isActive: boolean
  /** Whether screensaver is enabled */
  isEnabled: boolean
  /** Time remaining until activation (ms) */
  timeRemaining: number
  /** Manually show screensaver */
  show: () => void
  /** Dismiss screensaver */
  dismiss: () => void
  /** Toggle enabled state */
  toggleEnabled: () => void
  /** Update configuration */
  configure: (config: Partial<ScreensaverConfig>) => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useScreensaver(initialConfig: ScreensaverConfig = {}): UseScreensaverReturn {
  const [config, setConfig] = useState<ScreensaverConfig>({
    idleTimeout: 60_000,
    enabled: true,
    fadeInDuration: 500,
    fadeOutDuration: 300,
    ...initialConfig,
  })

  const [isActive, setIsActive] = useState(false)

  // Subscribe to global atoms via overlayRegistry directly
  // (Commands write to overlayRegistry, not RegistryContext)
  const forceScreensaver = useSyncExternalStore(
    (callback) => overlayRegistry.subscribe(forceScreensaverAtom, callback),
    () => overlayRegistry.get(forceScreensaverAtom)
  )
  const globalEnabled = useSyncExternalStore(
    (callback) => overlayRegistry.subscribe(screensaverEnabledAtom, callback),
    () => overlayRegistry.get(screensaverEnabledAtom)
  )

  const { isIdle, timeRemaining, reset } = useIdleDetection({
    timeout: config.idleTimeout,
    enabled: config.enabled && globalEnabled,
    onIdle: () => setIsActive(true),
    onActive: () => {}, // We handle dismiss separately for fade-out
  })

  // Watch forceScreensaverAtom for external triggers (e.g., from commands)
  useEffect(() => {
    if (forceScreensaver) {
      setIsActive(true)
    }
  }, [forceScreensaver])

  // Dismiss handler - called on any input when screensaver is active
  const dismiss = useCallback(() => {
    if (isActive) {
      setIsActive(false)
      overlayRegistry.set(forceScreensaverAtom, false) // Reset force atom
      reset()
    }
  }, [isActive, reset])

  // Manual show
  const show = useCallback(() => {
    setIsActive(true)
  }, [])

  // Toggle enabled
  const toggleEnabled = useCallback(() => {
    setConfig((prev) => ({ ...prev, enabled: !prev.enabled }))
  }, [])

  // Update config
  const configure = useCallback((updates: Partial<ScreensaverConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }))
  }, [])

  // Listen for dismiss events when active
  useEffect(() => {
    if (!isActive) return

    const handleDismiss = () => dismiss()

    // Dismiss on any of these events
    const dismissEvents = ["mousedown", "keydown", "touchstart"]
    dismissEvents.forEach((event) => {
      window.addEventListener(event, handleDismiss, { once: true })
    })

    return () => {
      dismissEvents.forEach((event) => {
        window.removeEventListener(event, handleDismiss)
      })
    }
  }, [isActive, dismiss])

  return {
    isActive,
    isEnabled: config.enabled ?? true,
    timeRemaining,
    show,
    dismiss,
    toggleEnabled,
    configure,
  }
}
