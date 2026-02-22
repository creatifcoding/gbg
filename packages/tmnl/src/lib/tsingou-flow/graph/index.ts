/**
 * @tmnl/tsingou-flow — Graph Utilities
 *
 * Version helpers, MultiSet constructors, and graph factories.
 *
 * @module tsingou-flow/graph
 */

export {
  makeVersion,
  initialVersion,
  advanceTick,
  advanceSource,
  getTick,
  getSourceSeq,
  compareVersions,
  TICK_DIM,
  SOURCE_DIM,
} from './version'

export {
  fromSignal,
  retractSignal,
  fromBatch,
  fromEntries,
  empty,
  merge,
  netCount,
  activeEntries,
  mapMultiSet,
} from './multiset-helpers'
export type { MultiSet, MultiSetEntry } from './multiset-helpers'

export {
  isValidSignal,
  normalizeTimestamp,
  tagWithIngestMetadata,
  processIngestBatch,
  ingestToMultiSet,
  createIngestGraph,
} from './ingest'

export {
  countByKind,
  countBySource,
  topK,
  timeWindow,
  createDerivedGraph,
} from './derived'
export type { Correlation, SignalCount, Anomaly } from './derived'
