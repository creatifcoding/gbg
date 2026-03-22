#!/usr/bin/env bun
/**
 * Cursor CardEntity Cluster Node
 *
 * Effect Cluster runner for CardEntity operations.
 * Exposes HTTP API endpoints via:
 * - EntityProxy for non-streaming RPCs (GetCardState, CancelOperation)
 * - Custom streaming endpoints using HttpServerResponse.stream (StreamUIGenerate, etc.)
 *
 * Usage:
 *   bun run scripts/cursor-cluster-node.ts
 *   bun run cluster:node
 *
 * Environment:
 *   RUNNER_HOST     - Host (default: 0.0.0.0)
 *   RUNNER_PORT     - Port (default: 8100)
 *
 * Prerequisites:
 * - Claude Code CLI authenticated: `claude login`
 *
 * API Endpoints:
 *   POST /cards/stream-ui-generate/:entityId  (custom streaming)
 *   POST /cards/get-card-state/:entityId      (EntityProxy)
 *   POST /cards/cancel-operation/:entityId    (EntityProxy)
 *
 * @module scripts/cursor-cluster-node
 */

import { Effect, Layer, Console, Config, Duration, Option, Stream, Schema, pipe, Context } from 'effect'

// Effect Platform HTTP
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
  HttpServer,
  HttpServerResponse,
} from '@effect/platform'
import { BunHttpServer, BunRuntime } from '@effect/platform-bun'

// Effect Cluster
import * as BunClusterHttp from '@effect/platform-bun/BunClusterHttp'
import { EntityProxy, EntityProxyServer, Sharding } from '@effect/cluster'
import { RunnerAddress } from '@effect/cluster/RunnerAddress'

import {
  CardEntity,
  CardEntityHandlers,
  CARD_SHARD_GROUPS,
  StreamUIGenerateRpc,
  type CardId,
  type OperationId,
  type UIPatch,
} from '../src/lib/cursor/cluster'
import { AICoreService, SSEAdapter, ToolBridge } from '../src/lib/ai-core'
import { MCPClientRegistry } from '../src/lib/mcp/services'

// =============================================================================
// Configuration
// =============================================================================

const ClusterConfig = {
  host: Config.string('RUNNER_HOST').pipe(Config.withDefault('0.0.0.0')),
  port: Config.number('RUNNER_PORT').pipe(Config.withDefault(8100)),
  // Internal cluster port for runner-to-runner communication
  clusterPort: Config.number('CLUSTER_PORT').pipe(Config.withDefault(8101)),
}

// =============================================================================
// AI Core Dependencies Layer
// =============================================================================

/**
 * Full AICoreService layer with all dependencies.
 *
 * Composition:
 *   AICoreService
 *   ├── SSEAdapter
 *   └── ToolBridge
 *       └── MCPClientRegistry
 */
const AICoreServiceLive = AICoreService.Live.pipe(
  Layer.provide(SSEAdapter.Live),
  Layer.provide(
    ToolBridge.Live.pipe(Layer.provide(MCPClientRegistry.Live))
  )
)

// =============================================================================
// Streaming Request/Response Schemas
// =============================================================================

/**
 * UI Generation request body schema
 */
