/**
 * useFloatingActions — thin adapter over stx for context consumption
 *
 * Collapses 10 useCallback passthroughs into a single stable reference.
 * Decouples the context interface from stx implementation details.
 *
 * @module
 */

import { useMemo } from 'react'
import {
  registerPanel as stxRegisterPanel,
  unregisterPanel as stxUnregisterPanel,
  updatePanelPosition,
  updatePanelDimensions,
  bringPanelToFront,
  sendPanelToBack,
  closePanel as stxClosePanel,
  togglePanelMode,
  setPanelVisibility,
  getPanel as stxGetPanel,
} from '../floating-stx'
import type { FloatingPanelContextValue } from '../context/FloatingPanelContext'

/**
 * Returns a stable actions object for FloatingPanelContext.
 * All functions delegate to stx — the stx functions are module-scoped
 * singletons, so the returned object never changes identity.
 */
export function useFloatingActions(): FloatingPanelContextValue {
  return useMemo<FloatingPanelContextValue>(() => ({
    registerPanel: stxRegisterPanel,
    unregisterPanel: stxUnregisterPanel,
    updatePosition: updatePanelPosition,
    updateDimensions: updatePanelDimensions,
    bringToFront: bringPanelToFront,
    sendToBack: sendPanelToBack,
    closePanel: stxClosePanel,
    toggleMode: togglePanelMode,
    getPanel: stxGetPanel,
    setVisibility: setPanelVisibility,
  }), [])
}
