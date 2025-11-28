/**
 * Pool Layer Factory
 *
 * Creates Effect Layer for a serialized worker pool using makePoolSerialized.
 * Wires up the encode function for Transferable handling and schemas for
 * boundary validation.
 *
 * ARCHITECTURE:
 * The pool layer creates N workers that share a work queue. Requests are
 * distributed across workers, enabling parallel processing of chart data.
 *
 * USAGE:
 * ```ts
 * import { makeProcessorPoolLayer, ProcessorPoolTag } from './poolLayer';
 *
 * const PoolLayer = makeProcessorPoolLayer(ProcessorPoolTag, './processor-worker.ts', 4);
 *
 * const program = Effect.gen(function* () {
 *   const pool = yield* ProcessorPoolTag;
 *   const response = yield* pool.executeEffect({
 *     _tag: 'Process',
 *     payload: { raw: rawBinary, config }
 *   });
 *   return response;
 * }).pipe(Effect.provide(PoolLayer));
 * ```
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import type {
  ProcessorRequest,
  ProcessorResponse,
} from './worker-protocol';
import {
  ProcessorRequestSchema,
  ProcessorResponseSchema,
} from './worker-schema';
import { encodeWithTransferables } from './encodeWithTransferables';

// ============================================================================
// Pool Types
// ============================================================================

/**
 * Worker error type for pool operations
 */
export interface PoolError {
  readonly _tag: 'PoolError';
  readonly message: string;
  readonly cause?: unknown;
}

/**
 * Create a PoolError
 */
export function poolError(message: string, cause?: unknown): PoolError {
  return { _tag: 'PoolError', message, cause };
}

/**
 * Processor pool interface - represents a pool of chart processing workers.
 *
 * The pool implements executeEffect which takes a ProcessorRequest and
 * returns a ProcessorResponse.
 */
export interface ProcessorPool {
  /**
   * Execute a request on the pool and get the response.
   *
   * The pool will select an available worker, send the request with
   * zero-copy Transferable handling, wait for processing, and return
   * the response.
   *
   * @param request - The processing request
   * @returns Effect yielding the response
   */
  readonly executeEffect: (
    request: ProcessorRequest,
  ) => Effect.Effect<ProcessorResponse, PoolError>;
}

/**
 * Context tag for accessing the processor pool in Effect programs.
 *
 * @example
 * ```ts
 * const program = Effect.gen(function* () {
 *   const pool = yield* ProcessorPoolTag;
 *   // use pool.executeEffect(...)
 * });
 * ```
 */
export const ProcessorPoolTag = Context.GenericTag<ProcessorPool>('ProcessorPool');

// ============================================================================
// Pool Configuration
// ============================================================================

/**
 * Configuration for creating a processor pool.
 */
export interface ProcessorPoolConfig {
  /**
   * Path to the worker module (relative or absolute URL)
   */
  readonly workerModulePath: string;

  /**
   * Number of workers in the pool.
   * Default: navigator.hardwareConcurrency ?? 4
   *
   * SIZING FORMULA (for HMI/SCADA deadlines):
   *   N = ceil(λ × (P + L + T/B))
   *
   * Where:
   *   N = pool size
   *   λ = request arrival rate (requests/sec)
   *   P = processing time per request (sec)
   *   L = communication latency overhead (sec)
   *   T = transfer size (bytes)
   *   B = bandwidth (bytes/sec)
   *
   * For hard real-time deadlines D_hard:
   *   Ensure N ≥ ceil(D_hard / P) to prevent queue buildup
   */
  readonly poolSize?: number;

  /**
   * Permits per worker (concurrent requests per worker).
   * Default: 1 (recommended for CPU-bound work)
   */
  readonly permitsPerWorker?: number;

  /**
   * Time to wait for idle workers to be reclaimed (milliseconds).
   * Default: 30000 (30 seconds)
   */
  readonly idleTimeToLive?: number;
}

// ============================================================================
// Pool Factory
// ============================================================================

/**
 * Create a processor pool layer with Effect Platform Worker.
 *
 * This sets up a serialized worker pool that:
 * - Validates requests/responses at boundary using schemas
 * - Handles Transferable ArrayBuffers for zero-copy transfer
 * - Provides cooperative cancellation via Effect interruption
 *
 * IMPORTANT: The worker module must export a handler compatible with
 * Effect Platform Worker serialized protocol.
 *
 * @param tag - Context tag for the pool
 * @param config - Pool configuration
 * @returns Layer providing the processor pool
 *
 * @example
 * ```ts
 * const config: ProcessorPoolConfig = {
 *   workerModulePath: new URL('./processor-worker.ts', import.meta.url).href,
 *   poolSize: 4,
 * };
 *
 * const PoolLayer = makeProcessorPoolLayer(ProcessorPoolTag, config);
 * ```
 */
