/**
 * Data Grid Services
 *
 * Effect-based services for the unified DataGrid system.
 *
 * @module
 */

// GridDragService - Hybrid drag state machine
export {
  GridDragService,
  GridDragServiceLive,
  type GridDragServiceApi,
  // Event constructors
  gridDragStart,
  gridDragMove,
  gridExit,
  canvasEnter,
  canvasMove,
  drop,
  cancel,
} from './GridDragService'

// FlashTrackingService - Cell flash state management
export {
  FlashTrackingService,
  FlashTrackingServiceLive,
  FlashTrackingServiceCustom,
  type FlashTrackingServiceApi,
  type FlashTrackingConfig,
  defaultFlashTrackingConfig,
  // Calculation utilities
  calculateSeverity,
  calculateIntensity,
  getDirection,
  createFlashState,
  // Constants
  DEFAULT_FLASH_TTL,
  DEFAULT_MAX_DELTA,
} from './FlashTrackingService'

// Runtime factory
export {
  createGridServicesLayer,
  createDataGridRuntime,
  type DataGridRuntime,
} from './DataGridRuntimeFactory'
