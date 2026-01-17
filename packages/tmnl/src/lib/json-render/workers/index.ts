/**
 * Workers Module
 *
 * Effect-wrapped web workers for offloading CPU-intensive work.
 *
 * @module json-render/workers
 */

// Re-export worker API
export {
  type ParseWorkerService,
  ParseWorker,
  ParseWorkerLive,
  ParseWorkerFallback,
  ParseWorkerAuto,
  makeParseWorkerFallback,
} from "./worker-api"

// Re-export worker types for external use
export type {
  ParseRequest,
  ParseResponse,
  ParseBatchRequest,
  WorkerRequest,
  WorkerResponse,
} from "./parse.worker"
