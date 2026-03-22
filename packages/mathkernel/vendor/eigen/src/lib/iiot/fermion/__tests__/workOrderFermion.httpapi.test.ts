/**
 * WorkOrder Fermion HttpApi adapter tests
 *
 * Verifies that work-order Fermion fetch paths use unified IIoT HttpApi routes
 * (query + entity), not direct repository wiring.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect, Layer } from 'effect'
import { Registry } from '@effect-atom/atom'

import {
  fetchAllWorkOrders,
  fetchWorkOrdersByStatus,
  workOrderFermion,
} from '../workOrderFermion'

const AtomLayer = Layer.mergeAll(Registry.layer)

describe('workOrderFermion HttpApi adapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetchAllWorkOrders calls GET /api/queries/workorders', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const result = await Effect.runPromise(
      fetchAllWorkOrders.pipe(Effect.provide(AtomLayer)),
    )

    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/queries/workorders', undefined)
  })

  it('fetchWorkOrdersByStatus appends status query param', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const result = await Effect.runPromise(
      fetchWorkOrdersByStatus('created').pipe(Effect.provide(AtomLayer)),
    )

    expect(result).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/queries/workorders?status=created', undefined)
  })

  it('single fetch uses POST /api/workorders/work-order-get/:id', async () => {
    const fetchMock = vi.fn(async () =>
      new Response('not-found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const result = await Effect.runPromise(
      workOrderFermion.fetch('WO-test-001').pipe(
        Effect.provide(AtomLayer),
        Effect.either,
      ),
    )

    expect(result._tag).toBe('Left')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/workorders/work-order-get/WO-test-001',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workOrderId: 'WO-test-001' }),
      },
    )
  })
})
