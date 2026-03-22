/**
 * IIoT Event Handlers
 *
 * Re-exports all event handlers and reactivity bindings for IIoT events.
 *
 * @module @gbg/tmnl/iiot/handlers
 */

// =============================================================================
// Alarm Handlers
// =============================================================================

export { AlarmEventHandlers, type AlarmEventHandlersLayer } from './alarm-handlers'

// =============================================================================
// Equipment State Handlers
// =============================================================================

export {
  EquipmentStateEventHandlers,
  type EquipmentStateEventHandlersLayer,
} from './equipment-handlers'

// =============================================================================
// Work Order Handlers
// =============================================================================

export {
  WorkOrderEventHandlers,
  type WorkOrderEventHandlersLayer,
} from './work-order-handlers'

// =============================================================================
// Context Handlers (ISA-95 Level 3 Context Management)
// =============================================================================

export {
  ContextEventHandlers,
  type ContextEventHandlersLayer,
} from './context-handlers'

// =============================================================================
// Task Handlers (ISA-95 Level 3 Task Execution)
// =============================================================================

export {
  TaskEventHandlers,
  type TaskEventHandlersLayer,
} from './task-handlers'

// =============================================================================
// Approval Handlers (FDA 21 CFR Part 11 4-Eyes Principle)
// =============================================================================

export {
  ApprovalEventHandlers,
  type ApprovalEventHandlersLayer,
} from './approval-handlers'

// =============================================================================
// Regulatory Handlers (FDA 21 CFR Part 11, ISO 9001)
// =============================================================================

export {
  BatchEventHandlers,
  QualityEventHandlers,
  OperatorEventHandlers,
  type BatchEventHandlersLayer,
  type QualityEventHandlersLayer,
  type OperatorEventHandlersLayer,
} from './regulatory-handlers'

// =============================================================================
// Reactivity Bindings
// =============================================================================

export {
  AlarmReactivity,
  ALARM_CACHE_KEYS,
  makeDeviceCacheKey,
  type AlarmCacheKey,
} from './alarm-reactivity'

export {
  WorkOrderReactivity,
  WORK_ORDER_CACHE_KEYS,
  makeAssetWorkOrderCacheKey,
  makeAssignedWorkOrderCacheKey,
  type WorkOrderCacheKey,
} from './work-order-reactivity'

export {
  EquipmentStateReactivity,
  EQUIPMENT_CACHE_KEYS,
  makeMachineCacheKey,
  makeLineCacheKey,
  type EquipmentCacheKey,
} from './equipment-reactivity'
