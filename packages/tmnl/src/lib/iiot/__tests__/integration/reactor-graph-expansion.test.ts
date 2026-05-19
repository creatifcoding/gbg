/**
 * Reactor graph expansion integration tests.
 *
 * These tests exercise GraphClient.expandPropagationTargets directly so the
 * Reactor substrate proves both relationship traversal directions independently
 * of target dispatch semantics.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { DateTime, Effect } from 'effect'
import { GraphClient } from '../../services/l1/GraphClient'
import {
  ObservationSignal,
  ReactorCausality,
  ReactorEventEnvelope,
  ReactorObservation,
} from '../../schemas/reactor'
import {
  EntityReactionRequestTemplate,
  RelationshipEndpoint,
  RelationshipEdgeMetadata,
  RelationshipPropagationPolicy,
  RequiresEquipmentUnavailableBlocksSource,
  SignalMatcher,
  TargetsMachineUnavailableBlocksSource,
} from '../../schemas/relationships'
import type { MachineId, PropagationId, WorkOrderId } from '../../schemas/identifiers'
import { GraphIntegrationLayer, isDatabaseAvailable } from './layer'

const MOCK_MACHINE_ID = 'MCH-001' as MachineId

const SourceObservedTargetsPolicy = new RelationshipPropagationPolicy({
  id: 'test.targets.source-observed.informs-target' as never,
  edgeType: 'targets',
  observedEndpoint: 'source',
  accepts: new SignalMatcher({
    axis: 'work_order.execution',
    kind: 'state_changed',
    value: 'started',
  }),
  requestEndpoint: 'target',
  request: new EntityReactionRequestTemplate({
    capability: 'asset.inspect' as never,
    reason: 'source_started',
  }),
  effect: 'informational',
  idempotencyStrategy: 'event_journal_entry_id',
  version: 'test',
})

const makeObservation = (input: {
  readonly subject: RelationshipEndpoint
  readonly signal: ObservationSignal
}) => new ReactorObservation({
  event: new ReactorEventEnvelope({
    entryId: `entry-${Date.now()}` as never,
    tag: 'TestObservation',
    primaryKey: input.subject.id,
    occurredAt: DateTime.unsafeNow(),
  }),
  subject: input.subject,
  signals: [input.signal],
  causality: new ReactorCausality({
    propagationId: `PROP-${Date.now()}` as PropagationId,
  }),
  payload: {},
})

describe('Reactor graph expansion', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(isDatabaseAvailable.pipe(Effect.provide(GraphIntegrationLayer)))
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d')
    }
  })

  it('expands target-observed production targets policy from machine to source work order', async () => {
    if (!dbAvailable) return

    const workOrderId = `TEST-WO-REACTOR-GRAPH-TARGET-${Date.now()}` as WorkOrderId

    const program = Effect.gen(function* () {
      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode({ type: 'work_order', id: workOrderId }, { status: 'started' })
      yield* graph.upsertRelationshipEdge({
        source: { type: 'work_order', id: workOrderId },
        target: { type: 'machine', id: MOCK_MACHINE_ID },
        edgeType: 'targets',
        metadata: new RelationshipEdgeMetadata({
          createdBy: 'reactor-graph-expansion-test',
          reason: 'target-observed-expansion',
        }),
      })

      const signal = new ObservationSignal({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: 'unavailable',
      })
      const observation = makeObservation({
        subject: new RelationshipEndpoint({ type: 'machine', id: MOCK_MACHINE_ID }),
        signal,
      })

      const expansions = yield* graph.expandPropagationTargets({
        observation,
        policy: TargetsMachineUnavailableBlocksSource,
        signal,
      })

      expect(expansions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          edgeType: 'targets',
          source: expect.objectContaining({ type: 'work_order', id: workOrderId }),
          target: expect.objectContaining({ type: 'machine', id: MOCK_MACHINE_ID }),
          requestTarget: expect.objectContaining({ type: 'work_order', id: workOrderId }),
        }),
      ]))
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          const graph = yield* GraphClient
          yield* graph.executeCypher(
            `MATCH (wo:work_order {id: '${workOrderId}'}) DETACH DELETE wo`,
            '(result agtype)',
          ).pipe(Effect.ignore)
        }),
      ),
      Effect.provide(GraphIntegrationLayer),
    )

    await Effect.runPromise(program)
  })

  it('expands target-observed production requires policy from machine to requiring work order', async () => {
    if (!dbAvailable) return

    const workOrderId = `TEST-WO-REACTOR-GRAPH-REQUIRES-${Date.now()}` as WorkOrderId

    const program = Effect.gen(function* () {
      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode({ type: 'work_order', id: workOrderId }, { status: 'started' })
      yield* graph.upsertRelationshipEdge({
        source: { type: 'work_order', id: workOrderId },
        target: { type: 'machine', id: MOCK_MACHINE_ID },
        edgeType: 'requires',
        metadata: new RelationshipEdgeMetadata({
          createdBy: 'reactor-graph-expansion-test',
          reason: 'requires-target-observed-expansion',
        }),
      })

      const signal = new ObservationSignal({
        axis: 'equipment.availability',
        kind: 'condition_asserted',
        value: 'unavailable',
      })
      const observation = makeObservation({
        subject: new RelationshipEndpoint({ type: 'machine', id: MOCK_MACHINE_ID }),
        signal,
      })

      const expansions = yield* graph.expandPropagationTargets({
        observation,
        policy: RequiresEquipmentUnavailableBlocksSource,
        signal,
      })

      expect(expansions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          edgeType: 'requires',
          source: expect.objectContaining({ type: 'work_order', id: workOrderId }),
          target: expect.objectContaining({ type: 'machine', id: MOCK_MACHINE_ID }),
          requestTarget: expect.objectContaining({ type: 'work_order', id: workOrderId }),
        }),
      ]))
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          const graph = yield* GraphClient
          yield* graph.executeCypher(
            `MATCH (wo:work_order {id: '${workOrderId}'}) DETACH DELETE wo`,
            '(result agtype)',
          ).pipe(Effect.ignore)
        }),
      ),
      Effect.provide(GraphIntegrationLayer),
    )

    await Effect.runPromise(program)
  })

  it('expands source-observed policies from source work order to target machine', async () => {
    if (!dbAvailable) return

    const workOrderId = `TEST-WO-REACTOR-GRAPH-SOURCE-${Date.now()}` as WorkOrderId

    const program = Effect.gen(function* () {
      const graph = yield* GraphClient
      yield* graph.upsertRelationshipNode({ type: 'work_order', id: workOrderId }, { status: 'started' })
      yield* graph.upsertRelationshipEdge({
        source: { type: 'work_order', id: workOrderId },
        target: { type: 'machine', id: MOCK_MACHINE_ID },
        edgeType: 'targets',
        metadata: new RelationshipEdgeMetadata({
          createdBy: 'reactor-graph-expansion-test',
          reason: 'source-observed-expansion',
        }),
      })

      const signal = new ObservationSignal({
        axis: 'work_order.execution',
        kind: 'state_changed',
        value: 'started',
      })
      const observation = makeObservation({
        subject: new RelationshipEndpoint({ type: 'work_order', id: workOrderId }),
        signal,
      })

      const expansions = yield* graph.expandPropagationTargets({
        observation,
        policy: SourceObservedTargetsPolicy,
        signal,
      })

      expect(expansions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          edgeType: 'targets',
          source: expect.objectContaining({ type: 'work_order', id: workOrderId }),
          target: expect.objectContaining({ type: 'machine', id: MOCK_MACHINE_ID }),
          requestTarget: expect.objectContaining({ type: 'machine', id: MOCK_MACHINE_ID }),
        }),
      ]))
    }).pipe(
      Effect.ensuring(
        Effect.gen(function* () {
          const graph = yield* GraphClient
          yield* graph.executeCypher(
            `MATCH (wo:work_order {id: '${workOrderId}'}) DETACH DELETE wo`,
            '(result agtype)',
          ).pipe(Effect.ignore)
        }),
      ),
      Effect.provide(GraphIntegrationLayer),
    )

    await Effect.runPromise(program)
  })
})
