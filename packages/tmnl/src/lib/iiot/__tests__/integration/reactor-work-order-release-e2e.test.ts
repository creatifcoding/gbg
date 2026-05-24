/**
 * SQL-backed Reactor -> WorkOrder dependency release vertical slice.
 *
 * Proves the quilt seam:
 *   SQL constraint authority
 *     -> target-owned WorkOrder release adapter
 *     -> WorkOrderEntity / WorkOrderMachine resume transition
 *     -> transition audit caused_by_propagation_id
 *     -> WorkOrderResumed domain event causality payload
 */

import { beforeAll, afterEach, describe, expect, it } from 'vitest'
import { Effect, Layer, Option, Schema } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { PgClient } from '@effect/sql-pg'
import type {
  AssetId,
  PropagationId,
  WorkOrderId,
} from '../../schemas/identifiers'
import {
  EntityCapabilityIds,
  RelationshipEndpoint,
} from '../../schemas/relationships'
import {
  EntityReactionRequest,
  ObservationSignal,
  ReactorCausality,
  ReactorConstraintAssertion,
  ReactorConstraintNaturalAddress,
  type ReactorPolicyEpoch,
  type ReactorRegistryFingerprint,
} from '../../schemas/reactor'
import { WorkOrderEvents } from '../../schemas/events/groups'
import { WorkOrderState } from '../../state'
import {
  WorkOrderEntity,
  WorkOrderEntityHandlers,
} from '../../entity/WorkOrderEntity'
import {
  DomainEventEmitterLive,
} from '../../services/events'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../infrastructure/eventlog-layer'
import {
  ReactorAdmissionControlLive,
  ReactorConstraintAuthority,
  ReactorConstraintAuthoritySqlLive,
  WorkOrderDependencyRelease,
  WorkOrderDependencyReleaseLive,
  WorkOrderDependencyReleaseTransition,
} from '../../services/reactor'
import {
  WorkOrderTransitionRepo,
} from '../../repos'
import {
  TestPgClientWithMigrations,
  EventJournalIntegrationLayer,
  isDatabaseAvailable,
} from './layer'
import {
  WorkOrderMachineIntegrationLayer,
  cleanMachineTestData,
  setupMachineTestHierarchy,
} from './machines/layer'

const TestShardingConfig = ShardingConfig.layer({
  shardsPerGroup: 10,
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5000,
  sendRetryInterval: 100,
})

const TEST_TARGET_ID = 'TEST-WO-REACTOR-RELEASE-E2E-001' as WorkOrderId
const TEST_SOURCE_ID = 'TEST-MCH-REACTOR-RELEASE-E2E-001' as AssetId
const ASSERTION_PROPAGATION_ID = 'PROP-REACTOR-RELEASE-E2E-ASSERT' as PropagationId
const RELEASE_PROPAGATION_ID = 'PROP-REACTOR-RELEASE-E2E-RELEASE' as PropagationId

const target = new RelationshipEndpoint({ type: 'work_order', id: TEST_TARGET_ID })
const source = new RelationshipEndpoint({ type: 'machine', id: TEST_SOURCE_ID })

const releaseSignal = new ObservationSignal({
  axis: 'equipment.availability',
  kind: 'condition_retracted',
  value: 'available',
  previousValue: 'unavailable',
  reason: 'vertical-slice-release',
})

const blockingAssertion = new ReactorConstraintAssertion({
  target,
  capability: EntityCapabilityIds.DependencyBlocked,
  family: 'dependency',
  source,
  relationshipEdgeType: 'requires',
  policyId: 'requires.equipment-unavailable.blocks-source' as never,
  policyVersion: '1',
  policyEpoch: 'reactor-policy-epoch.release-e2e' as ReactorPolicyEpoch,
  registryFingerprint: 'fnv1a32:release-e2e' as ReactorRegistryFingerprint,
  sourceEntryId: 'release-e2e.assertion.entry' as never,
  sourceEvent: 'FaultDetected',
  propagationId: ASSERTION_PROPAGATION_ID,
  effect: 'blocking',
  metadata: { fixture: 'reactor-work-order-release-e2e' },
})

const naturalAddress = new ReactorConstraintNaturalAddress({
  target: blockingAssertion.target,
  capability: blockingAssertion.capability,
  source: blockingAssertion.source,
  relationshipEdgeType: blockingAssertion.relationshipEdgeType,
  policyId: blockingAssertion.policyId,
  propagationId: blockingAssertion.propagationId,
})

const releaseRequest = new EntityReactionRequest({
  requestId: 'request.release.e2e.001' as never,
  capability: EntityCapabilityIds.DependencyReleased,
  source,
  target,
  signal: releaseSignal,
  policyId: 'requires.equipment-available.releases-source' as never,
  policyVersion: '1',
  causality: new ReactorCausality({ propagationId: RELEASE_PROPAGATION_ID }),
  payload: {
    naturalAddress,
    metadata: { fixture: 'reactor-work-order-release-e2e' },
  },
})

const EventEmitterSqlLayer = DomainEventEmitterLive.pipe(
  Layer.provide(IIoTEventLogLayer.pipe(
    Layer.provide(Layer.mergeAll(
      EventJournalIntegrationLayer,
      Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom()),
      IIoTDomainEventHandlersLayer,
    )),
  )),
)

const WorkOrderEntityHandlerIntegrationLayer = WorkOrderEntityHandlers.pipe(
  Layer.provide(Layer.mergeAll(
    WorkOrderMachineIntegrationLayer,
    EventEmitterSqlLayer,
  )),
)

