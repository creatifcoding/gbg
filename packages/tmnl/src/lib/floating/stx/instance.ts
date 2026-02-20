/**
 * Floating STX singleton instance
 *
 * Creates and manages the single stx instance for the floating panel system.
 * All other modules (actions, hooks) import getFloatingStx from here.
 *
 * @module
 */

import { stx } from '@/lib/stx'
import { panelMachine } from '../machines/panel-machine'
import { initialData, type FloatingStx } from './initial'
import { floatingEffects } from './effects'
import { floatingComputed } from './computed'

// =============================================================================
// Singleton
// =============================================================================

let _floatingStx: FloatingStx | null = null

/**
 * Get the singleton floating panel stx instance
 */
export function getFloatingStx(): FloatingStx {
  if (!_floatingStx) {
    _floatingStx = stx({
      machine: panelMachine,
      data: initialData,
      effects: floatingEffects,
      computed: floatingComputed,
    }) as FloatingStx
  }
  return _floatingStx
}

/**
 * Reset the floating panel stx instance
 */
export function resetFloatingStx(): void {
  if (_floatingStx) {
    _floatingStx.reset()
  }
}

/**
 * Dispose the floating panel stx instance (cleanup)
 */
export function disposeFloatingStx(): void {
  if (_floatingStx) {
    _floatingStx.dispose()
    _floatingStx = null
  }
}
