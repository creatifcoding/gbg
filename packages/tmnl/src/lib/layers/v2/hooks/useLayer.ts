/**
 * Layer System v2 — useLayer Hook
 *
 * Combined hook for layer registration, style, and operations.
 * The primary API for v2 wrapper-free layer system.
 *
 * @experimental v2 API - Wrapper-free layer system
 */

import * as React from "react"
import { useAtomValue } from "@effect-atom/atom-react"
import type { CSSProperties } from "react"
import type { LayerConfig, LayerInstance, UseLayerReturn } from "../types"
import { LAYER_DEFAULTS } from "../types"
import {
  layerFamily,
  generateLayerId,
  addLayer,
  removeLayer,
} from "../atoms"
import { useLayerStyle } from "./useLayerStyle"
import { useLayerOps, type ExtendedLayerOps } from "./useLayerOps"

// ─────────────────────────────────────────────────────────────────────────────
// useLayer Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useLayer Hook
 *
 * Registers a layer on mount, unregisters on unmount.
 * Returns id, computed style, operations, and layer instance.
 *
 * @param config - Layer configuration
 * @returns UseLayerReturn with id, style, ops, layer
 *
 * Usage:
 * ```tsx
 * function MyLayeredComponent() {
 *   const { id, style, ops } = useLayer({
 *     name: 'my-layer',
 *     initialZIndex: 10,
 *     positionMode: 'absolute',
 *   })
 *
 *   return (
 *     <div style={style} data-layer-id={id}>
 *       Content here
 *       <button onClick={ops.bringToFront}>↑</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useLayer(config: LayerConfig): UseLayerReturn {
  // Generate stable ID on first render
  const [id] = React.useState(() => generateLayerId())

  // Register layer on mount, unregister on unmount
  React.useEffect(() => {
    const layer: LayerInstance = {
      id,
      name: config.name,
      zIndex: config.initialZIndex ?? LAYER_DEFAULTS.initialZIndex,
      visible: config.visible ?? LAYER_DEFAULTS.visible,
      positionMode: config.positionMode ?? LAYER_DEFAULTS.positionMode,
      pointerEvents: config.pointerEvents ?? LAYER_DEFAULTS.pointerEvents,
    }

    addLayer(layer)

    return () => {
      removeLayer(id)
    }
  }, [id, config.name]) // Only re-register if name changes

  // Subscribe to layer state
  const layer = useAtomValue(layerFamily(id))

  // Compute style from layer
  const style = useLayerStyle(layer)

  // Get bound operations
  const ops = useLayerOps(id)

  return {
    id,
    style,
    ops,
    layer,
  }
}

/**
 * useExistingLayer Hook
 *
 * Access an existing layer by ID (doesn't register/unregister).
 * Use when you have a layer ID from elsewhere.
 *
 * @param id - Layer ID
 * @returns Layer instance, style, and operations
 */
export function useExistingLayer(id: string): {
  layer: LayerInstance | null
  style: CSSProperties
  ops: ExtendedLayerOps
} {
  const layer = useAtomValue(layerFamily(id))
  const style = useLayerStyle(layer)
  const ops = useLayerOps(id)

  return { layer, style, ops }
}
