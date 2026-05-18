/**
 * WorkOrderMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies FDA 21 CFR Part 11 state transitions are enforced.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Option } from 'effect'
import { Machine } from '@effect/experimental'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
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
} from '../../machines/WorkOrderMachine'
import { WorkOrderState, WorkOrderStateInMemory } from '../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
  makeFeatureFlagsLayer,
} from '../../infrastructure/feature-flags'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../infrastructure/eventlog-layer'
import { DomainEventEmitter, DomainEventEmitterLive } from '../../services/events'
import type { CreateWorkOrderInput } from '../../state/StateShape'
import type { PropagationId, WorkflowDefinitionId } from '../../schemas/identifiers'
import type { WorkOrderTransitionRepository } from '../../repos/WorkOrderTransitionRepo'

// =============================================================================
// Test Stubs (for dependencies not needed in unit tests)
// =============================================================================

/**
 * Stub WorkOrderTransitionRepository for unit tests.
 * The transition repo records audit trail - not needed for Machine unit tests.
 */
const stubTransitionRepo: WorkOrderTransitionRepository = {
  insert: () => Effect.succeed({} as never),
  getByWorkOrderId: () => Effect.succeed([]),
  getLatest: () => Effect.succeed(Option.none()),
  count: () => Effect.succeed(0),
  hasInboundPropagation: () => Effect.succeed(false),
  getAuditTrail: () => Effect.succeed([]),
}

/**
 * Stub SqlClient for unit tests.
 * The withTransaction method executes effects directly (no real transaction).
 */
const stubSqlClient = {
  withTransaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
} as unknown as SqlClient.SqlClient

const makeDomainEventEmitterLayer = (journal: EventJournal.EventJournal.Service) => {
  const baseLayer = Layer.mergeAll(
    Layer.succeed(EventJournal.EventJournal, journal),
    Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom()),
    IIoTDomainEventHandlersLayer,
  )

  return DomainEventEmitterLive.pipe(
    Layer.provide(IIoTEventLogLayer.pipe(Layer.provide(baseLayer))),
  )
}

const WorkOrderEventSourcingEnabledLayer = makeFeatureFlagsLayer({
  workOrderEventSourcingEnabled: true,
})

// =============================================================================
// Test Helpers
// =============================================================================

const createTestWorkOrderInput = (overrides?: Partial<{
  workflowDefinitionId: string
  title: string
  description: string
  type: string
  priority: string
}>): CreateWorkOrderInput => ({
  workflowDefinitionId: (overrides?.workflowDefinitionId ?? 'WF-TEST-001') as WorkflowDefinitionId,
  workflowVersion: '1.0.0',
  title: overrides?.title ?? 'Test Work Order',
  description: overrides?.description ?? 'Test description',
  type: (overrides?.type ?? 'preventive_maintenance') as CreateWorkOrderInput['type'],
  priority: (overrides?.priority ?? 'normal') as CreateWorkOrderInput['priority'],
  createdBy: 'test-user-001',
  scheduledStart: Option.none(),
  dueDate: Option.none(),
  parentWorkOrderId: Option.none(),
  primaryAssetId: Option.none(),
  assignedTo: Option.none(),
  metadata: {},
})

// =============================================================================
// Tests
// =============================================================================

