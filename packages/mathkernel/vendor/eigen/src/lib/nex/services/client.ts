/**
 * NexClientService
 *
 * Effect service for NEX client operations:
 * - Workload placement via auction
 * - Workload deployment
 * - Workload listing and management
 *
 * Built on NatsInnerService from holonet.
 *
 * @module nex/services/client
 */

import { Effect, Config } from 'effect'
import { NatsInnerService } from '@/lib/holonet/nats/inner'
import { MessageDecoder } from '../decoder'
import { NexError, AuctionError, DeployError } from '../errors'
import {
  AuctionRequest,
  AuctionResponse,
  StartWorkloadRequest,
  WorkloadDeployResponse,
  WorkloadListResponse,
  StopWorkloadRequest,
  type WorkloadLifecycle,
} from '../schemas'

// =============================================================================
// Service Configuration
// =============================================================================

/** NEX client configuration */
export interface NexClientConfig {
  /** Namespace for NEX operations */
  readonly namespace: string
  /** Default auction timeout in ms */
  readonly auctionTimeoutMs: number
  /** Default request timeout in ms */
  readonly requestTimeoutMs: number
}

const defaultConfig: NexClientConfig = {
  namespace: 'default',
  auctionTimeoutMs: 500,
  requestTimeoutMs: 30000,
}

// =============================================================================
// Service Implementation
// =============================================================================

