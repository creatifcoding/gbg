/**
 * WorkOrderMachine Integration Tests
 *
 * Tests the WorkOrderMachine with real PostgreSQL persistence via SQL-backed
 * state services and WorkOrderTransitionRepo for FDA 21 CFR Part 11 compliance.
 *
 * Verifies:
 * - Full lifecycle with TransitionRepo audit trail
 * - Dual-write atomicity (status update + transition record)
 * - Event emission via feature flags
 * - Concurrent work orders with independent state
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   RUN_INTEGRATION_TESTS=1 bun test src/lib/iiot/__tests__/integration/machines/work-order-machine.integration.test.ts
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Machine } from '@effect/experimental'
import { SqlClient } from '@effect/sql'
import {
  makeWorkOrderMachine,
  InternalCreateWorkOrder,
  InternalGetWorkOrder,
  InternalSubmitWorkOrder,
  InternalApproveWorkOrder,
  InternalRejectWorkOrder,
  InternalStartWorkOrder,
  InternalSuspendWorkOrder,
  InternalResumeWorkOrder,
  InternalCompleteWorkOrder,
  InternalFailWorkOrder,
  InternalCancelWorkOrder,
  InternalCloseWorkOrder,
} from '../../../machines/WorkOrderMachine'
import { WorkOrderState } from '../../../state'
import type { DomainEventEmitterShape, WorkOrderLifecycleEmission, EquipmentStateChangedEmission } from '../../../services/events'
import { IIoTFeatureFlags } from '../../../infrastructure/feature-flags'
import { WorkOrderTransitionRepo } from '../../../repos'
import type { CreateWorkOrderInput } from '../../../state/StateShape'
import type { WorkflowDefinitionId } from '../../../schemas/identifiers'
import {
  WorkOrderMachineIntegrationLayer,
  withCleanMachineDatabase,
} from './layer'

// =============================================================================
// Test Constants
// =============================================================================

const RUN = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestWorkOrderInput = (overrides?: Partial<{
  workflowDefinitionId: string
  title: string
  description: string
  type: string
  priority: string
  createdBy: string
}>): CreateWorkOrderInput => ({
  workflowDefinitionId: (overrides?.workflowDefinitionId ?? 'WF-TEST-001') as WorkflowDefinitionId,
  workflowVersion: '1.0.0',
  title: overrides?.title ?? 'Test Work Order',
  description: overrides?.description ?? 'Test description',
  type: (overrides?.type ?? 'preventive_maintenance') as CreateWorkOrderInput['type'],
  priority: (overrides?.priority ?? 'normal') as CreateWorkOrderInput['priority'],
  createdBy: overrides?.createdBy ?? 'test-user-001',
  scheduledStart: Option.none(),
  dueDate: Option.none(),
  parentWorkOrderId: Option.none(),
  primaryAssetId: Option.none(),
  assignedTo: Option.none(),
  metadata: {},
})

/**
 * Boot a work order machine with all integration dependencies.
 */
const bootMachineWith = (eventEmitter?: DomainEventEmitterShape) => Effect.gen(function* () {
  const state = yield* WorkOrderState
  const flags = yield* IIoTFeatureFlags
  const transitionRepo = yield* WorkOrderTransitionRepo
  const sql = yield* SqlClient.SqlClient

  const machine = makeWorkOrderMachine({ state, flags, transitionRepo, sql, eventEmitter })
  const actor = yield* Machine.boot(machine)

  return { actor, transitionRepo }
})

const bootMachine = bootMachineWith()

const failSuspendEmitter: DomainEventEmitterShape = {
  emitWorkOrderLifecycle: (event: WorkOrderLifecycleEmission) =>
    failSuspendEmitter.emitWorkOrderLifecycleStrict(event).pipe(Effect.ignore),
  emitEquipmentStateChanged: (event: EquipmentStateChangedEmission) =>
    failSuspendEmitter.emitEquipmentStateChangedStrict(event).pipe(Effect.ignore),
  emitWorkOrderLifecycleStrict: (event: WorkOrderLifecycleEmission) =>
    event.tag === 'WorkOrderSuspended'
      ? Effect.fail(new Error('intentional suspend event failure'))
      : Effect.void,
  emitEquipmentStateChangedStrict: () => Effect.void,
}

