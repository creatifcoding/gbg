/**
 * Floating Panel Context
 *
 * Context type, provider context, and consumer hook.
 * Separated from the provider per components.build composition-root pattern.
 *
 * @module
 */

import { createContext, useContext } from 'react'
import type {
  PanelState,
  PanelConfig,
  Position,
  Dimensions,
  PanelVisibility,
} from '../types'

// =============================================================================
// Context Type
// =============================================================================

export interface FloatingPanelContextValue {
  /** Register a new panel */
  registerPanel: (config: PanelConfig) => void
  /** Unregister a panel */
  unregisterPanel: (id: string) => void
  /** Update panel position */
  updatePosition: (id: string, position: Position) => void
  /** Update panel dimensions */
  updateDimensions: (id: string, dimensions: Dimensions) => void
  /** Bring panel to front */
  bringToFront: (id: string) => void
  /** Send panel to back */
  sendToBack: (id: string) => void
  /** Close panel */
  closePanel: (id: string) => void
  /** Toggle panel mode (floating/docked) */
  toggleMode: (id: string) => void
  /** Get panel by ID */
  getPanel: (id: string) => PanelState | undefined
  /** Set panel visibility */
  setVisibility: (id: string, visibility: PanelVisibility) => void
}

// =============================================================================
// Context
// =============================================================================

export const FloatingPanelContext = createContext<FloatingPanelContextValue | null>(null)

// =============================================================================
// Hook
// =============================================================================

export function useFloatingPanelContext(): FloatingPanelContextValue {
  const context = useContext(FloatingPanelContext)
  if (!context) {
    throw new Error(
      'useFloatingPanelContext must be used within a FloatingPanelProvider'
    )
  }
  return context
}
