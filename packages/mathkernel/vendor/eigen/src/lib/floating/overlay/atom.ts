/**
 * Panel overlay state — registry-scoped atom.
 *
 * Uses a dedicated Registry so imperative toggle (from sidebar, hotkey)
 * and React reads (useAtomValue) share the same state.
 *
 * @module floating/overlay/atom
 */

import { Atom, Registry } from '@effect-atom/atom'

/** Panel overlay registry — shared between React and imperative code */
export const panelOverlayRegistry = Registry.make()

/** Whether the panel workspace overlay is visible */
export const panelOverlayOpenAtom = Atom.make(false)