const failCompleteEmitter: DomainEventEmitterShape = {
  emitWorkOrderLifecycle: (event: WorkOrderLifecycleEmission) =>
    failCompleteEmitter.emitWorkOrderLifecycleStrict(event).pipe(Effect.ignore),
  emitEquipmentStateChanged: (event: EquipmentStateChangedEmission) =>
    failCompleteEmitter.emitEquipmentStateChangedStrict(event).pipe(Effect.ignore),
  emitWorkOrderLifecycleStrict: (event: WorkOrderLifecycleEmission) =>
    event.tag === 'WorkOrderCompleted'
      ? Effect.fail(new Error('intentional complete event failure'))
      : Effect.void,
  emitEquipmentStateChangedStrict: () => Effect.void,
}

// =============================================================================
// Tests
// =============================================================================

describe.skipIf(!RUN)('WorkOrderMachine Integration', () => {
  // ---------------------------------------------------------------------------
  // 1. FDA 21 CFR Part 11 Lifecycle with TransitionRepo
  // ---------------------------------------------------------------------------
  describe('FDA 21 CFR Part 11 lifecycle with audit trail', () => {
    it.effect('full lifecycle: every transition creates an audit record', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          // CREATE
          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'FDA Lifecycle Test' }),
            })
          )
          expect(created.status).toBe('created')

          // SUBMIT
          const submitted = yield* actor.send(
            new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' })
          )
          expect(submitted.status).toBe('submitted')

          // APPROVE
          const approved = yield* actor.send(
            new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' })
          )
          expect(approved.status).toBe('approved')

          // START
          const started = yield* actor.send(
            new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' })
          )
          expect(started.status).toBe('started')

          // COMPLETE (dual-write: status + transition)
          const completed = yield* actor.send(
            new InternalCompleteWorkOrder({
              workOrderId: created.id,
              completedBy: 'technician-001',
              notes: 'Motor replaced successfully',
            })
          )
          expect(completed.status).toBe('completed')

          // CLOSE (dual-write: status + transition)
          const closed = yield* actor.send(
            new InternalCloseWorkOrder({ workOrderId: created.id, closedBy: 'supervisor-001' })
          )
          expect(closed.status).toBe('closed')

          // Verify GET returns final state
          const final = yield* actor.send(
            new InternalGetWorkOrder({ workOrderId: created.id })
          )
          expect(final.status).toBe('closed')

          // FDA AUDIT TRAIL: Verify TransitionRepo has records
          // The machine writes transitions for: complete, close
          // (reject, suspend, resume, cancel also write transitions)
          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          expect(transitions.length).toBeGreaterThanOrEqual(2)

          // Verify chronological ordering
          for (let i = 1; i < transitions.length; i++) {
            expect(transitions[i].transitionedAt.getTime()).toBeGreaterThanOrEqual(
              transitions[i - 1].transitionedAt.getTime()
            )
          }

          // Verify the last transition is to 'closed'
          const lastTransition = transitions[transitions.length - 1]
          expect(lastTransition.toState).toBe('closed')
          expect(Option.getOrNull(lastTransition.transitionedBy)).toBe('supervisor-001')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('failure path: create -> submit -> approve -> start -> fail -> close', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Failure Path Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

          const failed = yield* actor.send(
            new InternalFailWorkOrder({
              workOrderId: created.id,
              failedBy: 'technician-001',
              reason: 'Equipment damage',
            })
          )
          expect(failed.status).toBe('failed')

          const closed = yield* actor.send(
            new InternalCloseWorkOrder({ workOrderId: created.id, closedBy: 'supervisor-001' })
          )
          expect(closed.status).toBe('closed')

          // Verify close transition recorded with 'failed' -> 'closed'
          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          const closeTransition = transitions.find((t) => t.toState === 'closed')
          expect(closeTransition).toBeDefined()
          expect(closeTransition!.fromState).toBe('failed')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('rejection path: create -> submit -> reject with audit trail', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Rejection Path Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))

          const rejected = yield* actor.send(
            new InternalRejectWorkOrder({
              workOrderId: created.id,
              rejectedBy: 'supervisor-001',
              reason: 'Incomplete documentation',
            })
          )
          expect(rejected.status).toBe('rejected')

          // Verify reject transition recorded
          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          expect(transitions.length).toBeGreaterThanOrEqual(1)

          const rejectTransition = transitions.find((t) => t.toState === 'rejected')
          expect(rejectTransition).toBeDefined()
          expect(rejectTransition!.fromState).toBe('submitted')
          expect(Option.getOrNull(rejectTransition!.transitionedBy)).toBe('supervisor-001')
          expect(Option.getOrNull(rejectTransition!.reason)).toBe('Incomplete documentation')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('rolls back suspend state + transition when durable event emission fails', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const state = yield* WorkOrderState
          const { actor, transitionRepo } = yield* bootMachineWith(failSuspendEmitter)

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Suspend Event Rollback Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

          const failedSuspend = yield* actor.send(
            new InternalSuspendWorkOrder({
              workOrderId: created.id,
              suspendedBy: 'relationship-reactor-v1',
              reason: 'equipment_unavailable',
              expectedResume: Option.none(),
              causedByPropagationId: Option.none(),
            })
          ).pipe(Effect.either)

          expect(failedSuspend._tag).toBe('Left')

          const persisted = yield* state.get(created.id)
          expect(persisted.status).toBe('started')

          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          expect(transitions.find((transition) => transition.toState === 'suspended')).toBeUndefined()
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('rolls back complete state + transition when durable event emission fails', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const state = yield* WorkOrderState
          const { actor, transitionRepo } = yield* bootMachineWith(failCompleteEmitter)

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Complete Event Rollback Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

          const failedComplete = yield* actor.send(
            new InternalCompleteWorkOrder({
              workOrderId: created.id,
              completedBy: 'technician-001',
              notes: 'event sink down',
            })
          ).pipe(Effect.either)

          expect(failedComplete._tag).toBe('Left')

          const persisted = yield* state.get(created.id)
          expect(persisted.status).toBe('started')

          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          expect(transitions.find((transition) => transition.toState === 'completed')).toBeUndefined()
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('suspend/resume path with audit trail', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Suspend/Resume Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

          // SUSPEND
          const suspended = yield* actor.send(
            new InternalSuspendWorkOrder({
              workOrderId: created.id,
              suspendedBy: 'technician-001',
              reason: 'awaiting_parts',
              expectedResume: Option.none(),
              causedByPropagationId: Option.none(),
            })
          )
          expect(suspended.status).toBe('suspended')

          // RESUME
          const resumed = yield* actor.send(
            new InternalResumeWorkOrder({
              workOrderId: created.id,
              resumedBy: 'technician-001',
            })
          )
          expect(resumed.status).toBe('resumed')

          // Verify both suspend and resume transitions exist
          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)

          const suspendTransition = transitions.find((t) => t.toState === 'suspended')
          expect(suspendTransition).toBeDefined()
          expect(suspendTransition!.fromState).toBe('started')
          expect(Option.getOrNull(suspendTransition!.transitionedBy)).toBe('technician-001')
          expect(Option.getOrNull(suspendTransition!.reason)).toBe('awaiting_parts')

          const resumeTransition = transitions.find((t) => t.toState === 'resumed')
          expect(resumeTransition).toBeDefined()
          expect(resumeTransition!.fromState).toBe('suspended')
          expect(Option.getOrNull(resumeTransition!.transitionedBy)).toBe('technician-001')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('cancel path with audit trail', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Cancel Path Test' }),
            })
          )

          const cancelled = yield* actor.send(
            new InternalCancelWorkOrder({
              workOrderId: created.id,
              cancelledBy: 'supervisor-001',
              reason: 'No longer needed',
            })
          )
          expect(cancelled.status).toBe('cancelled')

          // Verify cancel transition recorded
          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          const cancelTransition = transitions.find((t) => t.toState === 'cancelled')
          expect(cancelTransition).toBeDefined()
          expect(cancelTransition!.fromState).toBe('created')
          expect(Option.getOrNull(cancelTransition!.transitionedBy)).toBe('supervisor-001')
          expect(Option.getOrNull(cancelTransition!.reason)).toBe('No longer needed')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )
  })

  // ---------------------------------------------------------------------------
  // 2. Dual-Write Atomicity
  // ---------------------------------------------------------------------------
  describe('dual-write atomicity', () => {
    it.effect('complete writes both status update and transition record atomically', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Dual-Write Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

          // COMPLETE triggers dual-write
          const completed = yield* actor.send(
            new InternalCompleteWorkOrder({
              workOrderId: created.id,
              completedBy: 'technician-001',
              notes: 'All tasks finished',
            })
          )

          // Verify status was updated
          expect(completed.status).toBe('completed')

          // Verify transition record was written in the same transaction
          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          const completeTransition = transitions.find((t) => t.toState === 'completed')
          expect(completeTransition).toBeDefined()
          expect(completeTransition!.fromState).toBe('started')
          expect(Option.getOrNull(completeTransition!.transitionedBy)).toBe('technician-001')
          expect(Option.getOrNull(completeTransition!.reason)).toBe('All tasks finished')

          // Verify the transition has a server-generated timestamp
          expect(completeTransition!.transitionedAt).toBeInstanceOf(Date)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('reject writes both status update and transition record atomically', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Reject Dual-Write Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))

          // REJECT triggers dual-write
          yield* actor.send(
            new InternalRejectWorkOrder({
              workOrderId: created.id,
              rejectedBy: 'supervisor-001',
              reason: 'Safety review needed',
            })
          )

          // Verify both the state and transition agree
          const wo = yield* actor.send(new InternalGetWorkOrder({ workOrderId: created.id }))
          expect(wo.status).toBe('rejected')

          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          const rejectTransition = transitions.find((t) => t.toState === 'rejected')
          expect(rejectTransition).toBeDefined()
          expect(rejectTransition!.fromState).toBe('submitted')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('cancel writes both status update and transition record atomically', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Cancel Dual-Write Test' }),
            })
          )

          // CANCEL triggers dual-write
          yield* actor.send(
            new InternalCancelWorkOrder({
              workOrderId: created.id,
              cancelledBy: 'supervisor-001',
              reason: 'Budget constraints',
            })
          )

          const wo = yield* actor.send(new InternalGetWorkOrder({ workOrderId: created.id }))
          expect(wo.status).toBe('cancelled')

          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
          const cancelTransition = transitions.find((t) => t.toState === 'cancelled')
          expect(cancelTransition).toBeDefined()
          expect(cancelTransition!.fromState).toBe('created')
          expect(Option.getOrNull(cancelTransition!.reason)).toBe('Budget constraints')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('suspend and resume each write transition records', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Suspend/Resume Dual-Write' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

          // SUSPEND dual-write
          yield* actor.send(
            new InternalSuspendWorkOrder({
              workOrderId: created.id,
              suspendedBy: 'technician-001',
              reason: 'awaiting_parts',
              expectedResume: Option.none(),
              causedByPropagationId: Option.none(),
            })
          )

          // RESUME dual-write
          yield* actor.send(
            new InternalResumeWorkOrder({
              workOrderId: created.id,
              resumedBy: 'technician-001',
            })
          )

          const transitions = yield* transitionRepo.getByWorkOrderId(created.id)

          // Verify both suspend and resume wrote transition records
          expect(transitions.some((t) => t.toState === 'suspended')).toBe(true)
          expect(transitions.some((t) => t.toState === 'resumed')).toBe(true)

          // Verify count - suspend + resume = 2 transitions
          const count = yield* transitionRepo.count(created.id)
          expect(count).toBe(2)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )
  })

  // ---------------------------------------------------------------------------
  // 3. Graph-Validated Transitions (Invalid paths)
  // ---------------------------------------------------------------------------
  describe('graph-validated transition enforcement', () => {
    it.effect('rejects invalid transition: created -> approved (must submit first)', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Invalid Transition Test' }),
            })
          )

          const result = yield* actor.send(
            new InternalApproveWorkOrder({
              workOrderId: created.id,
              approvedBy: 'supervisor-001',
            })
          ).pipe(Effect.either)

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('MachineWorkOrderInvalidTransitionError')
          }
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('rejects invalid transition: started -> cancelled (not allowed)', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Cancel Started Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

          const result = yield* actor.send(
            new InternalCancelWorkOrder({
              workOrderId: created.id,
              cancelledBy: 'supervisor-001',
              reason: 'Changed mind',
            })
          ).pipe(Effect.either)

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('MachineWorkOrderInvalidTransitionError')
          }
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('rejects invalid transition: started -> closed (must complete/fail first)', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Close Started Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

          const result = yield* actor.send(
            new InternalCloseWorkOrder({
              workOrderId: created.id,
              closedBy: 'supervisor-001',
            })
          ).pipe(Effect.either)

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('MachineWorkOrderInvalidTransitionError')
          }
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )
  })

  // ---------------------------------------------------------------------------
  // 4. Concurrent Work Orders
  // ---------------------------------------------------------------------------
  describe('concurrent work orders', () => {
    it.effect('multiple actors operate on different work orders independently', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          // Create two independent work orders
          const wo1 = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({
                title: 'Concurrent WO 1',
                createdBy: 'user-alpha',
              }),
            })
          )

          const wo2 = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({
                title: 'Concurrent WO 2',
                createdBy: 'user-beta',
              }),
            })
          )

          // Drive WO1 through submit -> approve -> start -> complete -> close
          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: wo1.id, submittedBy: 'user-alpha' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: wo1.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: wo1.id, startedBy: 'tech-001' }))

          // Drive WO2 through submit -> reject (different path)
          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: wo2.id, submittedBy: 'user-beta' }))
          yield* actor.send(
            new InternalRejectWorkOrder({
              workOrderId: wo2.id,
              rejectedBy: 'supervisor-002',
              reason: 'Insufficient budget',
            })
          )

          // Complete WO1
          yield* actor.send(
            new InternalCompleteWorkOrder({
              workOrderId: wo1.id,
              completedBy: 'tech-001',
              notes: 'Done',
            })
          )

          // Verify independent states
          const finalWo1 = yield* actor.send(new InternalGetWorkOrder({ workOrderId: wo1.id }))
          const finalWo2 = yield* actor.send(new InternalGetWorkOrder({ workOrderId: wo2.id }))

          expect(finalWo1.status).toBe('completed')
          expect(finalWo2.status).toBe('rejected')

          // Verify independent audit trails
          const transitions1 = yield* transitionRepo.getByWorkOrderId(wo1.id)
          const transitions2 = yield* transitionRepo.getByWorkOrderId(wo2.id)

          // WO1 has complete transition
          expect(transitions1.some((t) => t.toState === 'completed')).toBe(true)
          // WO2 has reject transition
          expect(transitions2.some((t) => t.toState === 'rejected')).toBe(true)

          // Audit trails don't cross
          expect(transitions1.every((t) => t.workOrderId === wo1.id)).toBe(true)
          expect(transitions2.every((t) => t.workOrderId === wo2.id)).toBe(true)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('transition count is correct for each work order', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor, transitionRepo } = yield* bootMachine

          // Create 3 work orders with different lifecycle depths
          const wo1 = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Count Test WO1' }),
            })
          )
          const wo2 = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Count Test WO2' }),
            })
          )
          const wo3 = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Count Test WO3' }),
            })
          )

          // WO1: cancel (1 transition)
          yield* actor.send(
            new InternalCancelWorkOrder({
              workOrderId: wo1.id,
              cancelledBy: 'supervisor-001',
              reason: 'Not needed',
            })
          )

          // WO2: submit -> reject (1 transition for reject)
          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: wo2.id, submittedBy: 'test-user-001' }))
          yield* actor.send(
            new InternalRejectWorkOrder({
              workOrderId: wo2.id,
              rejectedBy: 'supervisor-001',
              reason: 'Rejected',
            })
          )

          // WO3: full lifecycle through complete + close (2 transitions for complete, close)
          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: wo3.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: wo3.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: wo3.id, startedBy: 'technician-001' }))
          yield* actor.send(
            new InternalCompleteWorkOrder({
              workOrderId: wo3.id,
              completedBy: 'technician-001',
            })
          )
          yield* actor.send(
            new InternalCloseWorkOrder({
              workOrderId: wo3.id,
              closedBy: 'supervisor-001',
            })
          )

          // Verify transition counts
          const count1 = yield* transitionRepo.count(wo1.id)
          const count2 = yield* transitionRepo.count(wo2.id)
          const count3 = yield* transitionRepo.count(wo3.id)

          expect(count1).toBe(1) // cancel
          expect(count2).toBe(1) // reject
          expect(count3).toBe(2) // complete + close
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )
  })

  // ---------------------------------------------------------------------------
  // 5. Persistence Verification
  // ---------------------------------------------------------------------------
  describe('persistence verification', () => {
    it.effect('work order state persists across GET calls', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor } = yield* bootMachine

          const created = yield* actor.send(
            new InternalCreateWorkOrder({
              input: createTestWorkOrderInput({ title: 'Persistence Test' }),
            })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))

          // Multiple GETs should return consistent state
          const get1 = yield* actor.send(new InternalGetWorkOrder({ workOrderId: created.id }))
          const get2 = yield* actor.send(new InternalGetWorkOrder({ workOrderId: created.id }))

          expect(get1.status).toBe('submitted')
          expect(get2.status).toBe('submitted')
          expect(get1.id).toBe(get2.id)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )

    it.effect('non-existent work order returns error', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const { actor } = yield* bootMachine

          const result = yield* actor.send(
            new InternalGetWorkOrder({ workOrderId: 'WO-DOES-NOT-EXIST' })
          ).pipe(Effect.either)

          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('MachineWorkOrderNotFoundError')
          }
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderMachineIntegrationLayer)
      )
    )
  })
})
