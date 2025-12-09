/**
 * Layer System v2 — useLayerOps Hook
 *
 * Provides layer operations bound to a specific layer ID.
 *
 * @experimental v2 API - Wrapper-free layer system
 */

import * as React from "react"
import type { PointerEventsBehavior, PositionMode, LayerOps } from "../types"
import {
  bringToFront as bringToFrontAtom,
  sendToBack as sendToBackAtom,
  setVisible as setVisibleAtom,
  setPointerEvents as setPointerEventsAtom,
  setZIndex as setZIndexAtom,
  setPositionMode as setPositionModeAtom,
  removeLayer,
} from "../atoms"

// ─────────────────────────────────────────────────────────────────────────────
// useLayerOps Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extended LayerOps with additional operations
 */
export interface ExtendedLayerOps extends LayerOps {
  /** Set position mode */
  setPositionMode: (mode: PositionMode) => void
  /** Remove the layer from registry */
  remove: () => void
}

/**
 * useLayerOps Hook
 *
 * Returns memoized layer operations bound to a specific layer ID.
 *
 * @param id - Layer ID to bind operations to
 * @returns ExtendedLayerOps object with bound operations
 *
 * Usage:
 * ```tsx
 * function LayerControls({ id }) {
 *   const ops = useLayerOps(id)
 *
 *   return (
 *     <div>
 *       <button onClick={ops.bringToFront}>↑ Front</button>
 *       <button onClick={ops.sendToBack}>↓ Back</button>
 *       <button onClick={() => ops.setVisible(false)}>Hide</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useLayerOps(id: string): ExtendedLayerOps {
  return React.useMemo(
    () => ({
      bringToFront: () => bringToFrontAtom(id),
      sendToBack: () => sendToBackAtom(id),
      setVisible: (visible: boolean) => setVisibleAtom(id, visible),
      setPointerEvents: (behavior: PointerEventsBehavior) => setPointerEventsAtom(id, behavior),
      setZIndex: (zIndex: number) => setZIndexAtom(id, zIndex),
      setPositionMode: (mode: PositionMode) => setPositionModeAtom(id, mode),
      remove: () => removeLayer(id),
    }),
    [id]
  )
}

/**
 * useGlobalLayerOps Hook
 *
 * Returns operations not bound to a specific layer.
 * Useful for managing multiple layers.
 *
 * Usage:
 * ```tsx
 * function LayerManager() {
 *   const ops = useGlobalLayerOps()
 *
 *   return (
 *     <button onClick={() => ops.bringToFront('layer-1')}>
 *       Bring Layer 1 to Front
 *     </button>
 *   )
 * }
 * ```
 */
export function useGlobalLayerOps() {
  return React.useMemo(
    () => ({
      bringToFront: bringToFrontAtom,
      sendToBack: sendToBackAtom,
      setVisible: setVisibleAtom,
      setPointerEvents: setPointerEventsAtom,
      setZIndex: setZIndexAtom,
      setPositionMode: setPositionModeAtom,
      removeLayer,
    }),
    []
  )
}
