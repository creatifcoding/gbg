/**
 * Work Order Event Reactivity
 *
 * EventLog.groupReactivity for cache invalidation per ISA-95/FDA 21 CFR Part 11.
 * Maps work order events to cache keys that should be invalidated.
 *
 * Cache invalidation follows work order lifecycle:
 * - Created: work-orders:pending (new work awaiting submission)
 * - Submitted: work-orders:pending-approval (awaiting approval)
 * - Approved/Rejected: work-orders:pending-approval (approval resolved)
 * - Started: work-orders:active (work in progress)
 * - Suspended/Resumed: work-orders:active (state changed)
 * - Completed/Failed: work-orders:completed (work finished)
 * - Cancelled: work-orders:cancelled (work aborted)
 * - Closed: work-orders:history (archived for compliance)
 *
 * @module @gbg/tmnl/iiot/handlers/work-order-reactivity
 * @see ISA-95/IEC 62264 for operations management
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ADR-0012 for ES boundaries (work orders ARE event sourced)
 */

import * as EventLog from '@effect/experimental/EventLog'
import { WorkOrderEvents } from '../schemas/events/groups'

// =============================================================================
// Cache Key Constants
// =============================================================================

/**
 * Cache key constants for IIoT Work Order Management System
 *
 * These keys map to cache entries that track different work order states.
 * When an event is written, associated cache keys are invalidated,
 * triggering re-fetch of affected data.
 */
export const WORK_ORDER_CACHE_KEYS = {
  /** Pending work orders - created but not yet submitted */
  WORK_ORDERS_PENDING: 'work-orders:pending',

  /** Work orders awaiting approval */
  WORK_ORDERS_PENDING_APPROVAL: 'work-orders:pending-approval',

  /** Active work orders - in progress */
  WORK_ORDERS_ACTIVE: 'work-orders:active',

  /** Suspended work orders - temporarily paused */
  WORK_ORDERS_SUSPENDED: 'work-orders:suspended',

  /** Completed work orders - finished successfully or with issues */
  WORK_ORDERS_COMPLETED: 'work-orders:completed',

  /** Failed work orders - terminated with errors */
  WORK_ORDERS_FAILED: 'work-orders:failed',

  /** Cancelled work orders - aborted before completion */
  WORK_ORDERS_CANCELLED: 'work-orders:cancelled',

  /** Historical work orders - closed and archived */
  WORK_ORDERS_HISTORY: 'work-orders:history',

  /** Dashboard summary - counts, status distribution, priority breakdown */
  WORK_ORDERS_DASHBOARD: 'work-orders:dashboard',

  /** Overdue work orders - past scheduled completion */
  WORK_ORDERS_OVERDUE: 'work-orders:overdue',

  /** Asset-specific work order prefix - append assetId for full key */
  WORK_ORDERS_ASSET_PREFIX: 'work-orders:asset:',

  /** Assigned user work order prefix - append userId for full key */
  WORK_ORDERS_ASSIGNED_PREFIX: 'work-orders:assigned:',
} as const

// =============================================================================
// Reactivity Configuration
// =============================================================================

/**
 * Work Order Reactivity Layer
 *
 * Invalidates cache keys when work order events are written.
 * Each event type maps to the cache keys it affects per ISA-95 lifecycle.
 *
 * @example
 * ```typescript
 * import { WorkOrderReactivity } from './work-order-reactivity'
 * import { IIoTEventLogLayer } from '../infrastructure/eventlog-layer'
 *
 * // Compose with EventLog layer
 * const layer = Layer.mergeAll(
 *   IIoTEventLogLayer,
 *   WorkOrderEventHandlers,
 *   WorkOrderReactivity,
 * )
 * ```
 */
export const WorkOrderReactivity = EventLog.groupReactivity(WorkOrderEvents, {
  // =========================================================================
  // WorkOrderCreated — New work order created
  // =========================================================================
  // Affects: pending list, dashboard summary
  WorkOrderCreated: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_PENDING,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_DASHBOARD,
  ],

  // =========================================================================
  // WorkOrderSubmitted — Submitted for approval
  // =========================================================================
  // Affects: pending list (remove), pending-approval list (add)
  WorkOrderSubmitted: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_PENDING,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_PENDING_APPROVAL,
  ],

  // =========================================================================
  // WorkOrderApproved — Approved to proceed
  // =========================================================================
  // Affects: pending-approval list (remove), dashboard (approval metrics)
  WorkOrderApproved: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_PENDING_APPROVAL,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_DASHBOARD,
  ],

  // =========================================================================
  // WorkOrderRejected — Rejected with reason
  // =========================================================================
  // Affects: pending-approval list (remove), pending list (return)
  WorkOrderRejected: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_PENDING_APPROVAL,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_PENDING,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_DASHBOARD,
  ],

  // =========================================================================
  // WorkOrderStarted — Execution started
  // =========================================================================
  // Affects: active list (add), dashboard (active count)
  WorkOrderStarted: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_ACTIVE,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_DASHBOARD,
  ],

  // =========================================================================
  // WorkOrderSuspended — Temporarily paused
  // =========================================================================
  // Affects: active list (update), suspended list (add)
  WorkOrderSuspended: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_ACTIVE,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_SUSPENDED,
  ],

  // =========================================================================
  // WorkOrderResumed — Resumed from suspension
  // =========================================================================
  // Affects: active list (update), suspended list (remove)
  WorkOrderResumed: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_ACTIVE,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_SUSPENDED,
  ],

  // =========================================================================
  // WorkOrderCompleted — Successfully finished
  // =========================================================================
  // Affects: active list (remove), completed list (add), dashboard
  WorkOrderCompleted: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_ACTIVE,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_COMPLETED,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_DASHBOARD,
  ],

  // =========================================================================
  // WorkOrderFailed — Failed with error
  // =========================================================================
  // Affects: active list (remove), failed list (add), dashboard
  WorkOrderFailed: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_ACTIVE,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_FAILED,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_DASHBOARD,
  ],

  // =========================================================================
  // WorkOrderCancelled — Cancelled before completion
  // =========================================================================
  // Affects: active/pending lists (remove), cancelled list (add), dashboard
  WorkOrderCancelled: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_ACTIVE,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_PENDING,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_CANCELLED,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_DASHBOARD,
  ],

  // =========================================================================
  // WorkOrderClosed — Archived after completion (FDA compliance)
  // =========================================================================
  // Affects: completed/failed lists (remove), history (add)
  WorkOrderClosed: [
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_COMPLETED,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_FAILED,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_HISTORY,
    WORK_ORDER_CACHE_KEYS.WORK_ORDERS_DASHBOARD,
  ],
})

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Type for WORK_ORDER_CACHE_KEYS values
 */
export type WorkOrderCacheKey = (typeof WORK_ORDER_CACHE_KEYS)[keyof typeof WORK_ORDER_CACHE_KEYS]

/**
 * Helper to create asset-specific work order cache key
 *
 * @param assetId - The asset identifier
 * @returns Cache key like "work-orders:asset:ASSET-001"
 */
export const makeAssetWorkOrderCacheKey = (assetId: string): string =>
  `${WORK_ORDER_CACHE_KEYS.WORK_ORDERS_ASSET_PREFIX}${assetId}`

/**
 * Helper to create user-specific assigned work order cache key
 *
 * @param userId - The user identifier
 * @returns Cache key like "work-orders:assigned:USER-001"
 */
export const makeAssignedWorkOrderCacheKey = (userId: string): string =>
  `${WORK_ORDER_CACHE_KEYS.WORK_ORDERS_ASSIGNED_PREFIX}${userId}`
