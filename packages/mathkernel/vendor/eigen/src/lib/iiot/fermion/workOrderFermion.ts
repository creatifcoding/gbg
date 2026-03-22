/**
 * WorkOrder Fermion Family
 *
 * Schema-driven Atom.family keyed by WorkOrderId.
 * Hydrates from unified IIoT HttpApi routes (browser-safe), not direct repo/db imports.
 *
 * Provides:
 * - workOrderFermion(id)        → Atom<Result<WorkOrder, E>>
 * - workOrderFermion.fetch(id)  → Effect that populates the atom via HttpApi
 * - workOrderListAtom           → Atom for work order collections
 * - workOrderStatsAtom          → Derived atom for status distribution
 *
 * @module
 */

import { Effect, Option, Schema } from 'effect'
import { Atom } from '@effect-atom/atom'
import * as Fermion from '../../fermion'
import { WorkOrder, WorkOrderStatus } from '../schemas/work-orders'
import type { WorkOrderId } from '../schemas/identifiers'

// =============================================================================
// Error Types
// =============================================================================

export class WorkOrderNotFoundError {
  readonly _tag = 'WorkOrderNotFoundError' as const
  constructor(readonly workOrderId: string) {}
}

export class WorkOrderHttpApiError {
  readonly _tag = 'WorkOrderHttpApiError' as const

  constructor(
    readonly message: string,
    readonly endpoint: string,
    readonly status?: number,
  ) {}
}

// =============================================================================
// HttpApi Adapter
// =============================================================================

const IIOT_HTTP_BASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_IIOT_HTTP_BASE_URL) ?? ''

const withBase = (path: string): string => {
  const base = IIOT_HTTP_BASE_URL.endsWith('/')
    ? IIOT_HTTP_BASE_URL.slice(0, -1)
    : IIOT_HTTP_BASE_URL
  return `${base}${path}`
}

const WorkOrderGetResponse = Schema.Union(
  WorkOrder,
  Schema.Struct({ workOrder: WorkOrder }),
)

const WorkOrderListResponse = Schema.Union(
  Schema.Array(WorkOrder),
  Schema.Struct({ items: Schema.Array(WorkOrder) }),
  Schema.Struct({ workOrders: Schema.Array(WorkOrder) }),
)

const parseJsonResponse = (
  endpoint: string,
  init?: RequestInit,
): Effect.Effect<unknown, WorkOrderHttpApiError> =>
  Effect.tryPromise({
    try: async () => {
      const response = await fetch(endpoint, init)
      if (!response.ok) {
        throw new WorkOrderHttpApiError(
          `HttpApi request failed (${response.status})`,
          endpoint,
          response.status,
        )
      }
      return response.json()
    },
    catch: (error) =>
      error instanceof WorkOrderHttpApiError
        ? error
        : new WorkOrderHttpApiError(
            error instanceof Error ? error.message : String(error),
            endpoint,
          ),
  })

const decodeGetPayload = (
  payload: unknown,
): Effect.Effect<WorkOrder, WorkOrderHttpApiError> =>
  Schema.decodeUnknown(WorkOrderGetResponse)(payload).pipe(
    Effect.map((decoded) => ('workOrder' in decoded ? decoded.workOrder : decoded)),
    Effect.mapError(
      (error) =>
        new WorkOrderHttpApiError(
          `Failed to decode work-order get payload: ${String(error)}`,
          'decode:get',
        ),
    ),
  )

const decodeListPayload = (
  payload: unknown,
): Effect.Effect<readonly WorkOrder[], WorkOrderHttpApiError> =>
  Schema.decodeUnknown(WorkOrderListResponse)(payload).pipe(
    Effect.map((decoded) => {
      if (Array.isArray(decoded)) return decoded
      return 'items' in decoded ? decoded.items : decoded.workOrders
    }),
    Effect.mapError(
      (error) =>
        new WorkOrderHttpApiError(
          `Failed to decode work-order list payload: ${String(error)}`,
          'decode:list',
        ),
    ),
  )

const fetchWorkOrderById = (
  id: string,
): Effect.Effect<WorkOrder, WorkOrderNotFoundError | WorkOrderHttpApiError> =>
  Effect.gen(function* () {
    const endpoint = withBase(`/api/workorders/work-order-get/${encodeURIComponent(id)}`)
    const payload = yield* parseJsonResponse(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workOrderId: id }),
    })

    const workOrder = yield* decodeGetPayload(payload)
    if (!workOrder || workOrder.id !== id) {
      return yield* Effect.fail(new WorkOrderNotFoundError(id))
    }

    return workOrder
  })

const fetchWorkOrderList = (
  status?: typeof WorkOrderStatus.Type,
): Effect.Effect<readonly WorkOrder[], WorkOrderHttpApiError> =>
  Effect.gen(function* () {
    const query = new URLSearchParams()
    if (status) query.set('status', status)

    const endpoint = withBase(
      `/api/queries/workorders${query.size > 0 ? `?${query.toString()}` : ''}`,
    )

    const payload = yield* parseJsonResponse(endpoint)
    return yield* decodeListPayload(payload)
  })

