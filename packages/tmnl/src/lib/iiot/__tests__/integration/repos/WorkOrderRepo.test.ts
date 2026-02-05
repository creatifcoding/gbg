/**
 * WorkOrderRepo Integration Tests
 *
 * Tests ISA-95 work order CRUD operations and lifecycle transitions.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   bun run test:run src/lib/iiot/__tests__/integration/repos/WorkOrderRepo.test.ts
 *
 * @module
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Effect, Option } from 'effect'
import {
  WorkOrderRepositoriesIntegrationLayer,
  cleanTestWorkOrders,
  isDatabaseAvailable,
  TestPgClient,
  setupTestHierarchy,
} from '../layer'
import { WorkOrderRepo } from '../../../repos/WorkOrderRepo'
import {
  testIds,
  testWorkOrder1Insert,
  testWorkOrder2Insert,
} from '../../__fixtures__/fixtures'
import type { WorkOrderId } from '../../../schemas/identifiers'

// =============================================================================
// Database Availability Check
// =============================================================================

const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

describe.skipIf(!RUN_INTEGRATION)('WorkOrderRepo Integration Tests', () => {
  let dbAvailable = false

  beforeAll(async () => {
    const available = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(TestPgClient))
    )
    if (!available) {
      throw new Error(
        'Database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
    }
    dbAvailable = true

    // Setup test hierarchy (Enterprise, Site) for FK constraints
    await Effect.runPromise(
      setupTestHierarchy.pipe(Effect.provide(TestPgClient))
    )
  })

  afterAll(async () => {
    await Effect.runPromise(
      cleanTestWorkOrders.pipe(Effect.provide(TestPgClient))
    )
  })

  // =============================================================================
  // Feature: Basic CRUD Operations
  // =============================================================================

  describe('Feature: Basic CRUD Operations', () => {
    describe('Scenario: Insert and find work order', () => {
      it('should insert a work order and find by id', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert
          const inserted = yield* repo.insert(testWorkOrder1Insert)
          // Note: Model.Class doesn't have _tag, check id pattern instead
          expect(inserted.id).toMatch(/^WO-/)
          expect(inserted.title).toBe(testWorkOrder1Insert.title)
          expect(inserted.type).toBe('preventive_maintenance')
          expect(inserted.status).toBe('created')

          // Find by ID
          const found = yield* repo.findById(inserted.id as WorkOrderId)
          expect(Option.isSome(found)).toBe(true)
          if (Option.isSome(found)) {
            expect(found.value.id).toBe(inserted.id)
            expect(found.value.title).toBe(testWorkOrder1Insert.title)
          }

          // Cleanup
          yield* repo.delete(inserted.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })

      it('should return None for non-existent work order', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          const result = yield* repo.findById(testIds.nonExistentWorkOrder)
          expect(Option.isNone(result)).toBe(true)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Update work order', () => {
      it('should update work order fields', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert
          const inserted = yield* repo.insert(testWorkOrder1Insert)

          // Update
          const updated = yield* repo.update({
            id: inserted.id as WorkOrderId,
            priority: 'high',
            assignedTo: Option.some('new-assignee'),
          })
          expect(updated.priority).toBe('high')
          expect(Option.getOrNull(updated.assignedTo)).toBe('new-assignee')

          // Cleanup
          yield* repo.delete(inserted.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Delete work order', () => {
      it('should delete work order', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert
          const inserted = yield* repo.insert(testWorkOrder2Insert)

          // Delete
          yield* repo.delete(inserted.id as WorkOrderId)

          // Verify deleted
          const found = yield* repo.findById(inserted.id as WorkOrderId)
          expect(Option.isNone(found)).toBe(true)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: Query Operations
  // =============================================================================

  describe('Feature: Query Operations', () => {
    describe('Scenario: Find by status', () => {
      it('should find work orders by status', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert two work orders with different statuses
          const wo1 = yield* repo.insert(testWorkOrder1Insert)
          const wo2 = yield* repo.insert({
            ...testWorkOrder2Insert,
            status: 'approved',
          })

          // Find by status
          const created = yield* repo.findByStatus('created')
          expect(created.some((wo) => wo.id === wo1.id)).toBe(true)

          const approved = yield* repo.findByStatus('approved')
          expect(approved.some((wo) => wo.id === wo2.id)).toBe(true)

          // Cleanup
          yield* repo.delete(wo1.id as WorkOrderId)
          yield* repo.delete(wo2.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Find open work orders', () => {
      it('should find all non-terminal work orders', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert work order
          const wo = yield* repo.insert(testWorkOrder1Insert)

          // Find open
          const open = yield* repo.findOpen()
          expect(open.some((item) => item.id === wo.id)).toBe(true)

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Query with filters', () => {
      it('should query with multiple filters', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert
          const wo = yield* repo.insert(testWorkOrder1Insert)

          // Query with filters
          const results = yield* repo.query({
            type: 'preventive_maintenance',
            priority: 'normal',
            limit: 10,
          })
          expect(results.some((item) => item.id === wo.id)).toBe(true)

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: Lifecycle Transitions
  // =============================================================================

  describe('Feature: Lifecycle Transitions', () => {
    describe('Scenario: Start work order', () => {
      it('should transition to started with actualStart timestamp', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert
          const wo = yield* repo.insert(testWorkOrder1Insert)
          expect(wo.status).toBe('created')
          expect(Option.isNone(wo.actualStart)).toBe(true)

          // Start
          const started = yield* repo.start(wo.id as WorkOrderId)
          expect(started.status).toBe('started')
          expect(Option.isSome(started.actualStart)).toBe(true)

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })

      it('should be idempotent for already started work order', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert and start
          const wo = yield* repo.insert(testWorkOrder1Insert)
          const started1 = yield* repo.start(wo.id as WorkOrderId)

          // Start again (idempotent)
          const started2 = yield* repo.start(wo.id as WorkOrderId)
          expect(started2.id).toBe(started1.id)
          expect(started2.status).toBe('started')

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Complete work order', () => {
      it('should transition to completed with summary and outcome', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert and start
          const wo = yield* repo.insert(testWorkOrder1Insert)
          yield* repo.start(wo.id as WorkOrderId)

          // Complete
          const completed = yield* repo.complete(wo.id as WorkOrderId, 'Work completed successfully')
          expect(completed.status).toBe('completed')
          expect(Option.getOrNull(completed.summary)).toBe('Work completed successfully')
          expect(Option.getOrNull(completed.outcome)).toBe('success')
          expect(Option.isSome(completed.actualEnd)).toBe(true)

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })

    describe('Scenario: Cancel work order', () => {
      it('should transition to cancelled with reason', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert
          const wo = yield* repo.insert(testWorkOrder1Insert)

          // Cancel
          const cancelled = yield* repo.cancel(wo.id as WorkOrderId, 'Resources unavailable')
          expect(cancelled.status).toBe('cancelled')
          expect(Option.getOrNull(cancelled.cancellationReason)).toBe('Resources unavailable')
          expect(Option.getOrNull(cancelled.finalStatus)).toBe('cancelled_before_start')

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })

      it('should set correct finalStatus when cancelled during execution', async () => {
        
        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert and start
          const wo = yield* repo.insert(testWorkOrder1Insert)
          yield* repo.start(wo.id as WorkOrderId)

          // Cancel
          const cancelled = yield* repo.cancel(wo.id as WorkOrderId, 'Emergency shutdown')
          expect(cancelled.status).toBe('cancelled')
          expect(Option.getOrNull(cancelled.finalStatus)).toBe('cancelled_during_execution')

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })
  })

  // =============================================================================
  // Feature: Status Predicates (Model-based, not Entity methods)
  // =============================================================================

  describe('Feature: Status Predicates', () => {
    describe('Scenario: WorkOrder status checks', () => {
      // Note: Model.Class doesn't have entity methods like isActive(), isExecuting()
      // We check status directly instead

      const ACTIVE_STATUSES = ['created', 'submitted', 'approved', 'started', 'suspended']
      const EXECUTING_STATUSES = ['started', 'suspended']

      it('should correctly identify active work orders via status', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert
          const wo = yield* repo.insert(testWorkOrder1Insert)
          expect(ACTIVE_STATUSES.includes(wo.status)).toBe(true)

          // Start
          const started = yield* repo.start(wo.id as WorkOrderId)
          expect(ACTIVE_STATUSES.includes(started.status)).toBe(true)
          expect(EXECUTING_STATUSES.includes(started.status)).toBe(true)

          // Complete
          const completed = yield* repo.complete(wo.id as WorkOrderId, 'Done')
          expect(ACTIVE_STATUSES.includes(completed.status)).toBe(false)
          expect(EXECUTING_STATUSES.includes(completed.status)).toBe(false)

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })

      it('should have correct status transitions', async () => {

        const program = Effect.gen(function* () {
          const repo = yield* WorkOrderRepo

          // Insert - created state
          const wo = yield* repo.insert(testWorkOrder1Insert)
          expect(wo.status).toBe('created')

          // Start - started state
          const started = yield* repo.start(wo.id as WorkOrderId)
          expect(started.status).toBe('started')

          // Complete - completed state (terminal)
          const completed = yield* repo.complete(wo.id as WorkOrderId, 'Done')
          expect(completed.status).toBe('completed')

          // Cleanup
          yield* repo.delete(wo.id as WorkOrderId)
        }).pipe(Effect.provide(WorkOrderRepositoriesIntegrationLayer))

        await Effect.runPromise(program)
      })
    })
  })
})
