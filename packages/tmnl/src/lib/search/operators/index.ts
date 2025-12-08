/**
 * TMNL Search — Operators
 *
 * Stream operators for search result pipelines.
 */

// Score-based operators
export {
  withMinScore,
  withMaxScore,
  withScoreRange,
  withFieldBoost,
  withBoosts,
  withPositionDecay,
  withFieldMatch,
  withAnyFieldMatch,
  withAllFieldMatches,
  withMatches,
  sortedByScore,
} from './scored'

// Tracing operators
export {
  tracedStream,
  timedStream,
  createTracedDriver,
  consoleTracedStream,
} from './traced'