const TERMINAL_STATUSES = new Set([
  'rejected',
  'closed',
  'cancelled',
] as const)

const toDate = (value: unknown): Date | null => {
  if (value instanceof Date) return value
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value === 'object' && value !== null) {
    const candidate = value as { epochMillis?: unknown; toDate?: () => Date }
    if (typeof candidate.toDate === 'function') {
      const parsed = candidate.toDate()
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    if (typeof candidate.epochMillis === 'number') {
      return new Date(candidate.epochMillis)
    }
    if (typeof candidate.epochMillis === 'bigint') {
      return new Date(Number(candidate.epochMillis))
    }
  }

  return null
}

// =============================================================================
// Single WorkOrder Fermion (keyed by ID)
// =============================================================================

/**
 * Fermion family for individual work orders.
 *
 * Usage:
 *   const atom = workOrderFermion('WO-2026-00001')  // Get atom
 *   await workOrderFermion.fetch('WO-2026-00001')   // Fetch & populate
 */
export const workOrderFermion = Fermion.fromSchema(WorkOrder)
  .withKey('id')
  .withFetch((id) => fetchWorkOrderById(id))
  .buildWithDeps()

// =============================================================================
// List Atoms (Atom-as-State pattern)
// =============================================================================

/** All work orders — mutable atom, set by fetch effects */
export const workOrderListAtom = Atom.make<readonly WorkOrder[]>([])

/** Fetch open (non-terminal) work orders and populate the list atom */
export const fetchOpenWorkOrders = Effect.gen(function* () {
  const orders = yield* fetchWorkOrderList().pipe(
    Effect.catchAll(() => fetchAllWorkOrders),
  )
  const filtered = orders.filter((order) => !TERMINAL_STATUSES.has(order.status as 'rejected' | 'closed' | 'cancelled'))
  Atom.set(workOrderListAtom, filtered)
  return filtered
})

/** Fetch ALL work orders and populate the list atom */
export const fetchAllWorkOrders = Effect.gen(function* () {
  const orders = yield* fetchWorkOrderList()
  Atom.set(workOrderListAtom, orders)
  return orders
})

/** Fetch work orders by status */
export const fetchWorkOrdersByStatus = (status: typeof WorkOrderStatus.Type) =>
  Effect.gen(function* () {
    const orders = yield* fetchWorkOrderList(status).pipe(
      Effect.catchAll(() =>
        fetchAllWorkOrders.pipe(
          Effect.map((all) => all.filter((order) => order.status === status)),
        ),
      ),
    )
    Atom.set(workOrderListAtom, orders)
    return orders
  })

// =============================================================================
// Derived Atoms
// =============================================================================

/** Status distribution for dashboard cards */
export interface WorkOrderStats {
  readonly total: number
  readonly created: number
  readonly submitted: number
  readonly approved: number
  readonly started: number
  readonly suspended: number
  readonly completed: number
  readonly failed: number
  readonly cancelled: number
  readonly closed: number
  readonly rejected: number
  readonly overdue: number
}

/** Derived stats atom — recomputes when workOrderListAtom changes */
export const workOrderStatsAtom = Atom.make((get) => {
  const orders = get(workOrderListAtom)
  const now = new Date()

  const stats: WorkOrderStats = {
    total: orders.length,
    created: orders.filter((o) => o.status === 'created').length,
    submitted: orders.filter((o) => o.status === 'submitted').length,
    approved: orders.filter((o) => o.status === 'approved').length,
    started: orders.filter((o) => o.status === 'started').length,
    suspended: orders.filter((o) => o.status === 'suspended').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    failed: orders.filter((o) => o.status === 'failed').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    closed: orders.filter((o) => o.status === 'closed').length,
    rejected: orders.filter((o) => o.status === 'rejected').length,
    overdue: orders.filter((o) => {
      if (o.dueDate._tag === 'None') return false
      if (TERMINAL_STATUSES.has(o.status as 'rejected' | 'closed' | 'cancelled')) return false
      const due = toDate(o.dueDate.value)
      return due ? now > due : false
    }).length,
  }

  return stats
})

/** Work orders grouped by status — for kanban lanes */
export const workOrdersByStatusAtom = Atom.make((get) => {
  const orders = get(workOrderListAtom)

  const grouped = new Map<string, readonly WorkOrder[]>()
  const statuses = [
    'created',
    'submitted',
    'approved',
    'started',
    'suspended',
    'resumed',
    'completed',
    'failed',
    'cancelled',
    'closed',
    'rejected',
  ] as const

  for (const status of statuses) {
    grouped.set(status, orders.filter((o) => o.status === status))
  }

  return grouped
})

/** Priority distribution */
export const workOrdersByPriorityAtom = Atom.make((get) => {
  const orders = get(workOrderListAtom)
  return {
    emergency: orders.filter((o) => o.priority === 'emergency').length,
    urgent: orders.filter((o) => o.priority === 'urgent').length,
    high: orders.filter((o) => o.priority === 'high').length,
    normal: orders.filter((o) => o.priority === 'normal').length,
    low: orders.filter((o) => o.priority === 'low').length,
  }
})
