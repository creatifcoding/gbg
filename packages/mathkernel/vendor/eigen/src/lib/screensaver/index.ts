/**
 * Screensaver Module
 *
 * Idle-triggered ASCII art overlay.
 * Activates after configurable inactivity period.
 * Dismisses on any user input.
 *
 * @module
 */

export { useIdleDetection } from "./hooks/useIdleDetection"
export type { IdleDetectionOptions } from "./hooks/useIdleDetection"

export { ScreensaverOverlay } from "./components/ScreensaverOverlay"
export type { ScreensaverOverlayProps } from "./components/ScreensaverOverlay"

export { useScreensaver } from "./hooks/useScreensaver"
export type { UseScreensaverReturn } from "./hooks/useScreensaver"

// Atoms for external control (e.g., commands)
export {
  forceScreensaverAtom,
  screensaverEnabledAtom,
  screensaverTimeoutAtom,
} from "./atoms"
