/**
 * Genifer Streaming JSON Parser
 *
 * Incremental JSON parsing engine built on @electric-sql/d2ts (differential dataflow).
 * Identifies component types as early as possible via discriminator field detection.
 *
 * @module genifer/streaming
 */

// ---------------------------------------------------------------------------
// Tokenizer (low-level)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Graph (d2ts dataflow)
// ---------------------------------------------------------------------------
export {
  createStreamingGraph,
  type ComponentIdentification,
  type StreamingGraphCallbacks,
} from './graph.js'

// ---------------------------------------------------------------------------
// Service (Atom-as-State pattern)
// ---------------------------------------------------------------------------
export {
  createStreamingJsonService,
  getStreamingJsonService,
  identifiedComponentsAtom,
  isParsingAtom,
  tokensAtom,
  partialFieldsAtom,
  streamingErrorAtom,
  chunkCountAtom,
  type StreamingJsonServiceShape,
} from './service.js'

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------
export {
  useStreamingJson,
  type UseStreamingJsonReturn,
} from './useStreamingJson.js'

// ---------------------------------------------------------------------------
// React Renderer
// ---------------------------------------------------------------------------
export {
  StreamingRenderer,
  type StreamingRendererProps,
} from './StreamingRenderer.js'