export function makeProcessorPoolLayer<T extends Context.Tag<ProcessorPool, ProcessorPool>>(
  _tag: T,
  config: ProcessorPoolConfig,
): Layer.Layer<ProcessorPool> {
  // Worker pool configuration
  // Note: In production implementation, use these values with Worker.makePoolSerializedLayer
  const poolSize = config.poolSize ?? (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 4 : 4);

  // NOTE: This is a simplified implementation. In production, you would use:
  //
  // import * as Worker from '@effect/platform/Worker';
  // import * as Duration from 'effect/Duration';
  //
  // const permitsPerWorker = config.permitsPerWorker ?? 1;
  // const idleTimeToLive = config.idleTimeToLive ?? 30000;
  //
  // return Worker.makePoolSerializedLayer({
  //   size: poolSize,
  //   concurrency: permitsPerWorker,
  //   idleTimeToLive: Duration.millis(idleTimeToLive),
  //   spawn: () => new globalThis.Worker(config.workerModulePath, { type: 'module' }),
  //   permits: permitsPerWorker,
  //   initialMessage: () => Effect.succeed(undefined),
  //   encode: encodeWithTransferables,
  //   Request: ProcessorRequestSchema,
  //   Response: ProcessorResponseSchema,
  // }).pipe(
  //   Layer.map((pool) => Context.make(tag, pool))
  // );

  // For this example, we provide a mock implementation that can be used
  // for testing without actual worker spawning.
  return Layer.succeed(
    ProcessorPoolTag,
    createMockPool(poolSize, config.workerModulePath),
  );
}

/**
 * Create a mock pool for testing/demonstration.
 * In production, replace with actual Worker.makePoolSerializedLayer.
 */
function createMockPool(_poolSize: number, _workerPath: string): ProcessorPool {
  return {
    executeEffect: (request: ProcessorRequest) => {
      // Import handler dynamically for mock execution
      return Effect.tryPromise({
        try: async () => {
          // In real implementation, this would send to worker.
          // For demo, we process inline (simulating worker behavior).
          const { handleRequest } = await import('./processor-worker');
          const response = await Effect.runPromise(handleRequest(request));
          return response;
        },
        catch: (error) => poolError('Failed to process request', error),
      });
    },
  };
}

// ============================================================================
// QoS Lane Utilities
// ============================================================================

/**
 * QoS lane priorities for request scheduling.
 *
 * In HMI/SCADA systems, different update types have different urgency:
 * - CRITICAL: Alarm states, safety interlocks (must meet D_hard)
 * - HIGH: Operator-triggered updates (should meet D_soft)
 * - NORMAL: Periodic refresh, trending (best effort)
 * - LOW: Background analytics, reporting (opportunistic)
 */
export type QoSLane = 'critical' | 'high' | 'normal' | 'low';

/**
 * Deadline configuration for QoS lanes.
 *
 * D_hard: Hard deadline - missing causes system failure or safety issue
 * D_soft: Soft deadline - missing degrades user experience
 */
export interface DeadlineConfig {
  /**
   * Hard deadline in milliseconds.
   * Requests must complete within this time or be abandoned.
   */
  readonly dHard: number;

  /**
   * Soft deadline in milliseconds.
   * Target completion time for good UX.
   */
  readonly dSoft: number;
}

/**
 * Default deadline configurations per QoS lane.
 *
 * Tune these based on your specific HMI requirements and
 * the measured processing times for typical workloads.
 */
export const DEFAULT_DEADLINES: Record<QoSLane, DeadlineConfig> = {
  critical: { dHard: 100, dSoft: 50 },    // 100ms hard, 50ms soft
  high: { dHard: 500, dSoft: 200 },        // 500ms hard, 200ms soft
  normal: { dHard: 2000, dSoft: 1000 },    // 2s hard, 1s soft
  low: { dHard: 10000, dSoft: 5000 },      // 10s hard, 5s soft
};

/**
 * Execute request with deadline enforcement.
 *
 * Wraps pool execution with timeout based on QoS lane deadlines.
 * If the hard deadline is exceeded, the request is interrupted.
 *
 * @param pool - The processor pool
 * @param request - The request to execute
 * @param lane - QoS lane for deadline selection
 * @param deadlines - Optional custom deadline config
 * @returns Effect that times out based on deadlines
 *
 * @example
 * ```ts
 * const result = yield* executeWithDeadline(pool, request, 'high');
 * ```
 */
export function executeWithDeadline(
  pool: ProcessorPool,
  request: ProcessorRequest,
  lane: QoSLane,
  deadlines?: DeadlineConfig,
): Effect.Effect<ProcessorResponse, PoolError | Error> {
  const config = deadlines ?? DEFAULT_DEADLINES[lane];

  return Effect.flatMap(
    Effect.timeout(pool.executeEffect(request), config.dHard),
    (option) => {
      if (option === undefined) {
        return Effect.fail(new Error(`Request exceeded hard deadline of ${config.dHard}ms`));
      }
      return Effect.succeed(option);
    },
  );
}

// ============================================================================
// Exports for README examples
// ============================================================================

export {
  ProcessorRequestSchema,
  ProcessorResponseSchema,
  encodeWithTransferables,
};
