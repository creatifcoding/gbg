/**
 * Semantic search module — embeddings + DuckDB analytics over questionnaire data.
 * @module
 */

// EmbeddingService — service + all error variants
export {
  EmbeddingService,
  EmbeddingConfig,
  OpenAIEmbeddingLive,
  OllamaEmbeddingLive,
  NoOpEmbeddingLive,
  makeOpenAIEmbedding,
  cosineSimilarity,
  type EmbeddingServiceShape,
  // Error types
  EmbeddingError,
  EmbeddingQuotaError,
  EmbeddingRateLimitError,
  EmbeddingAuthError,
  EmbeddingNetworkError,
  EmbeddingTimeoutError,
  EmbeddingProviderError,
  EmbeddingInputError,
  type EmbeddingErrors,
} from './EmbeddingService.ts'

// DuckDBClient — service + all error variants
export {
  DuckDBClient,
  DuckDBConfig,
  DuckDBClientLive,
  DuckDBClientMinIO,
  type DuckDBClientShape,
  // Error types
  DuckDBError,
  DuckDBInitError,
  DuckDBQueryError,
  DuckDBS3Error,
  DuckDBConnectionError,
  type DuckDBErrors,
} from './DuckDBClient.ts'

// SemanticQueryEngine — service + all error variants
export {
  SemanticQueryEngine,
  SemanticQueryEngineLive,
  type SemanticQueryEngineShape,
  // Error types
  SemanticQueryError,
  SemanticEmbedError,
  SemanticStorageError,
  SemanticNoResultsError,
  SemanticParseError,
  type SemanticErrors,
} from './SemanticQueryEngine.ts'

// Schemas
export {
  Embedding,
  SemanticFilters,
  SemanticQuery,
  SemanticMatch,
  SemanticSearchResult,
} from './schemas.ts'
