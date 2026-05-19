/**
 * Reactor source-claim production-path E2E.
 *
 * Exercises the generic Reactor with:
 * - SQL EventJournal source event
 * - Apache AGE graph expansion
 * - SQL-backed WorkOrder state
 * - real WorkOrderMachine suspend transition
 * - work_order_transitions caused_by_propagation_id idempotency
 * - reactor_source_claims pre-dispatch authority
 * - reactor_checkpoints final dedupe / repair read model
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { DateTime, Effect, Layer, Option } from 'effect'
import { Machine } from '@effect/experimental'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import { SqlClient } from '@effect/sql'
import { PgClient } from '@effect/sql-pg'
import { GraphClient } from '../../services/l1/GraphClient'
import { DomainEventEmitter, DomainEventEmitterLive } from '../../services/events'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../infrastructure/eventlog-layer'
import { WorkOrderState } from '../../state'
import { eligible, skipped } from '../../schemas/relationships'
import { TargetsMachineUnavailableBlocksSource } from '../../schemas/relationships/edge-types'
import type {
  AssetId,
  MachineId,
  PropagationId,
  WorkOrderId,
  WorkflowDefinitionId,
} from '../../schemas/identifiers'
import {
  InternalSuspendWorkOrder,
  makeWorkOrderMachine,
} from '../../machines/WorkOrderMachine'
import { IIoTFeatureFlags } from '../../infrastructure/feature-flags'
import {
  Reactor,
  ReactorDispatcherLive,
  ReactorLive,
  ReactorPlannerLive,
  ReactorRegistry,
  EquipmentStateChangedObservationSpec,
  makeReactorRegistry,
  type EntityReactionContract,
} from '../../services/reactor'
import {
  ReactorCheckpointRepoLive,
  ReactorSourceClaimConfigTag,
  ReactorSourceClaimRepoLive,
  WorkOrderTransitionRepo,
} from '../../repos'
import { ReactorSourceClaimConfig } from '../../schemas/reactor'
import {
  GraphIntegrationLayer,
  TestPgClientWithMigrations,
  isDatabaseAvailable,
} from './layer'
import {
  WorkOrderMachineIntegrationLayer,
  withCleanMachineDatabase,
} from './machines/layer'

const TEST_MACHINE_ID = 'TEST-MCH-REACTOR-SOURCE-CLAIM-E2E' as MachineId

const sourceClaimConfig = new ReactorSourceClaimConfig({
  leaseDurationMs: 1_000,
  heartbeatIntervalMs: 250,
  attemptDeadlineMs: 5_000,
  maxAttempts: 3,
  deferRetryMs: 500,
  lockTimeoutMs: 250,
  sweeperBatchSize: 10,
})

const makeEmitterLayer = (journal: EventJournal.EventJournal.Service) => {
  const baseLayer = Layer.mergeAll(
    Layer.succeed(EventJournal.EventJournal, journal),
    Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom()),
    IIoTDomainEventHandlersLayer,
  )

  return DomainEventEmitterLive.pipe(
    Layer.provide(IIoTEventLogLayer.pipe(Layer.provide(baseLayer))),
  )
}

const ReactorSourceClaimE2ERegistryLayer = Layer.effect(
  ReactorRegistry,
  Effect.gen(function* () {
    const state = yield* WorkOrderState
    const flags = yield* IIoTFeatureFlags
    const transitionRepo = yield* WorkOrderTransitionRepo
    const sql = yield* SqlClient.SqlClient

    const contract: EntityReactionContract = {
      entityType: 'work_order',
      capabilities: new Map([
        ['dependency.blocked', {
          id: 'dependency.blocked',
          classify: (request) =>
            state.get(request.target.id as WorkOrderId).pipe(
              Effect.map((workOrder) => workOrder.status === 'started' || workOrder.status === 'resumed'
                ? eligible({
                  entityType: 'work_order',
                  entityId: workOrder.id,
                  currentState: workOrder.status,
                  targetState: 'suspended',
                })
                : skipped({
                  entityType: 'work_order',
                  entityId: workOrder.id,
                  currentState: workOrder.status,
                  targetState: 'suspended',
                  reason: workOrder.status === 'suspended' ? 'already_suspended' : 'terminal_state',
                })),
              Effect.catchAll(() => Effect.succeed(skipped({
                entityType: 'work_order',
                entityId: request.target.id,
                targetState: 'suspended',
                reason: 'not_found',
              }))),
            ),
          dispatch: (request) =>
            Effect.scoped(Effect.gen(function* () {
              const machine = makeWorkOrderMachine({ state, flags, transitionRepo, sql })
              const actor = yield* Machine.boot(machine)
              yield* actor.send(new InternalSuspendWorkOrder({
                workOrderId: request.target.id,
                suspendedBy: 'reactor-source-claim-e2e',
                reason: 'equipment_unavailable',
                expectedResume: Option.none(),
                causedByPropagationId: Option.some(request.causality.propagationId),
              }))
            })),
        }],
      ]),
    }

    return ReactorRegistry.of(makeReactorRegistry({
      observations: [EquipmentStateChangedObservationSpec],
      propagationPolicies: [TargetsMachineUnavailableBlocksSource],
      entities: [contract],
    }))
  }),
)

const ReactorSourceClaimE2ELayer = ReactorLive.pipe(
  Layer.provide(ReactorDispatcherLive),
  Layer.provide(ReactorPlannerLive),
  Layer.provide(ReactorSourceClaimE2ERegistryLayer),
  Layer.provide(ReactorCheckpointRepoLive.pipe(Layer.provide(TestPgClientWithMigrations))),
  Layer.provide(ReactorSourceClaimRepoLive.pipe(
    Layer.provide(Layer.merge(
      TestPgClientWithMigrations,
      ReactorSourceClaimConfigTag.Custom(sourceClaimConfig),
    )),
  )),
)

const E2EDependenciesLayer = Layer.mergeAll(
  GraphIntegrationLayer,
  WorkOrderMachineIntegrationLayer,
)

const E2ELayer = Layer.merge(
  E2EDependenciesLayer,
  ReactorSourceClaimE2ELayer.pipe(Layer.provide(E2EDependenciesLayer)),
)

const cleanupSourceClaimE2E = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DELETE FROM iiot.reactor_checkpoints WHERE consumer_id = 'relationship-reactor-generic-v1' AND primary_key = ${TEST_MACHINE_ID}`.pipe(Effect.ignore)
  yield* sql`DELETE FROM iiot.reactor_source_claims WHERE consumer_id = 'relationship-reactor-generic-v1' AND primary_key = ${TEST_MACHINE_ID}`.pipe(Effect.ignore)
})

describe('Reactor source-claim production-path E2E', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(isDatabaseAvailable.pipe(Effect.provide(GraphIntegrationLayer)))
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT database not available')
    }
  })

  it('claims SQL journal entry before dispatching a real WorkOrderMachine transition', async () => {
    if (!dbAvailable) return

    const suffix = Date.now()
    const propagationId = `PROP-REACTOR-SOURCE-CLAIM-E2E-${suffix}` as PropagationId

    const program = withCleanMachineDatabase(
      Effect.gen(function* () {
        yield* cleanupSourceClaimE2E

        const graph = yield* GraphClient
        const state = yield* WorkOrderState
        const transitionRepo = yield* WorkOrderTransitionRepo
        const journal = yield* EventJournal.EventJournal
        const sql = yield* PgClient.PgClient

        const created = yield* state.create({
          workflowDefinitionId: 'WF-REACTOR-SOURCE-CLAIM-E2E' as WorkflowDefinitionId,
          workflowVersion: '1.0.0',
          title: `Reactor source claim E2E ${suffix}`,
          description: 'Production-path source claim Reactor E2E',
          type: 'preventive_maintenance',
          priority: 'normal',
          createdBy: 'reactor-source-claim-e2e',
          scheduledStart: Option.none(),
          dueDate: Option.none(),
          parentWorkOrderId: Option.none(),
          primaryAssetId: Option.some(TEST_MACHINE_ID as unknown as AssetId),
          assignedTo: Option.none(),
          metadata: { test: 'reactor-source-claim-e2e' },
        })

        yield* state.set({
          ...created,
          status: 'started',
          actualStart: Option.some(DateTime.unsafeNow()),
        })

        const started = yield* state.get(created.id)
        expect(started.status).toBe('started')

        yield* graph.upsertRelationshipNode(
          { type: 'machine', id: TEST_MACHINE_ID },
          { name: 'Reactor Source Claim E2E Machine' },
        )
        yield* graph.upsertWorkOrderTargetingMachine({
          id: created.id,
          status: 'started',
          machineId: TEST_MACHINE_ID,
        })

        yield* Effect.gen(function* () {
          const emitter = yield* DomainEventEmitter
          yield* emitter.emitEquipmentStateChanged({
            machineId: TEST_MACHINE_ID,
            previousState: 'running',
            newState: 'faulted',
            reason: 'source claim e2e fault',
            triggeredBy: 'reactor-source-claim-e2e',
            propagationId,
          })
        }).pipe(Effect.provide(makeEmitterLayer(journal)))

        const entries = yield* journal.entries
        const entry = entries.find((candidate) =>
          candidate.event === 'EquipmentStateChanged' &&
          candidate.primaryKey === TEST_MACHINE_ID
        )
        expect(entry).toBeDefined()

        const reactor = yield* Reactor
        const first = yield* reactor.reactToJournalEntry(entry!)
        const duplicate = yield* reactor.reactToJournalEntry(entry!)

        expect(Option.isSome(first)).toBe(true)
        expect(Option.isNone(duplicate)).toBe(true)

        const updated = yield* state.get(created.id)
        expect(updated.status).toBe('suspended')
        expect(Option.getOrNull(updated.suspensionReason)).toBe('equipment_unavailable')

        const transitions = yield* transitionRepo.getByWorkOrderId(created.id)
        const inboundTransitions = transitions.filter((transition) =>
          Option.getOrNull(transition.causedByPropagationId) === propagationId
        )
        expect(inboundTransitions).toHaveLength(1)
        expect(inboundTransitions[0]?.workOrderId).toBe(created.id)
        expect(inboundTransitions[0]?.toState).toBe('suspended')

        const inboundHandled = yield* transitionRepo.hasInboundPropagation(created.id, propagationId)
        expect(inboundHandled).toBe(true)

        const claimRows = yield* sql<{ claimStatus: string; outcome: string | null; policyEpoch: string; registryFingerprint: string }>`
          SELECT claim_status AS "claimStatus",
                 outcome,
                 policy_epoch AS "policyEpoch",
                 registry_fingerprint AS "registryFingerprint"
          FROM iiot.reactor_source_claims
          WHERE consumer_id = 'relationship-reactor-generic-v1'
            AND source_entry_id = ${entry!.idString}
        `
        expect(claimRows).toHaveLength(1)
        expect(claimRows[0]?.claimStatus).toBe('completed')
        expect(claimRows[0]?.outcome).toBe('processed')
        expect(claimRows[0]?.policyEpoch).toBe('reactor-policy-epoch.v1')
        expect(claimRows[0]?.registryFingerprint).toMatch(/^fnv1a32:/)

        const checkpointRows = yield* sql<{ outcome: string }>`
          SELECT outcome
          FROM iiot.reactor_checkpoints
          WHERE consumer_id = 'relationship-reactor-generic-v1'
            AND source_entry_id = ${entry!.idString}
        `
        expect(checkpointRows).toHaveLength(1)
        expect(checkpointRows[0]?.outcome).toBe('processed')

        yield* graph.executeCypher(
          `MATCH (wo:work_order {id: '${created.id}'}) DETACH DELETE wo`,
          '(result agtype)',
        ).pipe(Effect.ignore)
      }).pipe(
        Effect.ensuring(cleanupSourceClaimE2E),
      )
    ).pipe(Effect.provide(E2ELayer))

    await Effect.runPromise(program)
  })
})
