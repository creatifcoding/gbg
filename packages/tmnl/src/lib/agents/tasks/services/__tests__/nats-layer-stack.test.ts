/**
 * Layer stack smoke test — verifies service resolution for all NATS compositions.
 *
 * Requires live NATS on ws://localhost:9222.
 */
import { Effect, Duration } from 'effect'
import { describe, it, expect, beforeAll } from 'vitest'
import { NatsConnectionService, NatsConnectionServiceLive } from '../../../../holonet/nats/connection'
import {
  AgentTaskServiceNats,
  AgentTaskServiceNatsMicro,
  AgentTaskServiceNatsOutboxMicro,
} from '../layers'
import { AgentTaskService } from '../AgentTaskService'

let natsAvailable = false

beforeAll(async () => {
  natsAvailable = await Effect.gen(function* () {
    yield* NatsConnectionService
    return true as const
  }).pipe(
    Effect.scoped,
    Effect.provide(NatsConnectionServiceLive),
    Effect.catchAll(() => Effect.succeed(false as const)),
    Effect.runPromise,
  )

  if (!natsAvailable) {
    console.warn('[layer-stack] NATS unavailable — skipping')
  }
})

const smokeTest = (layer: any) =>
  Effect.gen(function* () {
    const svc = yield* AgentTaskService
    // Just verify the service resolves and subscribeLogs returns a stream.
    const stream = yield* svc.subscribeLogs(`layer-smoke-${Date.now()}`)
    return 'resolved' as const
  }).pipe(
    Effect.scoped,
    Effect.provide(layer),
    Effect.timeout(Duration.seconds(8)),
    Effect.map((opt) => (opt === undefined ? 'timeout-ok' : opt)),
    Effect.runPromise,
  )

describe('NATS layer stack resolution', () => {
  it('AgentTaskServiceNats resolves', { timeout: 15_000 }, async () => {
    if (!natsAvailable) return
    const result = await smokeTest(AgentTaskServiceNats)
    expect(result).toBe('resolved')
  })

  it('AgentTaskServiceNatsMicro resolves', { timeout: 15_000 }, async () => {
    if (!natsAvailable) return
    const result = await smokeTest(AgentTaskServiceNatsMicro)
    expect(result).toBe('resolved')
  })

  it('AgentTaskServiceNatsOutboxMicro resolves', { timeout: 15_000 }, async () => {
    if (!natsAvailable) return
    const result = await smokeTest(AgentTaskServiceNatsOutboxMicro)
    expect(result).toBe('resolved')
  })
})
