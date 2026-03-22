/**
 * Floating STX initial data + type alias
 * @module
 */

import type { Stx } from '@/lib/stx'
import type { FloatingStxData, PanelState } from '../types'
import { emptyStrip } from '../types/strip'
import { panelMachine } from '../machines/panel-machine'
import { BASE_Z_INDEX } from './constants'
import type { floatingEffects } from './effects'
import type { floatingComputed } from './computed'

// =============================================================================
// Initial Data
// =============================================================================

export const initialData: FloatingStxData = {
  panels: new Map<string, PanelState>(),
  zOrder: [],
  activePanel: null,
  resizingPanel: null,
  draggingPanel: null,
  modifierKeys: {
    shift: false,
    ctrl: false,
    alt: false,
  },
  baseZIndex: BASE_Z_INDEX,
  gridSize: 0,
  snapEnabled: true,
  // Tiled layout (SM Migration §14)
  panelTree: null,
  focusDirection: null,
  // Niri-style flat strip (parallel to panelTree during migration)
  strip: emptyStrip(),
}

// =============================================================================
// Type
// =============================================================================

export type FloatingStx = Stx<
  typeof panelMachine,
  FloatingStxData,
  typeof floatingEffects,
  typeof floatingComputed
>
