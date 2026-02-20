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
  type TokenizerOptions,
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
  type RawComponentData,
  type StreamingGraphCallbacks,
  type StreamingGraphOptions,
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
  validationResultsAtom,
  validationErrorsAtom,
  type StreamingJsonServiceShape,
  type StreamingJsonServiceOptions,
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

// ---------------------------------------------------------------------------
// BFTA (Bottom-Up Finite Tree Automaton)
// ---------------------------------------------------------------------------
export {
  buildGrammar,
  isLanguageEmpty,
  isConstraintDAG,
  grammarToMermaid,
  createBFTAValidator,
  type Grammar,
  type ComponentRegistration,
  type ComponentNode,
  type ConstraintEdge,
  type BFTAState,
  type ValidationResult,
  type BFTACallbacks,
} from './bfta.js'
