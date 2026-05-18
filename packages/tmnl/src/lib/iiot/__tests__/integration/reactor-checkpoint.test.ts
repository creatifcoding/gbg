/**
 * ReactorCheckpointRepo integration tests.
 *
 * Verifies the durable replay/delivery dedupe table exists and enforces
 * one processed source entry per Reactor consumer.
 */

import { describe, expect, beforeAll, afterEach, it } from 'vitest'
import { Effect, Layer } from 'effect'
import { PgClient } from '@effect/sql-pg'
import {
  ReactorCheckpointRepo,
  ReactorCheckpointRepoLive,
} from '../../repos/ReactorCheckpointRepo'
import type {
  ReactorConsumerId,
  ReactorSourceEntryId,
} from '../../schemas/reactor'
import {
  TestPgClientWithMigrations,
  isDatabaseAvailable,
} from './layer'

const ReactorCheckpointIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  ReactorCheckpointRepoLive.pipe(Layer.provide(TestPgClientWithMigrations)),
)

const TEST_CONSUMER = 'TEST-REACTOR-CONSUMER' as ReactorConsumerId

const cleanup = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`
    DELETE FROM iiot.reactor_checkpoints
    WHERE consumer_id = ${TEST_CONSUMER}
  `
})

describe('ReactorCheckpointRepo integration', () => {
  let dbAvailable = false

  beforeAll(async () => {
    dbAvailable = await Effect.runPromise(
      isDatabaseAvailable.pipe(Effect.provide(ReactorCheckpointIntegrationLayer)),
    )
    if (!dbAvailable) {
      console.log('SKIPPING: IIoT database not available')
    }
  })

  afterEach(async () => {
    if (!dbAvailable) return
    await Effect.runPromise(cleanup.pipe(Effect.provide(ReactorCheckpointIntegrationLayer)))
  })

  it('marks each source entry once per consumer', async () => {
    if (!dbAvailable) return

    const sourceEntryId = `ENTRY-${Date.now()}` as ReactorSourceEntryId

    const program = Effect.gen(function* () {
      const repo = yield* ReactorCheckpointRepo

      const before = yield* repo.hasProcessed({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
      })

      const first = yield* repo.markProcessed({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
        sourceEvent: 'EquipmentStateChanged',
        primaryKey: 'MCH-001',
        outcome: 'processed',
        metadata: { source: 'integration-test' },
      })

      const second = yield* repo.markProcessed({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
        sourceEvent: 'EquipmentStateChanged',
        primaryKey: 'MCH-001',
        outcome: 'processed',
        metadata: { source: 'integration-test' },
      })

      const after = yield* repo.hasProcessed({
        consumerId: TEST_CONSUMER,
        sourceEntryId,
      })

      expect(before).toBe(false)
      expect(first).toBe(true)
      expect(second).toBe(false)
      expect(after).toBe(true)
    }).pipe(Effect.provide(ReactorCheckpointIntegrationLayer))

    await Effect.runPromise(program)
  })
})
