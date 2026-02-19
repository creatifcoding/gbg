/**
 * Genifer Streaming JSON Parser
 *
 * Incremental JSON parsing engine built on @electric-sql/d2ts (differential dataflow).
 * Identifies component types as early as possible via discriminator field detection.
 *
 * @module genifer/streaming
 */
export {
  createTokenizer,
  JSONToken,
  ObjectStart,
  ObjectEnd,
  ArrayStart,
  ArrayEnd,
  KeyToken,
  StringToken,
  NumberToken,
  BooleanToken,
  NullToken,
} from './tokenizer.js'

export type { JSONToken as JSONTokenType } from './tokenizer.js'

export {
  createStreamingGraph,
  type ComponentIdentification,
  type StreamingGraphCallbacks,
} from './graph.js'
