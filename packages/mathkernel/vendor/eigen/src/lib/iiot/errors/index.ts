/**
 * IIoT Error Schemas
 *
 * Re-exports all domain-specific error types for IIoT operations.
 *
 * @module @gbg/tmnl/iiot/errors
 */

// =============================================================================
// Common Errors
// =============================================================================

export {
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
  type CommonError,
} from './common'

// =============================================================================
// Asset Errors
// =============================================================================

export {
  AssetNotFoundError,
  AssetValidationError,
  AssetConflictError,
  type AssetCommandError,
} from './asset'

// =============================================================================
// Alarm Errors
// =============================================================================

export {
  AlarmNotFoundError,
  AlarmAlreadyAcknowledgedError,
  InvalidAlarmTransitionError,
  type AlarmCommandError,
} from './alarm'

// =============================================================================
// Work Order Errors
// =============================================================================

export {
  WorkOrderNotFoundError,
  InvalidWorkOrderStateError,
  WorkOrderApprovalRequiredError,
  type WorkOrderCommandError,
} from './work-order'

// =============================================================================
// Equipment State Errors
// =============================================================================

export {
  EquipmentStateNotFoundError,
  InvalidStateTransitionError,
  EquipmentStateValidationError,
  FaultNotFoundError,
  MaintenanceInProgressError,
  type EquipmentStateCommandError,
} from './equipment-state'
