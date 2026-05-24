/** WorkOrder dependency release trial tests. */

import { DateTime, Effect, Layer, Option, Ref } from 'effect'
import { describe, expect, it } from 'vitest'
import type {
  PropagationId,
  ReactorConstraintId,
  WorkOrderId,
  WorkflowDefinitionId,
} from '../../../schemas/identifiers'
import {
  EntityCapabilityIds,
  RelationshipEndpoint,
} from '../../../schemas/relationships'
import { WorkOrder, type WorkOrderStatus } from '../../../schemas/work-orders'
import {
  EntityReactionRequest,
  ObservationSignal,
  ReactorCausality,
  TargetConstraintReconciliationResult,
} from '../../../schemas/reactor'
import { WorkOrderState, WorkOrderStateInMemory } from '../../../state'
import {
  ReactorConstraintAuthority,
  type ReactorConstraintAuthorityShape,
} from '../ReactorConstraintAuthority'
import {
  WorkOrderDependencyRelease,
  WorkOrderDependencyReleaseLive,
  WorkOrderDependencyReleaseTransition,
} from '../contracts/WorkOrderDependencyRelease'
import { ReactorAdmissionControlLive } from '../ReactorAdmissionControl'

const target = new RelationshipEndpoint({ type: 'work_order', id: 'WO-DEP-RELEASE-001' })
const source = new RelationshipEndpoint({ type: 'machine', id: 'MCH-DEP-RELEASE-001' })
const constraintId = 'rc_0123456789abcdef0123456789abcdef' as ReactorConstraintId
const propagationId = 'PROP-WO-DEP-RELEASE-001' as PropagationId

const request = new EntityReactionRequest({
  requestId: 'request:wo:release:001' as never,
  capability: EntityCapabilityIds.DependencyReleased,
  source,
  target,
  signal: new ObservationSignal({
    axis: 'equipment.availability',
    kind: 'condition_retracted',
    value: 'available',
    previousValue: 'unavailable',
    reason: 'unit-test-release',
  }),
  policyId: 'requires.equipment-available.releases-source' as never,
  policyVersion: '1',
  causality: new ReactorCausality({ propagationId }),
  payload: { constraintId },
})

const makeWorkOrder = (status: WorkOrderStatus) => new WorkOrder({
  id: target.id as WorkOrderId,
  workflowDefinitionId: 'WF-WO-DEP-RELEASE' as WorkflowDefinitionId,
  workflowVersion: '1',
  title: 'WorkOrder dependency release fixture',
  description: 'Target-owned dependency release trial',
  type: 'preventive_maintenance',
  priority: 'normal',
  status,
  createdBy: 'reactor-release-test',
  createdAt: DateTime.unsafeNow(),
  scheduledStart: Option.none(),
  dueDate: Option.none(),
  actualStart: Option.none(),
  actualEnd: Option.none(),
  parentWorkOrderId: Option.none(),
  primaryAssetId: Option.some(source.id as never),
  assignedTo: Option.none(),
  outcome: Option.none(),
  summary: Option.none(),
  failedTaskId: Option.none(),
  failureReason: Option.none(),
  suspensionReason: status === 'suspended' ? Option.some('equipment_unavailable') : Option.none(),
  expectedResume: Option.none(),
  cancellationReason: Option.none(),
  compensationRequired: false,
  finalStatus: Option.none(),
  metadata: {},
  transitions: [],
})

const reconciliation = (input: {
  readonly verdict: 'constraint_retracted' | 'active_holds_remaining' | 'idempotent' | 'unknown_constraint'
  readonly activeConstraintCount: number
}) => new TargetConstraintReconciliationResult({
  target,
  capability: EntityCapabilityIds.DependencyReleased,
  constraintId,
  verdict: input.verdict,
  activeConstraintCount: input.activeConstraintCount,
})

const AuthorityLayer = (result: TargetConstraintReconciliationResult) => Layer.succeed(
  ReactorConstraintAuthority,
  ReactorConstraintAuthority.of({
    assert: () => Effect.die('assert not used in WorkOrder release tests'),
    retract: () => Effect.succeed(result),
    retractFromReactionRequest: () => Effect.succeed(result),
    activeForTarget: () => Effect.succeed([]),
  } satisfies ReactorConstraintAuthorityShape),
)

const TransitionLayer = (resumeCalls: Ref.Ref<number>, delayMs = 0) => Layer.effect(
  WorkOrderDependencyReleaseTransition,
  Effect.gen(function* () {
    const state = yield* WorkOrderState

    return WorkOrderDependencyReleaseTransition.of({
      resume: (input) =>
        Effect.gen(function* () {
          yield* Ref.update(resumeCalls, (count) => count + 1)
          const current = yield* state.get(input.workOrderId)
          if (delayMs > 0) yield* Effect.sleep(`${delayMs} millis`)
          const resumed = new WorkOrder({
            ...current,
            status: 'resumed',
            suspensionReason: Option.none(),
            expectedResume: Option.none(),
          })
          yield* state.set(resumed)
          return resumed
        }),
    })
  }),
)

