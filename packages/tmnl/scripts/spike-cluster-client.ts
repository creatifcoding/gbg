#!/usr/bin/env bun
/**
 * Spike: Test CardEntity Cluster Client
 *
 * Tests manual interaction with the cluster node.
 *
 * Prerequisites:
 * - Cluster node running: bun run scripts/cursor-cluster-node.ts
 */

import { Effect, Console, Layer, Option } from 'effect'
import * as HttpRunner from '@effect/cluster/HttpRunner'
import * as RunnerServer from '@effect/cluster/RunnerServer'
import { RunnerAddress } from '@effect/cluster/RunnerAddress'
import * as MessageStorage from '@effect/cluster/MessageStorage'
import * as RunnerStorage from '@effect/cluster/RunnerStorage'
import * as RunnerHealth from '@effect/cluster/RunnerHealth'
import * as ShardingConfig from '@effect/cluster/ShardingConfig'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import { FetchHttpClient } from '@effect/platform'

import {
  CardEntity,
  CARD_SHARD_GROUPS,
  type CardId,
} from '../src/lib/cursor/cluster'

// =============================================================================
// Client Layer (matches ClusterClientLayer)
// =============================================================================

const ClusterClientLayer = (() => {
  // Target runner address - where the cluster server is running
  const targetAddress = RunnerAddress.make({ host: 'localhost', port: 8100 })

  const shardingConfigLayer = ShardingConfig.layer({
    runnerAddress: Option.some(targetAddress), // Tell client where to connect!
    shardGroups: [...CARD_SHARD_GROUPS],
    shardsPerGroup: 100,
  })

  const rpcProtocolLayer = HttpRunner.layerClientProtocolHttp({
    path: '/',  // Default path used by HttpRunner.layerHttp
    https: false,
  })

  return RunnerServer.layerClientOnly.pipe(
    Layer.provide(rpcProtocolLayer),
    Layer.provide(RpcSerialization.layerMsgPack),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(MessageStorage.layerNoop),
    Layer.provide(RunnerStorage.layerMemory),
    Layer.provide(RunnerHealth.layerNoop),
    Layer.provide(shardingConfigLayer)
  )
})()

// =============================================================================
// Test Program
// =============================================================================

const testProgram = Effect.gen(function* () {
  yield* Console.log('=== CardEntity Cluster Client Test ===')
  yield* Console.log('')

  // Get client factory
  yield* Console.log('Getting CardEntity client...')
  const makeClient = yield* CardEntity.client

  const cardId = 'test-card-123' as CardId
  const entityClient = makeClient(cardId)

  yield* Console.log(`Created client for cardId: ${cardId}`)
  yield* Console.log('')

  // Test GetCardState RPC - entity client has method per RPC
  yield* Console.log('Testing GetCardState RPC...')
  const stateResult = yield* entityClient.GetCardState({ cardId }).pipe(
    Effect.timeout('5 seconds'),
    Effect.catchAll((error) => Effect.succeed({ error: String(error) }))
  )

  yield* Console.log(`Result: ${JSON.stringify(stateResult, null, 2)}`)
  yield* Console.log('')
  yield* Console.log('=== Test Complete ===')
})

// =============================================================================
// Run
// =============================================================================

const main = testProgram.pipe(
  Effect.provide(ClusterClientLayer),
  Effect.catchAllCause((cause) =>
    Console.error(`Test failed: ${cause}`)
  )
)

Effect.runPromise(main).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