describe('WorkOrderMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates a work order and returns it', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const workOrder = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput(),
          })
        )

        expect(workOrder.workflowDefinitionId).toBe('WF-TEST-001')
        expect(workOrder.title).toBe('Test Work Order')
        expect(workOrder.status).toBe('created')
        expect(workOrder.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput(),
          })
        )

        const fetched = yield* actor.send(
          new InternalGetWorkOrder({ workOrderId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.title).toBe(created.title)
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineWorkOrderNotFoundError for non-existent work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetWorkOrder({ workOrderId: 'WO-non-existent' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineWorkOrderNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('SUBMIT procedure (graph-validated)', () => {
    it.effect('submits a created work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput(),
          })
        )

        const submitted = yield* actor.send(
          new InternalSubmitWorkOrder({
            workOrderId: created.id,
            submittedBy: 'test-user-001',
          })
        )

        expect(submitted.status).toBe('submitted')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when submitting already submitted work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput(),
          })
        )

        // First submit succeeds
        yield* actor.send(
          new InternalSubmitWorkOrder({
            workOrderId: created.id,
            submittedBy: 'test-user-001',
          })
        )

        // Second submit fails (invalid transition)
        const result = yield* actor.send(
          new InternalSubmitWorkOrder({
            workOrderId: created.id,
            submittedBy: 'test-user-002',
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineWorkOrderInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('APPROVE procedure (graph-validated)', () => {
    it.effect('approves a submitted work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput(),
          })
        )

        yield* actor.send(
          new InternalSubmitWorkOrder({
            workOrderId: created.id,
            submittedBy: 'test-user-001',
          })
        )

        const approved = yield* actor.send(
          new InternalApproveWorkOrder({
            workOrderId: created.id,
            approvedBy: 'supervisor-001',
          })
        )

        expect(approved.status).toBe('approved')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when approving a non-submitted work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput(),
          })
        )

        // Try to approve without submitting first
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
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('REJECT procedure (graph-validated)', () => {
    it.effect('rejects a submitted work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput(),
          })
        )

        yield* actor.send(
          new InternalSubmitWorkOrder({
            workOrderId: created.id,
            submittedBy: 'test-user-001',
          })
        )

        const rejected = yield* actor.send(
          new InternalRejectWorkOrder({
            workOrderId: created.id,
            rejectedBy: 'supervisor-001',
            reason: 'Incomplete documentation',
          })
        )

        expect(rejected.status).toBe('rejected')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('START procedure (graph-validated)', () => {
    it.effect('starts an approved work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput(),
          })
        )

        yield* actor.send(
          new InternalSubmitWorkOrder({
            workOrderId: created.id,
            submittedBy: 'test-user-001',
          })
        )

        yield* actor.send(
          new InternalApproveWorkOrder({
            workOrderId: created.id,
            approvedBy: 'supervisor-001',
          })
        )

        const started = yield* actor.send(
          new InternalStartWorkOrder({
            workOrderId: created.id,
            startedBy: 'technician-001',
          })
        )

        expect(started.status).toBe('started')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('SUSPEND/RESUME procedure (graph-validated)', () => {
    it.effect('records inbound propagation id when Reactor-triggered suspend is requested', () =>
      Effect.gen(function* () {
        const captured: Array<Parameters<WorkOrderTransitionRepository['insert']>[0]> = []
        const capturingRepo: WorkOrderTransitionRepository = {
          ...stubTransitionRepo,
          insert: (transition) => {
            captured.push(transition)
            return Effect.succeed({} as never)
          },
          hasInboundPropagation: (_workOrderId, causedByPropagationId) =>
            Effect.succeed(captured.some((transition) =>
              Option.getOrNull(transition.causedByPropagationId) === causedByPropagationId
            )),
        }
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: capturingRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)
        const propagationId = 'PROP-REACTOR-UNIT-001' as PropagationId

        const created = yield* actor.send(
          new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
        )

        yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
        yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
        yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))
        yield* actor.send(new InternalSuspendWorkOrder({
          workOrderId: created.id,
          suspendedBy: 'relationship-reactor-v1',
          reason: 'equipment_unavailable',
          expectedResume: Option.none(),
          causedByPropagationId: Option.some(propagationId),
        }))
        const duplicate = yield* actor.send(new InternalSuspendWorkOrder({
          workOrderId: created.id,
          suspendedBy: 'relationship-reactor-v1',
          reason: 'equipment_unavailable',
          expectedResume: Option.none(),
          causedByPropagationId: Option.some(propagationId),
        }))

        const suspendTransitions = captured.filter((transition) => transition.toState === 'suspended')
        expect(duplicate.status).toBe('suspended')
        expect(suspendTransitions).toHaveLength(1)
        expect(Option.getOrNull(suspendTransitions[0]!.causedByPropagationId)).toBe(propagationId)
        expect(Option.isSome(suspendTransitions[0]!.propagationId)).toBe(true)
        expect(Option.getOrNull(suspendTransitions[0]!.propagationId)).toMatch(/^PROP-/)
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('suspends and resumes a started work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
        )

        yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
        yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
        yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

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

        const resumed = yield* actor.send(
          new InternalResumeWorkOrder({
            workOrderId: created.id,
            resumedBy: 'technician-001',
          })
        )

        expect(resumed.status).toBe('resumed')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('EVENT EMISSION', () => {
    it.effect('writes WorkOrderSuspended to the EventJournal when event sourcing is enabled', () =>
      Effect.gen(function* () {
        const journal = yield* EventJournal.makeMemory
        const emitterLayer = makeDomainEventEmitterLayer(journal)

        yield* Effect.gen(function* () {
          const state = yield* WorkOrderState
          const flags = yield* IIoTFeatureFlags
          const eventEmitter = yield* DomainEventEmitter
          const machine = makeWorkOrderMachine({
            state,
            flags,
            transitionRepo: stubTransitionRepo,
            sql: stubSqlClient,
            eventEmitter,
          })
          const actor = yield* Machine.boot(machine)

          const created = yield* actor.send(
            new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
          )

          yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
          yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
          yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))
          yield* actor.send(
            new InternalSuspendWorkOrder({
              workOrderId: created.id,
              suspendedBy: 'technician-001',
              reason: 'awaiting_parts',
              expectedResume: Option.none(),
              causedByPropagationId: Option.none(),
            })
          )

          const entries = yield* journal.entries
          const eventTags = entries.map((entry) => entry.event)

          expect(eventTags).toContain('WorkOrderSuspended')
          expect(eventTags.at(-1)).toBe('WorkOrderSuspended')
        }).pipe(
          Effect.scoped,
          Effect.provide(WorkOrderStateInMemory),
          Effect.provide(WorkOrderEventSourcingEnabledLayer),
          Effect.provide(emitterLayer),
        )
      })
    )
  })

  describe('COMPLETE procedure (graph-validated)', () => {
    it.effect('completes a started work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
        )

        yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
        yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
        yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

        const completed = yield* actor.send(
          new InternalCompleteWorkOrder({
            workOrderId: created.id,
            completedBy: 'technician-001',
            notes: 'Completed successfully',
          })
        )

        expect(completed.status).toBe('completed')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('FAIL procedure (graph-validated)', () => {
    it.effect('fails a started work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
        )

        yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
        yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
        yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

        const failed = yield* actor.send(
          new InternalFailWorkOrder({
            workOrderId: created.id,
            failedBy: 'technician-001',
            reason: 'Unable to complete due to equipment damage',
          })
        )

        expect(failed.status).toBe('failed')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('CANCEL procedure (graph-validated)', () => {
    it.effect('cancels a created work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
        )

        const cancelled = yield* actor.send(
          new InternalCancelWorkOrder({
            workOrderId: created.id,
            cancelledBy: 'supervisor-001',
            reason: 'No longer needed',
          })
        )

        expect(cancelled.status).toBe('cancelled')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when cancelling a started work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
        )

        yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
        yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
        yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

        // Try to cancel a started work order (not allowed)
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
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('CLOSE procedure (graph-validated)', () => {
    it.effect('closes a completed work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
        )

        yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
        yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
        yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))
        yield* actor.send(new InternalCompleteWorkOrder({ workOrderId: created.id, completedBy: 'technician-001' }))

        const closed = yield* actor.send(
          new InternalCloseWorkOrder({
            workOrderId: created.id,
            closedBy: 'supervisor-001',
          })
        )

        expect(closed.status).toBe('closed')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when closing a non-terminal work order', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkOrder({ input: createTestWorkOrderInput() })
        )

        yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: created.id, submittedBy: 'test-user-001' }))
        yield* actor.send(new InternalApproveWorkOrder({ workOrderId: created.id, approvedBy: 'supervisor-001' }))
        yield* actor.send(new InternalStartWorkOrder({ workOrderId: created.id, startedBy: 'technician-001' }))

        // Try to close a started work order (must complete or fail first)
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
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('FDA 21 CFR Part 11 lifecycle flow', () => {
    it.effect('completes full lifecycle: create → submit → approve → start → complete → close', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        // Create
        const workOrder = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput({ title: 'Full Lifecycle Test' }),
          })
        )
        expect(workOrder.status).toBe('created')

        // Submit
        const submitted = yield* actor.send(
          new InternalSubmitWorkOrder({ workOrderId: workOrder.id, submittedBy: 'test-user-001' })
        )
        expect(submitted.status).toBe('submitted')

        // Approve
        const approved = yield* actor.send(
          new InternalApproveWorkOrder({ workOrderId: workOrder.id, approvedBy: 'supervisor-001' })
        )
        expect(approved.status).toBe('approved')

        // Start
        const started = yield* actor.send(
          new InternalStartWorkOrder({ workOrderId: workOrder.id, startedBy: 'technician-001' })
        )
        expect(started.status).toBe('started')

        // Complete
        const completed = yield* actor.send(
          new InternalCompleteWorkOrder({
            workOrderId: workOrder.id,
            completedBy: 'technician-001',
            notes: 'Work completed successfully',
          })
        )
        expect(completed.status).toBe('completed')

        // Close
        const closed = yield* actor.send(
          new InternalCloseWorkOrder({ workOrderId: workOrder.id, closedBy: 'supervisor-001' })
        )
        expect(closed.status).toBe('closed')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetWorkOrder({ workOrderId: workOrder.id })
        )
        expect(final.status).toBe('closed')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('completes failure path: create → submit → approve → start → fail → close', () =>
      Effect.gen(function* () {
        const state = yield* WorkOrderState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkOrderMachine({
          state,
          flags,
          transitionRepo: stubTransitionRepo,
          sql: stubSqlClient,
        })
        const actor = yield* Machine.boot(machine)

        const workOrder = yield* actor.send(
          new InternalCreateWorkOrder({
            input: createTestWorkOrderInput({ title: 'Failure Path Test' }),
          })
        )

        yield* actor.send(new InternalSubmitWorkOrder({ workOrderId: workOrder.id, submittedBy: 'test-user-001' }))
        yield* actor.send(new InternalApproveWorkOrder({ workOrderId: workOrder.id, approvedBy: 'supervisor-001' }))
        yield* actor.send(new InternalStartWorkOrder({ workOrderId: workOrder.id, startedBy: 'technician-001' }))

        const failed = yield* actor.send(
          new InternalFailWorkOrder({
            workOrderId: workOrder.id,
            failedBy: 'technician-001',
            reason: 'Equipment damage',
          })
        )
        expect(failed.status).toBe('failed')

        const closed = yield* actor.send(
          new InternalCloseWorkOrder({ workOrderId: workOrder.id, closedBy: 'supervisor-001' })
        )
        expect(closed.status).toBe('closed')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkOrderStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
