import { Chunk, DateTime, Duration, Effect, Fiber, Layer, Stream } from 'effect'
import { beforeAll, describe, expect, it } from 'vitest'

import { serializeLine } from '../../codec/jsonl-codec'
import { AgentTaskLogEntry } from '../../schemas'
import { AgentTaskService } from '../../services/AgentTaskService'
import { AgentTaskServiceNats } from '../../services/layers'
import { NatsConnectionService, NatsConnectionServiceLive } from '../../../../holonet/nats/connection'
import { NatsInnerService, NatsInnerServiceLive } from '../../../../holonet/nats/inner'

const resolveSubject = (taskId: string) => `agent.task.${taskId}.logs`

const makeTaskId = (suffix: string) =>
  `nats-ingest-${suffix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`

const testLayer = Layer.mergeAll(
  AgentTaskServiceNats,
  NatsInnerServiceLive,
)

const collectMessages = (chunk: Chunk.Chunk<{ readonly entry: AgentTaskLogEntry }>) =>
  Chunk.toArray(chunk).map((item) => item.entry.message)

let natsAvailable = false

beforeAll(async () => {
  const health = Effect.gen(function* () {
    yield* NatsConnectionService
    return true as const
  }).pipe(
    Effect.scoped,
    Effect.provide(NatsConnectionServiceLive),
    Effect.catchAll(() => Effect.succeed(false as const)),
  )

  natsAvailable = await Effect.runPromise(health)

  if (!natsAvailable) {
    console.warn(
      '[inline-task-log-view.integration] NATS unavailable. Start infra: ./.pi/skills/infra-up/scripts/infra-up.sh --service nats',
    )
  }
})

describe('InlineTaskLogView integration (NATS ingestion via TMNL services)', () => {
  it('ingests both AgentTask publish path and raw-wire publish path', async () => {
    if (!natsAvailable) return

    const taskId = makeTaskId('wire')

    const quotedEntry = new AgentTaskLogEntry({
      id: `${taskId}-quoted-1`,
      timestamp: DateTime.unsafeNow(),
      level: 'WARN',
      source: 'runtime.quoted',
      message: 'wire quoted payload ingested',
      parentTaskId: taskId,
    })

    const rawEntry = new AgentTaskLogEntry({
      id: `${taskId}-raw-1`,
      timestamp: DateTime.unsafeNow(),
      level: 'INFO',
      source: 'runtime.raw',
      message: 'wire raw payload ingested',
      parentTaskId: taskId,
    })

    const program = Effect.gen(function* () {
      const service = yield* AgentTaskService
      const inner = yield* NatsInnerService

      const stream = yield* service.subscribeLogs(taskId)

      const collector = yield* stream.pipe(
        // Hub publish path can emit local echo + NATS echo for service.publishLog.
        Stream.take(3),
        Stream.runCollect,
        Effect.fork,
      )

      yield* Effect.sleep(Duration.millis(120))

      yield* service.publishLog(taskId, quotedEntry)
      yield* inner.core.publish(
        resolveSubject(taskId),
        new TextEncoder().encode(serializeLine(rawEntry)),
      )
      // invalid line should be ignored by codec parser
      yield* inner.core.publish(
        resolveSubject(taskId),
        new TextEncoder().encode('not-json-at-all'),
      )
      yield* inner.core.flush()

      const collected = yield* Fiber.join(collector).pipe(
        Effect.timeoutFail({
          duration: Duration.seconds(6),
          onTimeout: () => new Error('Timed out waiting for NATS ingestion'),
        }),
      )

      return collectMessages(collected)
    }).pipe(
      Effect.scoped,
      Effect.provide(testLayer),
    )

    const messages = await Effect.runPromise(program)

    expect(messages).toContain(quotedEntry.message)
    expect(messages).toContain(rawEntry.message)
    expect(new Set(messages).size).toBeGreaterThanOrEqual(2)
  })

  it('honors subscribe filter options against live NATS traffic', async () => {
    if (!natsAvailable) return

    const taskId = makeTaskId('filters')

    const allowEntry = new AgentTaskLogEntry({
      id: `${taskId}-allow`,
      timestamp: DateTime.unsafeNow(),
      level: 'WARN',
      source: 'worker',
      message: 'checkpoint warning threshold hit',
      parentTaskId: taskId,
    })

    const noiseEntries: ReadonlyArray<AgentTaskLogEntry> = [
      new AgentTaskLogEntry({
        id: `${taskId}-noise-1`,
        timestamp: DateTime.unsafeNow(),
        level: 'INFO',
        source: 'worker',
        message: 'checkpoint info ignored by minLevel',
        parentTaskId: taskId,
      }),
      new AgentTaskLogEntry({
        id: `${taskId}-noise-2`,
        timestamp: DateTime.unsafeNow(),
        level: 'ERROR',
        source: 'durability',
        message: 'checkpoint but wrong source',
        parentTaskId: taskId,
      }),
      new AgentTaskLogEntry({
        id: `${taskId}-noise-3`,
        timestamp: DateTime.unsafeNow(),
        level: 'WARN',
        source: 'worker',
        message: 'different token',
        parentTaskId: taskId,
      }),
    ]

    const program = Effect.gen(function* () {
      const service = yield* AgentTaskService

      const stream = yield* service.subscribeLogs(taskId, {
        minLevel: 'WARN',
        sourceFilter: 'worker',
        messageFilter: 'checkpoint',
      })

      const collector = yield* stream.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.fork,
      )

      yield* Effect.sleep(Duration.millis(120))

      for (const entry of noiseEntries) {
        yield* service.publishLog(taskId, entry)
      }
      yield* service.publishLog(taskId, allowEntry)

      const collected = yield* Fiber.join(collector).pipe(
        Effect.timeoutFail({
          duration: Duration.seconds(6),
          onTimeout: () => new Error('Timed out waiting for filtered NATS ingestion'),
        }),
      )

      return collectMessages(collected)
    }).pipe(
      Effect.scoped,
      Effect.provide(testLayer),
    )

    const messages = await Effect.runPromise(program)

    expect(messages).toEqual([allowEntry.message])
  })
})
