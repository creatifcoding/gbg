/**
 * ConversationCompactor Service
 *
 * Effect.Service for AI-powered conversation summarization.
 * Compacts old messages into summaries to maintain context
 * while keeping token usage manageable.
 *
 * Strategy:
 * - Keep last N messages in full (default: 10)
 * - When total exceeds threshold (default: 20), summarize older messages
 * - Summary becomes a system message preserving key context
 *
 * @example
 * ```typescript
 * import { ConversationCompactor } from '@/lib/ai-core/services'
 *
 * const program = Effect.gen(function* () {
 *   const compactor = yield* ConversationCompactor
 *   const compactedMessages = yield* compactor.compact(messages)
 * }).pipe(Effect.provide(ConversationCompactor.Default))
 * ```
 */

import { Context, Effect, Layer, Schema } from 'effect'
import type { ChatMessage } from '../types'

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Compaction configuration
 */
export class CompactionConfig extends Schema.Class<CompactionConfig>('CompactionConfig')({
  /** Number of recent messages to keep in full */
  keepRecentCount: Schema.optionalWith(Schema.Number, { default: () => 10 }),
  /** Total message count that triggers compaction */
  compactionThreshold: Schema.optionalWith(Schema.Number, { default: () => 20 }),
  /** Maximum tokens for the summary */
  maxSummaryTokens: Schema.optionalWith(Schema.Number, { default: () => 500 }),
  /** Whether to include tool calls in summary */
  includeToolCalls: Schema.optionalWith(Schema.Boolean, { default: () => true }),
}) {}

/**
 * Compaction result
 */
export class CompactionResult extends Schema.Class<CompactionResult>('CompactionResult')({
  /** Whether compaction occurred */
  wasCompacted: Schema.Boolean,
  /** Number of messages before compaction */
  originalCount: Schema.Number,
  /** Number of messages after compaction */
  compactedCount: Schema.Number,
  /** The summary text if compaction occurred */
  summary: Schema.NullOr(Schema.String),
  /** Messages after compaction */
  messages: Schema.Array(Schema.Unknown), // ChatMessage[]
}) {}

/**
 * Summary request for AI
 */
export class SummarizationRequest extends Schema.Class<SummarizationRequest>('SummarizationRequest')({
  /** Messages to summarize */
  messagesToSummarize: Schema.Array(Schema.Unknown),
  /** Max tokens for summary */
  maxTokens: Schema.Number,
  /** Include tool call information */
  includeToolCalls: Schema.Boolean,
}) {}

// =============================================================================
// SERVICE SHAPE
// =============================================================================

/**
 * Summarizer function type - injected dependency for actual AI summarization
 */
export type SummarizerFn = (
  conversation: string,
  maxTokens: number
) => Effect.Effect<string, SummarizationError>

/**
 * ConversationCompactor service shape
 */
export interface ConversationCompactorShape {
  /**
   * Check if messages need compaction
   */
  readonly needsCompaction: (
    messages: readonly ChatMessage[],
    config?: CompactionConfig
  ) => Effect.Effect<boolean>

  /**
   * Compact messages using AI summarization
   */
  readonly compact: (
    messages: readonly ChatMessage[],
    config?: CompactionConfig
  ) => Effect.Effect<CompactionResult, SummarizationError>

  /**
   * Build conversation text from messages (for summarization)
   */
  readonly buildConversationText: (
    messages: readonly ChatMessage[],
    includeToolCalls: boolean
  ) => Effect.Effect<string>

  /**
   * Create a summary system message
   */
  readonly createSummaryMessage: (summary: string) => Effect.Effect<ChatMessage>
}

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Error during summarization
 */
export class SummarizationError extends Schema.TaggedError<SummarizationError>()(
  'SummarizationError',
  {
    message: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  }
) {}

// =============================================================================
// SERVICE DEFINITION
// =============================================================================

/**
 * ConversationCompactor Service Tag
 */
export class ConversationCompactor extends Context.Tag('tmnl/ai-core/ConversationCompactor')<
  ConversationCompactor,
  ConversationCompactorShape
>() {}

/**
 * Summarizer Service Tag (dependency for actual AI calls)
 */
export class Summarizer extends Context.Tag('tmnl/ai-core/Summarizer')<
  Summarizer,
  SummarizerFn
>() {}

// =============================================================================
// DEFAULT IMPLEMENTATION
// =============================================================================

const DEFAULT_CONFIG = new CompactionConfig({})

/**
 * Build conversation text from messages
 */