const runScenario = (
  status: WorkOrderStatus,
  authorityResult: TargetConstraintReconciliationResult,
) => Effect.gen(function* () {
  const resumeCalls = yield* Ref.make(0)
  const program = Effect.gen(function* () {
    const state = yield* WorkOrderState
    const release = yield* WorkOrderDependencyRelease

    yield* state.set(makeWorkOrder(status))
    const result = yield* release.dispatch(request)
    const workOrder = yield* state.get(target.id as WorkOrderId)
    const calls = yield* Ref.get(resumeCalls)

    return { result, workOrder, calls }
  })

  return yield* program.pipe(
    Effect.provide(WorkOrderDependencyReleaseLive),
    Effect.provide(TransitionLayer(resumeCalls)),
    Effect.provide(AuthorityLayer(authorityResult)),
    Effect.provide(WorkOrderStateInMemory),
  )
})

describe('WorkOrderDependencyRelease', () => {
  it('resumes a suspended WorkOrder when SQL authority reports all constraints clear', async () => {
    const { result, workOrder, calls } = await Effect.runPromise(
      runScenario('suspended', reconciliation({ verdict: 'constraint_retracted', activeConstraintCount: 0 })),
    )

    expect(result.verdict).toBe('released')
    expect(result.targetState).toBe('resumed')
    expect(workOrder.status).toBe('resumed')
    expect(calls).toBe(1)
  })

  it('keeps a suspended WorkOrder held when active constraints remain', async () => {
    const { result, workOrder, calls } = await Effect.runPromise(
      runScenario('suspended', reconciliation({ verdict: 'active_holds_remaining', activeConstraintCount: 1 })),
    )

    expect(result.verdict).toBe('active_holds_remaining')
    expect(result.activeConstraintCount).toBe(1)
    expect(workOrder.status).toBe('suspended')
    expect(calls).toBe(0)
  })

  it('does not resume when SQL authority reports an unknown or stale constraint', async () => {
    const { result, workOrder, calls } = await Effect.runPromise(
      runScenario('suspended', reconciliation({ verdict: 'unknown_constraint', activeConstraintCount: 0 })),
    )

    expect(result.verdict).toBe('unknown_constraint')
    expect(workOrder.status).toBe('suspended')
    expect(calls).toBe(0)
  })

  it('treats duplicate release as idempotent and does not resume again', async () => {
    const { result, workOrder, calls } = await Effect.runPromise(
      runScenario('resumed', reconciliation({ verdict: 'idempotent', activeConstraintCount: 0 })),
    )

    expect(result.verdict).toBe('idempotent')
    expect(workOrder.status).toBe('resumed')
    expect(calls).toBe(0)
  })

  it('vetoes automatic resume for terminal WorkOrder state even after constraint retraction', async () => {
    const { result, workOrder, calls } = await Effect.runPromise(
      runScenario('closed', reconciliation({ verdict: 'constraint_retracted', activeConstraintCount: 0 })),
    )

    expect(result.verdict).toBe('terminal_state')
    expect(result.targetState).toBe('closed')
    expect(workOrder.status).toBe('closed')
    expect(calls).toBe(0)
  })

  it('does not resume a non-suspended WorkOrder after constraint retraction', async () => {
    const { result, workOrder, calls } = await Effect.runPromise(
      runScenario('started', reconciliation({ verdict: 'constraint_retracted', activeConstraintCount: 0 })),
    )

    expect(result.verdict).toBe('constraint_retracted')
    expect(result.targetState).toBe('started')
    expect(workOrder.status).toBe('started')
    expect(calls).toBe(0)
  })

  it('serializes concurrent all-clear release reconciliation by target', async () => {
    const { results, workOrder, calls } = await Effect.runPromise(Effect.gen(function* () {
      const resumeCalls = yield* Ref.make(0)
      const program = Effect.gen(function* () {
        const state = yield* WorkOrderState
        const release = yield* WorkOrderDependencyRelease

        yield* state.set(makeWorkOrder('suspended'))
        const results = yield* Effect.all([
          release.dispatch(request),
          release.dispatch(request),
        ], { concurrency: 'unbounded' })
        const workOrder = yield* state.get(target.id as WorkOrderId)
        const calls = yield* Ref.get(resumeCalls)

        return { results, workOrder, calls }
      })

      return yield* program.pipe(
        Effect.provide(WorkOrderDependencyReleaseLive.pipe(Layer.provide(ReactorAdmissionControlLive))),
        Effect.provide(TransitionLayer(resumeCalls, 10)),
        Effect.provide(AuthorityLayer(reconciliation({ verdict: 'constraint_retracted', activeConstraintCount: 0 }))),
        Effect.provide(WorkOrderStateInMemory),
      )
    }))

    expect(calls).toBe(1)
    expect(workOrder.status).toBe('resumed')
    expect(results.map((result) => result.verdict).sort()).toEqual([
      'constraint_retracted',
      'released',
    ])
  })
})
