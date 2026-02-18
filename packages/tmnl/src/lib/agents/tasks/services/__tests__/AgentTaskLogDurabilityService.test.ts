import { DateTime, Effect, Layer } from 'effect'
import { describe, expect, it } from 'vitest'

import { NatsStreamService } from '../../../../holonet/nats/stream'
import { AgentTaskLogEntry } from '../../schemas/log-entry'
import {
  AgentTaskLogDurabilityConfigCustom,
  AgentTaskLogDurabilityService,
  AgentTaskLogDurabilityServiceLive,
} from '../AgentTaskLogDurabilityService'

const makeEntry = (id: string) =>
  new AgentTaskLogEntry({
    id,
    timestamp: DateTime.unsafeNow(),
    level: 'INFO',
    source: 'agent-task.test',
    message: `message:${id}`,
  })

describe('AgentTaskLogDurabilityService', () => {
  it('ensures stream once and publishes acknowledgements', async () => {
    let ensureCalls = 0
    let publishCalls = 0

    const fakeStream = {
      ensureStream: () =>
        Effect.sync(() => {
          ensureCalls += 1
          return { config: { name: 'AGENT_TASK_LOGS' } } as any
        }),
      publish: (_subject: string, _schema: unknown, _data: unknown, _opts?: unknown) =>
        Effect.sync(() => {
          publishCalls += 1
          return {
            stream: 'AGENT_TASK_LOGS',
            seq: publishCalls,
            duplicate: false,
          }
        }),
    }

    const provided = AgentTaskLogDurabilityServiceLive.pipe(
      Layer.provide(AgentTaskLogDurabilityConfigCustom({
        streamName: 'AGENT_TASK_LOGS',
        subjects: ['agent.task.*.logs'],
        storage: 'memory',
        retention: 'limits',
        duplicateWindow: 60_000_000_000,
      })),
      Layer.provide(Layer.succeed(NatsStreamService, fakeStream as any)),
    )

    const [r1, r2] = await Effect.runPromise(
      Effect.gen(function* () {
        const durability = yield* AgentTaskLogDurabilityService
        const receipt1 = yield* durability.publishAndAwaitAck('task-1', makeEntry('entry-1'))
        const receipt2 = yield* durability.publishAndAwaitAck('task-1', makeEntry('entry-2'))
        return [receipt1, receipt2] as const
      }).pipe(Effect.provide(provided)),
    )

    expect(ensureCalls).toBe(1)
    expect(publishCalls).toBe(2)
    expect(r1.sequence).toBe(1)
    expect(r2.sequence).toBe(2)
    expect(r1.stream).toBe('AGENT_TASK_LOGS')
  })

  it('publishes with deterministic subject and msgId derived from entry id', async () => {
    let capturedSubject: string | null = null
    let capturedOpts: Record<string, unknown> | undefined

    const fakeStream = {
      ensureStream: () => Effect.succeed({ config: { name: 'AGENT_TASK_LOGS' } } as any),
      publish: (subject: string, _schema: unknown, _data: unknown, opts?: Record<string, unknown>) =>
        Effect.sync(() => {
          capturedSubject = subject
          capturedOpts = opts
          return {
            stream: 'AGENT_TASK_LOGS',
            seq: 99,
            duplicate: true,
          }
        }),
    }

    const provided = AgentTaskLogDurabilityServiceLive.pipe(
      Layer.provide(AgentTaskLogDurabilityConfigCustom({
        streamName: 'AGENT_TASK_LOGS',
        subjects: ['agent.task.*.logs'],
        storage: 'memory',
        retention: 'limits',
        duplicateWindow: 60_000_000_000,
      })),
      Layer.provide(Layer.succeed(NatsStreamService, fakeStream as any)),
    )

    const entry = makeEntry('entry-xyz')

    const receipt = await Effect.runPromise(
      Effect.gen(function* () {
        const durability = yield* AgentTaskLogDurabilityService
        return yield* durability.publishAndAwaitAck('task-abc', entry)
      }).pipe(Effect.provide(provided)),
    )

    expect(capturedSubject).toBe('agent.task.task-abc.logs')
    expect(capturedOpts?.msgId).toBe('entry-xyz')
    expect(capturedOpts?.expectStream).toBe('AGENT_TASK_LOGS')
    expect(receipt.entryId).toBe('entry-xyz')
    expect(receipt.sequence).toBe(99)
    expect(receipt.duplicate).toBe(true)
  })

  it('maps publish failures into AgentTaskLogDurabilityPublishError', async () => {
    const fakeStream = {
      ensureStream: () => Effect.succeed({ config: { name: 'AGENT_TASK_LOGS' } } as any),
      publish: () => Effect.fail(new Error('publish boom')),
    }

    const provided = AgentTaskLogDurabilityServiceLive.pipe(
      Layer.provide(AgentTaskLogDurabilityConfigCustom({
        streamName: 'AGENT_TASK_LOGS',
        subjects: ['agent.task.*.logs'],
        storage: 'memory',
        retention: 'limits',
        duplicateWindow: 60_000_000_000,
      })),
      Layer.provide(Layer.succeed(NatsStreamService, fakeStream as any)),
    )

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const durability = yield* AgentTaskLogDurabilityService
        return yield* Effect.either(
          durability.publishAndAwaitAck('task-fail', makeEntry('entry-fail')),
        )
      }).pipe(Effect.provide(provided)),
    )

    expect(result._tag).toBe('Left')
    if (result._tag === 'Left') {
      expect(result.left._tag).toBe('AgentTask/LogDurabilityPublishError')
      expect(result.left.taskId).toBe('task-fail')
      expect(result.left.entryId).toBe('entry-fail')
    }
  })
})
