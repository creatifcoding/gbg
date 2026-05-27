import { describe, expect, it } from 'vitest'
import { Effect, Layer, Option, Ref } from 'effect'
import { Entity, ShardingConfig } from '@effect/cluster'
import * as EventJournal from '@effect/experimental/EventJournal'
import { Reactor } from '../Reactor'
import {
  ReactorWorkerEntity,
  ReactorWorkerEntityHandlers,
  ReactorWorkerError,
} from '../ReactorWorkerEntity'
import {
  ObservationSignal,
  ReactorCausality,
  ReactorEventEnvelope,
  ReactorObservation,
  ReactorOwnerKey,
  ReactorPlan,
  ReactorRun,
} from '../../../schemas/reactor'
import { RelationshipEndpoint } from '../../../schemas/relationships/edge-types'
import { PropagationId } from '../../../schemas/identifiers'

const TestShardingConfig = ShardingConfig.layer({
  shardsPerGroup: 10,
  entityMailboxCapacity: 10,
  entityTerminationTimeout: 0,
  entityMessagePollInterval: 5_000,
  sendRetryInterval: 100,
})

const OWNER_KEY = 'relationship-reactor:machine:MCH-WORKER-001' as ReactorOwnerKey

const makeRun = (entry: EventJournal.Entry) => {
  const signal = new ObservationSignal({
    axis: 'equipment.availability',
    kind: 'condition_asserted',
    value: 'unavailable',
  })
  const observation = new ReactorObservation({
    event: new ReactorEventEnvelope({
      entryId: entry.idString as never,
      tag: entry.event,
      primaryKey: entry.primaryKey,
      occurredAt: entry.createdAt,
    }),
    subject: new RelationshipEndpoint({ type: 'machine', id: entry.primaryKey }),
    signals: [signal],
    causality: new ReactorCausality({
      propagationId: `PROP-${entry.idString}` as PropagationId,
    }),
    payload: {},
  })
  const plan = new ReactorPlan({ observation, decisions: [] })
  return new ReactorRun({ plan, results: [] })
}

const ReactorWorkerTestLayer = Layer.effect(
  Reactor,
  Effect.gen(function* () {
    const processed = yield* Ref.make<ReadonlySet<string>>(new Set())

    return Reactor.of({
      planJournalEntry: (entry) => Effect.succeed(Option.some(makeRun(entry).plan)),
      execute: (plan) => Effect.succeed(new ReactorRun({ plan, results: [] })),
      reactToJournalEntry: (entry) =>
        Effect.gen(function* () {
          const sourceEntryId = entry.idString
          const seen = yield* Ref.get(processed)
          if (seen.has(sourceEntryId)) return Option.none<ReactorRun>()

          yield* Ref.update(processed, (current) => new Set(current).add(sourceEntryId))
          return Option.some(makeRun(entry))
        }),
    })
  }),
)

const TestHandlers = ReactorWorkerEntityHandlers.pipe(
  Layer.provide(ReactorWorkerTestLayer),
)

const ReactorWorkerFailureTestLayer = Layer.succeed(Reactor, Reactor.of({
  planJournalEntry: () => Effect.fail(new Error('planner unavailable')),
  execute: () => Effect.fail(new Error('dispatcher unavailable')),
  reactToJournalEntry: () => Effect.fail(new Error('reactor boom')),
}))

const FailureHandlers = ReactorWorkerEntityHandlers.pipe(
  Layer.provide(ReactorWorkerFailureTestLayer),
)

describe('ReactorWorkerEntity', () => {
  it('delegates owner-key serialized processing to Reactor and preserves dedupe results', async () => {
    const program = Effect.gen(function* () {
      const makeClient = yield* Entity.makeTestClient(ReactorWorkerEntity, TestHandlers)
      const client = yield* makeClient(OWNER_KEY)
      const entry = new EventJournal.Entry({
        id: EventJournal.makeEntryId(),
        event: 'EquipmentStateChanged',
        primaryKey: 'MCH-WORKER-001',
        payload: new Uint8Array(),
      })

      const first = yield* client.ProcessJournalEntry({ ownerKey: OWNER_KEY, entry })
      const duplicate = yield* client.ProcessJournalEntry({ ownerKey: OWNER_KEY, entry })

      return { first, duplicate }
    }).pipe(
      Effect.scoped,
      Effect.provide(TestShardingConfig),
    )

    const { first, duplicate } = await Effect.runPromise(program)

    expect(first.processed).toBe(true)
    expect(first.run?.plan.observation.subject).toMatchObject({
      type: 'machine',
      id: 'MCH-WORKER-001',
    })
    expect(duplicate.processed).toBe(false)
    expect(duplicate.run).toBeUndefined()
  })

  it('wraps Reactor failures with owner-key and source-entry context', async () => {
    const program = Effect.gen(function* () {
      const makeClient = yield* Entity.makeTestClient(ReactorWorkerEntity, FailureHandlers)
      const client = yield* makeClient(OWNER_KEY)
      const entry = new EventJournal.Entry({
        id: EventJournal.makeEntryId(),
        event: 'EquipmentStateChanged',
        primaryKey: 'MCH-WORKER-001',
        payload: new Uint8Array(),
      })

      return yield* client.ProcessJournalEntry({ ownerKey: OWNER_KEY, entry }).pipe(Effect.flip)
    }).pipe(
      Effect.scoped,
      Effect.provide(TestShardingConfig),
    )

    const error = await Effect.runPromise(program)
    expect(error).toBeInstanceOf(ReactorWorkerError)
    expect(error.ownerKey).toBe(OWNER_KEY)
    expect(error.sourceEvent).toBe('EquipmentStateChanged')
    expect(error.message).toContain('reactor boom')
  })
})