const buildConversationTextImpl = (
  messages: readonly ChatMessage[],
  includeToolCalls: boolean
): string => {
  return messages
    .map((msg) => {
      const role = msg.role.toUpperCase()
      const parts: string[] = []

      // Add text content
      if (msg.text) {
        parts.push(msg.text)
      }

      // Add tool call info if requested
      if (includeToolCalls && msg.toolCalls.length > 0) {
        const toolInfo = msg.toolCalls
          .map((tc) => `[Tool: ${tc.toolName}${tc.status === 'complete' ? ' ✓' : ''}]`)
          .join(', ')
        parts.push(toolInfo)
      }

      return `${role}: ${parts.join(' ')}`
    })
    .join('\n')
}

/**
 * Default compactor implementation
 */
const createCompactorShape = (summarize: SummarizerFn): ConversationCompactorShape => ({
  needsCompaction: (messages, config = DEFAULT_CONFIG) =>
    Effect.succeed(messages.length > config.compactionThreshold),

  buildConversationText: (messages, includeToolCalls) =>
    Effect.succeed(buildConversationTextImpl(messages, includeToolCalls)),

  createSummaryMessage: (summary) =>
    Effect.succeed({
      id: `summary-${Date.now()}`,
      role: 'system' as const,
      text: `[Previous conversation summary]\n${summary}`,
      thinking: null,
      toolCalls: [],
      isStreaming: false,
      createdAt: Date.now(),
    } as unknown as ChatMessage),

  compact: (messages, config = DEFAULT_CONFIG) =>
    Effect.gen(function* () {
      const threshold = config.compactionThreshold
      const keepRecent = config.keepRecentCount

      // Check if compaction needed
      if (messages.length <= threshold) {
        return new CompactionResult({
          wasCompacted: false,
          originalCount: messages.length,
          compactedCount: messages.length,
          summary: null,
          messages: messages as unknown[],
        })
      }

      // Split messages
      const oldMessages = messages.slice(0, -keepRecent)
      const recentMessages = messages.slice(-keepRecent)

      // Build conversation text for summarization
      const conversationText = buildConversationTextImpl(oldMessages, config.includeToolCalls)

      // Generate summary via injected summarizer
      const summaryPrompt = `Summarize this conversation in 3-5 bullet points. Preserve key decisions, user preferences, and important context. Be concise but complete:\n\n${conversationText}`

      const summary = yield* summarize(summaryPrompt, config.maxSummaryTokens)

      // Create summary message
      const summaryMessage: ChatMessage = {
        id: `summary-${Date.now()}`,
        role: 'system',
        text: `[Previous conversation summary]\n${summary}`,
        thinking: null,
        toolCalls: [],
        isStreaming: false,
        createdAt: Date.now(),
      } as unknown as ChatMessage

      // Combine summary + recent messages
      const compactedMessages = [summaryMessage, ...recentMessages]

      return new CompactionResult({
        wasCompacted: true,
        originalCount: messages.length,
        compactedCount: compactedMessages.length,
        summary,
        messages: compactedMessages as unknown[],
      })
    }),
})

// =============================================================================
// LAYERS
// =============================================================================

/**
 * ConversationCompactor layer that requires Summarizer
 */
export const ConversationCompactorLive = Layer.effect(
  ConversationCompactor,
  Effect.gen(function* () {
    const summarize = yield* Summarizer
    return createCompactorShape(summarize)
  })
)

/**
 * No-op summarizer for testing (just truncates)
 */
const noopSummarizer: SummarizerFn = (conversation, maxTokens) =>
  Effect.succeed(
    `[Summary of ${conversation.split('\n').length} messages - truncated for testing]`
  )

export const NoopSummarizer = {
  Default: Layer.succeed(Summarizer, noopSummarizer),
}

/**
 * Full layer with noop summarizer (for testing)
 */
export const ConversationCompactorTest = ConversationCompactorLive.pipe(
  Layer.provide(NoopSummarizer.Default)
)

// =============================================================================
// EXPORTS
// =============================================================================

export const ConversationCompactorService = {
  /**
   * Layer requiring Summarizer dependency
   */
  Live: ConversationCompactorLive,

  /**
   * Test layer with noop summarizer
   */
  Test: ConversationCompactorTest,

  /**
   * Default config
   */
  DefaultConfig: DEFAULT_CONFIG,

  /**
   * Create custom config
   */
  config: (opts: Partial<CompactionConfig>) =>
    new CompactionConfig({
      keepRecentCount: opts.keepRecentCount,
      compactionThreshold: opts.compactionThreshold,
      maxSummaryTokens: opts.maxSummaryTokens,
      includeToolCalls: opts.includeToolCalls,
    }),
}
