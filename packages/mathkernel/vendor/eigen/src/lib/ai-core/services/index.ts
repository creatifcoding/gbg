/**
 * AI Core Services
 *
 * Re-exports all Effect.Service implementations.
 */

export { SSEAdapter, type SSEAdapterShape } from './SSEAdapter'
export { ToolBridge, type ToolBridgeShape } from './ToolBridge'
export {
  AICoreService,
  type AICoreServiceShape,
  type AIProvider,
  type StreamChatRequest,
  type StreamHandle,
} from './AICoreService'
export {
  // Service tags
  ConversationCompactor,
  Summarizer,
  // Schemas
  CompactionConfig,
  CompactionResult,
  SummarizationRequest,
  // Errors
  SummarizationError,
  // Layers
  ConversationCompactorLive,
  ConversationCompactorTest,
  NoopSummarizer,
  // Service bundle
  ConversationCompactorService,
  // Types
  type ConversationCompactorShape,
  type SummarizerFn,
} from './ConversationCompactor'

// Session Storage (abstract interface)
export {
  SessionStorage,
  type SessionStorageShape,
  type SessionStorageType,
} from './SessionStorage'

// Session Storage (localStorage implementation)
export { SessionStorageLocalLive } from './SessionStorageLocal'

// Session Service (business logic)
export {
  SessionService,
  SessionServiceLive,
  SessionServiceModule,
  type SessionServiceShape,
} from './SessionService'
