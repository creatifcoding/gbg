/**
 * Workers Module (canonical)
 *
 * Genifer now standardizes on TreeWorkerPool (Effect Platform worker pool)
 * for patch application off-main-thread.
 *
 * Legacy single-worker parse/tree APIs were removed during worker dedupe.
 */

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
