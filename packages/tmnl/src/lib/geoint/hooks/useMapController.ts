/**
 * useMapController React Hook
 *
 * Provides panel-scoped MapController instance from GeointPanelContext.
 * Memoized — same panelId always returns same controller reference.
 *
 * Must be used inside <GeointPanelProvider>.
 *
 * @module geoint/hooks/useMapController
 *
 * @example
 * ```tsx
 * function MapToolbar() {
 *   const controller = useMapController()
 *
 *   return (
 *     <div>
 *       <button onClick={() => controller.zoomIn()}>+</button>
 *       <button onClick={() => controller.zoomOut()}>-</button>
 *       <button onClick={() => controller.resetView()}>Home</button>
 *       <button onClick={() => controller.cycleMapStyle()}>Style</button>
 *     </div>
 *   )
 * }
 * ```
 */

import { useMemo } from 'react'
import { useGeointPanel } from '../context/PanelContext'
import { MapController } from '../map/MapController'

/**
 * Get panel-scoped MapController.
 *
 * @throws Error if used outside GeointPanelProvider
 * @returns Stable MapController instance for the current panel
 */
export function useMapController(): MapController {
  const { panelId } = useGeointPanel()
  return useMemo(() => new MapController(panelId), [panelId])
}