const UIGenerateRequestBody = Schema.Struct({
  prompt: Schema.String,
  catalog: Schema.optional(Schema.String),
  context: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

/**
 * Path parameters schema for entity ID
 */
const EntityIdPath = Schema.Struct({
  entityId: Schema.String,
})

// =============================================================================
// HTTP API Definition
// =============================================================================

/**
 * Custom streaming API group for UI generation
 * Uses HttpServerResponse.stream for NDJSON streaming
 */
const StreamingApiGroup = HttpApiGroup.make('streaming')
  .add(
    HttpApiEndpoint.post('streamUIGenerate', '/cards/stream-ui-generate/:entityId')
      .setPath(EntityIdPath)
      .setPayload(UIGenerateRequestBody)
      .addSuccess(
        Schema.String.pipe(
          HttpApiSchema.withEncoding({
            kind: 'Text',
            contentType: 'application/x-ndjson',
          })
        )
      )
  )

/**
 * CardEntity HTTP API
 *
 * Combines:
 * - EntityProxy for non-streaming RPCs (GetCardState, CancelOperation)
 * - Custom StreamingApiGroup for streaming RPCs (StreamUIGenerate)
 */
class CardApi extends HttpApi.make('card-api')
  .add(StreamingApiGroup)
  .add(EntityProxy.toHttpApiGroup('cards', CardEntity).prefix('/cards')) {}

// =============================================================================
// Streaming Handlers Layer
// =============================================================================

/**
 * Custom streaming HTTP handlers for streaming RPCs.
 *
 * EntityProxy.toHttpApiGroup skips streaming RPCs (RpcSchema.Stream).
 * We handle them manually by:
 * 1. Getting CardEntity.client
 * 2. Sending the streaming RPC
 * 3. Converting Stream<UIPatch> to NDJSON bytes
 * 4. Returning HttpServerResponse.stream
 */
const StreamingHandlersLive = HttpApiBuilder.group(CardApi, 'streaming', (handlers) =>
  handlers.handle('streamUIGenerate', ({ path, payload }) =>
    Effect.gen(function* () {
      // Get entity client from Sharding
      const makeClient = yield* CardEntity.client
      const entityId = path.entityId
      const operationId = crypto.randomUUID() as OperationId

      // Get entity client for this card
      const client = makeClient(entityId)

      // Call the streaming RPC directly on the client
      // For streaming RPCs, this returns Stream<UIPatch, Error> directly (NOT Effect<Stream>)
      const patchStream = client.StreamUIGenerate({
        cardId: entityId as CardId,
        operationId,
        prompt: payload.prompt,
        catalog: payload.catalog ?? 'default',
        context: payload.context,
      })

      // Convert Stream<UIPatch> to NDJSON text stream, then encode to bytes
      // Handle errors within the stream to satisfy HttpServerResponse.stream requirements
      const ndjsonStream = pipe(
        patchStream,
        // Convert patches to NDJSON strings
        Stream.map((patch) => JSON.stringify(patch) + '\n'),
        // Handle errors - emit error as final JSON message
        Stream.catchAll((error) =>
          Stream.make(JSON.stringify({ _tag: 'Error', error: String(error) }) + '\n')
        ),
        // Encode text to Uint8Array
        Stream.encodeText
      )

      // Return streaming HTTP response
      return HttpServerResponse.stream(ndjsonStream, {
        contentType: 'application/x-ndjson',
      })
    })
  )
)

// =============================================================================
// Cluster Sharding Layer
// =============================================================================

/**
 * BunClusterHttp.layer provides:
 * - Sharding service
 * - In-memory storage (local mode for development)
 * - RunnerHealth.layerPing
 * - RpcSerialization (msgpack)
 */
const ClusterShardingLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const host = yield* ClusterConfig.host
    const clusterPort = yield* ClusterConfig.clusterPort
    const clusterAddress = RunnerAddress.make({ host, port: clusterPort })

    return BunClusterHttp.layer({
      transport: 'http',
      storage: 'local',
      serialization: 'msgpack',
      shardingConfig: {
        runnerAddress: Option.some(clusterAddress),
        runnerListenAddress: Option.some(clusterAddress),
        shardGroups: [...CARD_SHARD_GROUPS],
        shardsPerGroup: 100,
        entityMailboxCapacity: 100,
        entityMaxIdleTime: Duration.minutes(5),
      },
    })
  })
)

// =============================================================================
// HTTP API Layer (EntityProxyServer)
// =============================================================================