const WorkOrderEntityReleaseTransitionLayer = Layer.effect(
  WorkOrderDependencyReleaseTransition,
  Effect.gen(function* () {
    const makeClient = yield* Entity.makeTestClient(
      WorkOrderEntity,
      WorkOrderEntityHandlerIntegrationLayer,
    )

    return WorkOrderDependencyReleaseTransition.of({
      resume: (input) => Effect.gen(function* () {
        const client = yield* makeClient(input.workOrderId)
        return yield* client.WorkOrder.Resume({
          workOrderId: input.workOrderId,
          notes: Option.some(input.note),
          causedByPropagationId: Option.some(input.causedByPropagationId),
        })
      }),
    })
  }),
)

const ConstraintAuthorityLayer = ReactorConstraintAuthoritySqlLive.pipe(
  Layer.provide(TestPgClientWithMigrations),
)

const ReleaseVerticalDependenciesLayer = Layer.mergeAll(
  WorkOrderMachineIntegrationLayer,
  EventEmitterSqlLayer,
  ReactorAdmissionControlLive,
  ConstraintAuthorityLayer,
  WorkOrderEntityReleaseTransitionLayer,
)

const ReleaseVerticalLayer = Layer.merge(
  ReleaseVerticalDependenciesLayer,
  WorkOrderDependencyReleaseLive.pipe(Layer.provide(ReleaseVerticalDependenciesLayer)),
)

const cleanupReleaseE2E = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    DELETE FROM iiot.reactor_constraints
    WHERE target_id = ${TEST_TARGET_ID}
       OR source_id = ${TEST_SOURCE_ID}
  `.pipe(Effect.ignore)
  yield* cleanMachineTestData
})

const setupSuspendedWorkOrder = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    INSERT INTO iiot.work_orders (
      id,
      workflow_definition_id,
      workflow_version,
      title,
      description,
      type,
      priority,
      status,
      created_by,
      primary_asset_id,
      suspension_reason,
      metadata
    ) VALUES (
      ${TEST_TARGET_ID},
      ${'WF-REACTOR-RELEASE-E2E'},
      ${'1'},
      ${'Reactor release vertical slice fixture'},
      ${'Suspended WorkOrder used to prove target-owned Reactor release.'},
      ${'preventive_maintenance'},
      ${'normal'},
      ${'suspended'},
      ${'reactor-release-e2e'},
      ${TEST_SOURCE_ID},
      ${'equipment_unavailable'},
      ${{ fixture: 'reactor-work-order-release-e2e' }}::jsonb
    )
  `
})

describe('Reactor WorkOrder dependency release vertical slice', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(ReleaseVerticalLayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT database not available')
      return
    }
  }, 30000)

  afterEach(async () => {
    if (!dbAvailable) return
    await Effect.runPromise(
      cleanupReleaseE2E.pipe(Effect.provide(ReleaseVerticalLayer), Effect.scoped, Effect.provide(TestShardingConfig)),
    )
  })

  it('retracts SQL constraint and resumes WorkOrder through entity-owned transition with causality audit', async () => {
    if (!dbAvailable) return

    await Effect.runPromise(Effect.gen(function* () {
      yield* cleanupReleaseE2E
      yield* setupMachineTestHierarchy
      yield* setupSuspendedWorkOrder

      const authority = yield* ReactorConstraintAuthority
      const release = yield* WorkOrderDependencyRelease
      const workOrders = yield* WorkOrderState
      const transitionRepo = yield* WorkOrderTransitionRepo
      const journal = yield* EventJournal.EventJournal

      const asserted = yield* authority.assert(blockingAssertion)
      const result = yield* release.dispatch(releaseRequest)
      const finalWorkOrder = yield* workOrders.get(TEST_TARGET_ID)
      const activeConstraints = yield* authority.activeForTarget(target)
      const transitions = yield* transitionRepo.getByWorkOrderId(TEST_TARGET_ID)
      const resumedTransition = transitions.find((transition) => transition.toState === 'resumed')
      const entries = yield* journal.entries
      const resumedEntry = entries.find((entry) =>
        entry.event === 'WorkOrderResumed' && entry.primaryKey === TEST_TARGET_ID,
      )

      expect(asserted.identity.constraintId).toMatch(/^rc_[0-9a-f]{32}$/)
      expect(result.verdict).toBe('released')
      expect(result.constraintId).toBe(asserted.identity.constraintId)
      expect(result.activeConstraintCount).toBe(0)
      expect(result.targetState).toBe('resumed')
      expect(activeConstraints).toHaveLength(0)
      expect(finalWorkOrder.status).toBe('resumed')
      expect(Option.isNone(finalWorkOrder.suspensionReason)).toBe(true)

      expect(resumedTransition).toBeDefined()
      expect(resumedTransition?.fromState).toBe('suspended')
      expect(resumedTransition?.toState).toBe('resumed')
      expect(Option.getOrNull(resumedTransition?.causedByPropagationId ?? Option.none())).toBe(RELEASE_PROPAGATION_ID)

      expect(resumedEntry).toBeDefined()
      const event = WorkOrderEvents.events.WorkOrderResumed
      const payload = yield* Schema.decodeUnknown(event.payloadMsgPack)(resumedEntry!.payload)
      expect(payload.workOrderId).toBe(TEST_TARGET_ID)
      expect(payload.causedByPropagationId).toBe(RELEASE_PROPAGATION_ID)
    }).pipe(
      Effect.provide(ReleaseVerticalLayer),
      Effect.scoped,
      Effect.provide(TestShardingConfig),
    ))
  }, 30000)
})
