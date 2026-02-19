/**
 * Workers Module
 *
 * Effect-wrapped web workers for offloading CPU-intensive work.
 *
 * @module genifer/workers
 */

// Re-export Parse Worker API
export {
  type ParseWorkerService,
  ParseWorker,
  ParseWorkerLive,
  ParseWorkerFallback,
  ParseWorkerAuto,
  makeParseWorkerFallback,
} from "./worker-api"

// Re-export Parse Worker types for external use
export type {
  ParseRequest,
  ParseResponse,
  ParseBatchRequest,
  WorkerRequest,
  WorkerResponse,
} from "./parse.worker"

// Re-export Tree Worker API
export {
  type TreeWorkerService,
  TreeWorker,
  TreeWorkerLive,
  TreeWorkerFallback,
  TreeWorkerAuto,
  makeTreeWorkerFallback,
} from "./tree-worker-api"

// Re-export Tree Worker types for external use
export type {
  ApplyPatchesRequest,
  ApplyPatchesResponse,
  TreeWorkerRequest,
  TreeWorkerResponse,
} from "./tree.worker"

// Re-export Tree Worker Pool (Effect Platform - proper pooling)
export {
  type TreeWorkerPoolService,
  type TreeWorkerPoolConfig,
  TreeWorkerPool,
  TreeWorkerPoolLive,
  TreeWorkerPoolLiveWithConfig,
  TreeWorkerPoolFallback,
  TreeWorkerPoolAuto,
  BrowserWorkerLayer,
} from "./tree-worker-pool"