/**
 * EntityProxyServer.layerHttpApi connects the HTTP API to entity handlers.
 * Requires Sharding and entity handlers to be provided.
 *
 * StreamingHandlersLive provides custom streaming HTTP handlers
 * for RPCs that EntityProxy doesn't support (RpcSchema.Stream).
 */
const ApiLayer = HttpApiBuilder.api(CardApi).pipe(
  // Custom streaming handlers (StreamUIGenerate, etc.)
  Layer.provide(StreamingHandlersLive),
  // EntityProxy handlers for non-streaming RPCs (GetCardState, CancelOperation)
  Layer.provide(EntityProxyServer.layerHttpApi(CardApi, 'cards', CardEntity)),
  // Entity handlers and dependencies
  Layer.provide(CardEntityHandlers),
  Layer.provide(AICoreServiceLive),
  Layer.provide(ClusterShardingLayer)
)

// =============================================================================
// CORS Middleware
// =============================================================================

/**
 * CORS middleware for browser access
 * Allows requests from Vite dev server (localhost:1420) and any localhost origin
 */
const CorsMiddleware = HttpApiBuilder.middlewareCors({
  allowedOrigins: ['http://localhost:1420', 'http://localhost:3000', 'http://127.0.0.1:1420'],
  allowedMethods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Card-Id'],
  credentials: true,
  maxAge: 3600,
})

// =============================================================================
// Server Layer
// =============================================================================

const ServerLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const port = yield* ClusterConfig.port

    return HttpApiBuilder.serve().pipe(
      Layer.provide(CorsMiddleware),
      Layer.provide(ApiLayer),
      HttpServer.withLogAddress,
      Layer.provide(BunHttpServer.layer({ port }))
    )
  })
)

// =============================================================================
// Main Program
// =============================================================================

const program = Effect.gen(function* () {
  const host = yield* ClusterConfig.host
  const port = yield* ClusterConfig.port
  const clusterPort = yield* ClusterConfig.clusterPort

  yield* Console.log('═══════════════════════════════════════════════════════════════')
  yield* Console.log('                 Cursor CardEntity Cluster Node                 ')
  yield* Console.log('═══════════════════════════════════════════════════════════════')
  yield* Console.log(`  Host:            ${host}`)
  yield* Console.log(`  API Port:        ${port} (EntityProxy HTTP API)`)
  yield* Console.log(`  Cluster Port:    ${clusterPort} (internal runner RPC)`)
  yield* Console.log(`  Shard Groups:    ${CARD_SHARD_GROUPS.join(', ')}`)
  yield* Console.log(`  Storage:         Local (in-memory)`)
  yield* Console.log('═══════════════════════════════════════════════════════════════')
  yield* Console.log('')
  yield* Console.log('  HTTP Endpoints (port ' + port + '):')
  yield* Console.log('  POST /cards/stream-chat/:entityId')
  yield* Console.log('  POST /cards/stream-ui-generate/:entityId')
  yield* Console.log('  POST /cards/stream-chart-style/:entityId')
  yield* Console.log('  POST /cards/stream-morph-fix/:entityId')
  yield* Console.log('  POST /cards/stream-morph-evolve/:entityId')
  yield* Console.log('  POST /cards/cancel-operation/:entityId')
  yield* Console.log('  POST /cards/get-card-state/:entityId')
  yield* Console.log('')
  yield* Console.log('═══════════════════════════════════════════════════════════════')
  yield* Console.log('  Cluster node running. Press Ctrl+C to stop.')
  yield* Console.log('═══════════════════════════════════════════════════════════════')
})

// =============================================================================
// Run
// =============================================================================

// Use Layer.launch to properly start and keep the server running
BunRuntime.runMain(
  Effect.gen(function* () {
    // Print banner first
    yield* program
    // Then launch the server layer (this keeps running until interrupted)
    yield* Layer.launch(ServerLayer)
  }).pipe(
    Effect.catchAllCause((cause) =>
      Console.error(`Cluster node failed: ${cause}`)
    )
  )
)