export class NexClientService extends Effect.Service<NexClientService>()(
  'nex/Client',
  {
    effect: Effect.gen(function* () {
      const nats = yield* NatsInnerService
      const decoder = yield* MessageDecoder

      // Load config from environment or use defaults
      const namespace = yield* Config.string('NEX_NAMESPACE').pipe(
        Config.withDefault(defaultConfig.namespace)
      )

      // ─────────────────────────────────────────────────────────────────────────
      // Auction
      // ─────────────────────────────────────────────────────────────────────────

      /**
       * Run an auction to find nodes that can host a workload.
       *
       * @param type - Agent type (e.g., 'native', 'wasm')
       * @param tags - Placement tags for filtering
       * @param lifecycle - Workload lifecycle type
       * @param timeoutMs - Auction timeout (default: 500ms)
       * @returns Array of bidding nodes
       */
      const auction = (
        type: string,
        tags: Record<string, string> = {},
        lifecycle: WorkloadLifecycle = 'service',
        timeoutMs = defaultConfig.auctionTimeoutMs
      ) =>
        Effect.gen(function* () {
          const subject = `$NEX.SVC.${namespace}.control.AUCTION`

          // Encode auction request
          const payload = yield* decoder.encodeBytes(AuctionRequest)({
            type,
            tags,
            lifecycle,
          })

          // Collect responses within timeout window
          // Using a single request for simplicity; production would use RequestMany
          const responses: AuctionResponse[] = []

          const response = yield* nats.core
            .request(subject, payload, { timeout: timeoutMs })
            .pipe(
              Effect.flatMap((msg) => decoder.decodeBytes(AuctionResponse)(msg.data)),
              Effect.map((bid) => {
                responses.push(bid)
                return responses
              }),
              Effect.catchAll((error) => {
                // Timeout with no bidders is not an error
                if ('_tag' in error && error._tag === 'Inner/Core/Timeout') {
                  return Effect.succeed(responses)
                }
                return Effect.fail(
                  new AuctionError({
                    message: `Auction failed: ${String(error)}`,
                    type,
                    tags,
                  })
                )
              })
            )

          return response
        })

      // ─────────────────────────────────────────────────────────────────────────
      // Workload Deployment
      // ─────────────────────────────────────────────────────────────────────────

      /**
       * Deploy a workload to a specific bidder.
       *
       * @param bidderId - ID of the winning bidder from auction
       * @param request - Workload start request
       * @returns Deployment response with workload ID
       */
      const startWorkload = (
        bidderId: string,
        request: StartWorkloadRequest
      ) =>
        Effect.gen(function* () {
          const subject = `$NEX.SVC.${namespace}.control.AUCTIONDEPLOY.${bidderId}`

          const payload = yield* decoder.encodeBytes(StartWorkloadRequest)(request)

          const response = yield* nats.core
            .request(subject, payload, { timeout: defaultConfig.requestTimeoutMs })
            .pipe(
              Effect.mapError(
                (error) =>
                  new DeployError({
                    message: `Deployment request failed: ${error}`,
                    workloadName: request.name,
                    bidderId,
                    cause: error,
                  })
              )
            )

          return yield* decoder
            .decodeBytes(WorkloadDeployResponse)(response.data)
            .pipe(
              Effect.mapError(
                (error) =>
                  new DeployError({
                    message: `Failed to decode deploy response: ${error.message}`,
                    workloadName: request.name,
                    bidderId,
                    cause: error,
                  })
              )
            )
        })

      /**
       * Run auction and deploy to winning bidder in one operation.
       *
       * @param request - Workload start request
       * @returns Deployment response
       */
      const auctionAndDeploy = (request: StartWorkloadRequest) =>
        Effect.gen(function* () {
          // Run auction
          const bids = yield* auction(request.type, request.tags, request.lifecycle)

          if (bids.length === 0) {
            return yield* Effect.fail(
              new AuctionError({
                message: 'No bidders available for workload',
                type: request.type,
                tags: request.tags,
              })
            )
          }

          // Select first bidder (simple strategy)
          const winner = bids[0]

          yield* Effect.logInfo(
            `Selected bidder ${winner.bidderId} on node ${winner.nodeId}`
          )

          // Deploy to winner
          return yield* startWorkload(winner.bidderId, request)
        })

      // ─────────────────────────────────────────────────────────────────────────
      // Workload Management
      // ─────────────────────────────────────────────────────────────────────────

      /**
       * List running workloads.
       *
       * @returns List of workload info
       */
      const listWorkloads = () =>
        Effect.gen(function* () {
          const subject = `$NEX.SVC.${namespace}.workloads.LIST`
          const payload = new TextEncoder().encode('{}')

          const response = yield* nats.core
            .request(subject, payload, { timeout: 5000 })
            .pipe(
              Effect.mapError(
                (error) =>
                  new NexError({
                    message: `Failed to list workloads: ${error}`,
                    operation: 'listWorkloads',
                    cause: error,
                  })
              )
            )

          return yield* decoder
            .decodeBytes(WorkloadListResponse)(response.data)
            .pipe(
              Effect.mapError(
                (error) =>
                  new NexError({
                    message: `Failed to decode workload list: ${error.message}`,
                    operation: 'listWorkloads',
                    cause: error,
                  })
              )
            )
        })

      /**
       * Stop a running workload.
       *
       * @param workloadId - ID of workload to stop
       */
      const stopWorkload = (workloadId: string) =>
        Effect.gen(function* () {
          const subject = `$NEX.SVC.${namespace}.workloads.STOP`

          const payload = yield* decoder.encodeBytes(StopWorkloadRequest)({
            workloadId,
          })

          yield* nats.core.publish(subject, payload).pipe(
            Effect.mapError(
              (error) =>
                new NexError({
                  message: `Failed to stop workload ${workloadId}: ${error}`,
                  operation: 'stopWorkload',
                  cause: error,
                })
            )
          )

          yield* Effect.logInfo(`Stop request sent for workload ${workloadId}`)
        })

      // ─────────────────────────────────────────────────────────────────────────
      // Service API
      // ─────────────────────────────────────────────────────────────────────────

      return {
        namespace,

        // Auction operations
        auction,

        // Deployment operations
        startWorkload,
        auctionAndDeploy,

        // Management operations
        listWorkloads,
        stopWorkload,
      } as const
    }),
    dependencies: [NatsInnerService.Default, MessageDecoder.Default],
  }
) {}

// =============================================================================
// Layer Exports
// =============================================================================

export const NexClientServiceLive = NexClientService.Default
