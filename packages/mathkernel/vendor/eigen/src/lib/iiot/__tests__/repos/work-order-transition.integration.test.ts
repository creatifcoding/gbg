/**
 * WorkOrderTransitionRepo Integration Tests
 *
 * Tests for the normalized work_order_transitions table (FDA 21 CFR Part 11 audit trail).
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   RUN_INTEGRATION_TESTS=1 bun test src/lib/iiot/__tests__/repos/work-order-transition.integration.test.ts
 *
 * @module
 */

import { describe, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import {
  WorkOrderRepositoriesIntegrationLayer,
  cleanTestWorkOrders,
  isDatabaseAvailable,
  TestPgClient,
  setupTestHierarchy,
} from '../integration/layer'
import { WorkOrderTransitionRepo, WorkOrderRepo } from '../../repos'
import { testWorkOrder1Insert, testWorkOrder2Insert } from '../__fixtures__/fixtures'
import type { WorkOrderId } from '../../schemas/identifiers'

// =============================================================================
// Database Availability Check
// =============================================================================

const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// Tests
// =============================================================================

describe.skipIf(!RUN_INTEGRATION)('WorkOrderTransitionRepo Integration Tests', () => {
  // Store created work order IDs for cleanup
  let createdWorkOrderIds: WorkOrderId[] = []

  beforeAll(async () => {
    const available = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    )
    if (!available) {
      throw new Error(
        'Database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }

    // Setup test hierarchy (Enterprise, Site) for FK constraints
    await Effect.runPromise(
      setupTestHierarchy.pipe(Effect.provide(TestPgClient))
    )
  })

  afterAll(async () => {
    // Deleting work orders cascades to transitions via FK ON DELETE CASCADE
    await Effect.runPromise(
      cleanTestWorkOrders.pipe(Effect.provide(TestPgClient))
    )
  })

  // Helper to create a work order and track its ID for cleanup
  const createWorkOrder = Effect.gen(function* () {
    const repo = yield* WorkOrderRepo
    const workOrder = yield* repo.insert(testWorkOrder1Insert)
    return workOrder.id as WorkOrderId
  })

  describe('insert', () => {
    it.effect('should insert a transition record', () =>
      Effect.gen(function* () {
        const woRepo = yield* WorkOrderRepo
        const transitionRepo = yield* WorkOrderTransitionRepo

        // Create parent work order
        const workOrder = yield* woRepo.insert(testWorkOrder1Insert)
        const workOrderId = workOrder.id as WorkOrderId

        const transition = yield* transitionRepo.insert({
          workOrderId,
          fromState: 'created',
          toState: 'submitted',
          transitionedBy: Option.some('user-123'),
          reason: Option.some('Submitting for approval'),
        })

        expect(transition.workOrderId).toBe(workOrderId)
        expect(transition.fromState).toBe('created')
        expect(transition.toState).toBe('submitted')
        expect(Option.getOrNull(transition.transitionedBy)).toBe('user-123')
        expect(Option.getOrNull(transition.reason)).toBe('Submitting for approval')
        expect(transition.id).toBeDefined()
        expect(transition.transitionedAt).toBeDefined()

        // Cleanup
        yield* woRepo.delete(workOrderId)
      }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))
    )

    it.effect('should insert transition without optional fields', () =>
      Effect.gen(function* () {
        const woRepo = yield* WorkOrderRepo
        const transitionRepo = yield* WorkOrderTransitionRepo

        // Create parent work order
        const workOrder = yield* woRepo.insert(testWorkOrder2Insert)
        const workOrderId = workOrder.id as WorkOrderId

        const transition = yield* transitionRepo.insert({
          workOrderId,
          fromState: 'submitted',
          toState: 'approved',
          transitionedBy: Option.none(),
          reason: Option.none(),
        })

        expect(transition.workOrderId).toBe(workOrderId)
        expect(transition.fromState).toBe('submitted')
        expect(transition.toState).toBe('approved')
        expect(Option.isNone(transition.transitionedBy)).toBe(true)
        expect(Option.isNone(transition.reason)).toBe(true)

        // Cleanup
        yield* woRepo.delete(workOrderId)
      }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))
    )
  })

  describe('getByWorkOrderId', () => {
    it.effect('should return all transitions for a work order', () =>
      Effect.gen(function* () {
        const woRepo = yield* WorkOrderRepo
        const transitionRepo = yield* WorkOrderTransitionRepo

        // Create parent work order
        const workOrder = yield* woRepo.insert(testWorkOrder1Insert)
        const workOrderId = workOrder.id as WorkOrderId

        // Insert multiple transitions
        yield* transitionRepo.insert({
          workOrderId,
          fromState: 'created',
          toState: 'submitted',
          transitionedBy: Option.some('user-a'),
          reason: Option.none(),
        })

        yield* transitionRepo.insert({
          workOrderId,
          fromState: 'submitted',
          toState: 'approved',
          transitionedBy: Option.some('user-b'),
          reason: Option.some('Looks good'),
        })

        yield* transitionRepo.insert({
          workOrderId,
          fromState: 'approved',
          toState: 'started',
          transitionedBy: Option.some('user-c'),
          reason: Option.none(),
        })

        const transitions = yield* transitionRepo.getByWorkOrderId(workOrderId)

        expect(transitions.length).toBe(3)
        // Should be ordered by transitioned_at ASC (chronological)
        // transitionedAt is a JavaScript Date object from PostgreSQL
        for (let i = 1; i < transitions.length; i++) {
          expect(transitions[i].transitionedAt.getTime()).toBeGreaterThanOrEqual(
            transitions[i - 1].transitionedAt.getTime()
          )
        }

        // Cleanup
        yield* woRepo.delete(workOrderId)
      }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))
    )

    it.effect('should return empty array for work order with no transitions', () =>
      Effect.gen(function* () {
        const woRepo = yield* WorkOrderRepo
        const transitionRepo = yield* WorkOrderTransitionRepo

        // Create work order but don't add transitions
        const workOrder = yield* woRepo.insert(testWorkOrder1Insert)
        const workOrderId = workOrder.id as WorkOrderId

        const transitions = yield* transitionRepo.getByWorkOrderId(workOrderId)

        expect(transitions).toEqual([])

        // Cleanup
        yield* woRepo.delete(workOrderId)
      }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))
    )
  })

  describe('getLatest', () => {
    it.effect('should return the most recent transition', () =>
      Effect.gen(function* () {
        const woRepo = yield* WorkOrderRepo
        const transitionRepo = yield* WorkOrderTransitionRepo

        // Create parent work order
        const workOrder = yield* woRepo.insert(testWorkOrder1Insert)
        const workOrderId = workOrder.id as WorkOrderId

        // Insert transitions in order - DB timestamps are sequential
        yield* transitionRepo.insert({
          workOrderId,
          fromState: 'created',
          toState: 'submitted',
          transitionedBy: Option.none(),
          reason: Option.none(),
        })

        yield* transitionRepo.insert({
          workOrderId,
          fromState: 'submitted',
          toState: 'approved',
          transitionedBy: Option.none(),
          reason: Option.none(),
        })

        const latestInserted = yield* transitionRepo.insert({
          workOrderId,
          fromState: 'approved',
          toState: 'started',
          transitionedBy: Option.some('final-user'),
          reason: Option.none(),
        })

        const latest = yield* transitionRepo.getLatest(workOrderId)

        expect(Option.isSome(latest)).toBe(true)
        if (Option.isSome(latest)) {
          expect(latest.value.id).toBe(latestInserted.id)
          expect(latest.value.fromState).toBe('approved')
          expect(latest.value.toState).toBe('started')
        }

        // Cleanup
        yield* woRepo.delete(workOrderId)
      }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))
    )

    it.effect('should return None for work order with no transitions', () =>
      Effect.gen(function* () {
        const woRepo = yield* WorkOrderRepo
        const transitionRepo = yield* WorkOrderTransitionRepo

        // Create work order but don't add transitions
        const workOrder = yield* woRepo.insert(testWorkOrder1Insert)
        const workOrderId = workOrder.id as WorkOrderId

        const latest = yield* transitionRepo.getLatest(workOrderId)

        expect(Option.isNone(latest)).toBe(true)

        // Cleanup
        yield* woRepo.delete(workOrderId)
      }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))
    )
  })

  describe('count', () => {
    it.effect('should count transitions for a work order', () =>
      Effect.gen(function* () {
        const woRepo = yield* WorkOrderRepo
        const transitionRepo = yield* WorkOrderTransitionRepo

        // Create parent work order
        const workOrder = yield* woRepo.insert(testWorkOrder1Insert)
        const workOrderId = workOrder.id as WorkOrderId

        yield* transitionRepo.insert({
          workOrderId,
          fromState: 'created',
          toState: 'submitted',
          transitionedBy: Option.none(),
          reason: Option.none(),
        })

        yield* transitionRepo.insert({
          workOrderId,
          fromState: 'submitted',
          toState: 'approved',
          transitionedBy: Option.none(),
          reason: Option.none(),
        })

        const count = yield* transitionRepo.count(workOrderId)

        expect(count).toBe(2)

        // Cleanup
        yield* woRepo.delete(workOrderId)
      }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))
    )
  })

  describe('getAuditTrail', () => {
    it.effect('should return transitions in date range for FDA compliance', () =>
      Effect.gen(function* () {
        const woRepo = yield* WorkOrderRepo
        const transitionRepo = yield* WorkOrderTransitionRepo

        // Create parent work order
        const workOrder = yield* woRepo.insert(testWorkOrder1Insert)
        const workOrderId = workOrder.id as WorkOrderId

        const startDate = new Date()

        yield* transitionRepo.insert({
          workOrderId,
          fromState: 'created',
          toState: 'submitted',
          transitionedBy: Option.some('auditable-user'),
          reason: Option.some('FDA compliance test'),
        })

        const endDate = new Date(Date.now() + 1000)

        const auditTrail = yield* transitionRepo.getAuditTrail({
          workOrderId,
          startDate,
          endDate,
        })

        expect(auditTrail.length).toBeGreaterThanOrEqual(1)
        const found = auditTrail.find(
          (t) => Option.getOrNull(t.transitionedBy) === 'auditable-user'
        )
        expect(found).toBeDefined()

        // Cleanup
        yield* woRepo.delete(workOrderId)
      }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))
    )
  })
})
