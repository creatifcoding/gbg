/**
 * Screensaver Atoms
 *
 * Global state for screensaver system.
 *
 * @module
 */

import { Atom } from "@effect-atom/atom"

/**
 * Force screensaver to activate.
 * Set to true to trigger screensaver regardless of idle state.
 * Resets to false when dismissed.
 */
export const forceScreensaverAtom = Atom.make(false)

/**
 * Screensaver enabled state.
 * When false, idle detection is disabled.
 */
export const screensaverEnabledAtom = Atom.make(true)

/**
 * Idle timeout in milliseconds.
 * Default: 60000 (1 minute)
 */
export const screensaverTimeoutAtom = Atom.make(60_000)
