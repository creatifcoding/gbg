/**
 * DataGridRuntimeFactory
 *
 * Creates per-grid Effect runtimes with all required services.
 * Each DataGrid instance gets its own DataManager + TableService + FlashTracking.
 *
 * @module
 */

import { Atom } from '@effect-atom/atom-react'
import { Layer } from 'effect'
import { GridDragService, GridDragServiceLive } from './GridDragService'
import { FlashTrackingService, FlashTrackingServiceLive } from './FlashTrackingService'

// =============================================================================
// RUNTIME FACTORY
// =============================================================================

/**
 * Create a per-grid runtime layer.
 * This combines GridDragService and FlashTrackingService.
 *
 * Note: DataManager and TableService are added at the component level
 * since they require grid-specific configuration.
 */
export const createGridServicesLayer = () =>
  Layer.mergeAll(
    GridDragServiceLive,
    FlashTrackingServiceLive
  )

/**
 * Create an Atom.runtime for a DataGrid instance.
 * This provides STX-native state management via effect-atom.
 */
export const createDataGridRuntime = () =>
  Atom.runtime(createGridServicesLayer())

/**
 * Type for the DataGrid runtime.
 */
export type DataGridRuntime = ReturnType<typeof createDataGridRuntime>

// =============================================================================
// CONVENIENCE EXPORTS
// =============================================================================

export {
  GridDragService,
  GridDragServiceLive,
  FlashTrackingService,
  FlashTrackingServiceLive,
}
