/**
 * Layer System v2 — useLayerStyle Hook
 *
 * Computes CSS style object from layer instance properties.
 *
 * @experimental v2 API - Wrapper-free layer system
 */

import * as React from "react"
import type { CSSProperties } from "react"
import type { LayerInstance, PointerEventsBehavior, PositionMode } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Style Computation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute pointer-events CSS value from behavior type
 */
function computePointerEvents(behavior: PointerEventsBehavior): CSSProperties["pointerEvents"] {
  switch (behavior) {
    case "auto":
      return "auto"
    case "none":
      return "none"
    case "pass-through":
      // Container is none, but children should be auto
      // This is applied at container level; children need explicit auto
      return "none"
  }
}

/**
 * Compute full style object from layer instance
 */
function computeLayerStyle(layer: LayerInstance | null): CSSProperties {
  if (!layer) {
    return {}
  }

  return {
    position: layer.positionMode,
    zIndex: layer.zIndex,
    pointerEvents: computePointerEvents(layer.pointerEvents),
    visibility: layer.visible ? "visible" : "hidden",
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// useLayerStyle Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useLayerStyle Hook
 *
 * Computes memoized CSS style object from layer instance.
 *
 * @param layer - Layer instance (or null)
 * @returns CSSProperties object to spread on element
 *
 * Usage:
 * ```tsx
 * function MyLayer({ id }) {
 *   const layer = useAtomValue(layerFamily(id))
 *   const style = useLayerStyle(layer)
 *
 *   return <div style={style}>Content</div>
 * }
 * ```
 */
export function useLayerStyle(layer: LayerInstance | null): CSSProperties {
  return React.useMemo(() => computeLayerStyle(layer), [
    layer?.id,
    layer?.zIndex,
    layer?.visible,
    layer?.positionMode,
    layer?.pointerEvents,
  ])
}

/**
 * useLayerStyleFromValues Hook
 *
 * Computes style from individual values (for when you don't have a layer instance).
 *
 * @param config - Individual style values
 * @returns CSSProperties object
 */
export function useLayerStyleFromValues(config: {
  zIndex?: number
  visible?: boolean
  positionMode?: PositionMode
  pointerEvents?: PointerEventsBehavior
}): CSSProperties {
  return React.useMemo(
    () => ({
      position: config.positionMode ?? "relative",
      zIndex: config.zIndex ?? 0,
      pointerEvents: computePointerEvents(config.pointerEvents ?? "auto"),
      visibility: config.visible !== false ? "visible" : "hidden",
    }),
    [config.zIndex, config.visible, config.positionMode, config.pointerEvents]
  )
}
