/**
 * AI Provider Schemas
 *
 * Effect Schema definitions for AI provider configuration.
 */

import { Schema } from 'effect'

// =============================================================================
// AI Provider
// =============================================================================

export const AIProvider = Schema.Literal('anthropic', 'openai', 'claude-code')
export type AIProvider = typeof AIProvider.Type

// =============================================================================
// Thinking Level
// =============================================================================

export const ThinkingLevel = Schema.Literal('none', 'low', 'medium', 'high')
export type ThinkingLevel = typeof ThinkingLevel.Type

/**
 * Token budgets for thinking levels
 */
export const THINKING_BUDGETS: Record<ThinkingLevel, number> = {
  none: 0,
  low: 5000,
  medium: 20000,
  high: 50000,
}

/**
 * Get display label for thinking level
 */
export function getThinkingLevelLabel(level: ThinkingLevel): string {
  switch (level) {
    case 'none':
      return 'Off'
    case 'low':
      return 'Low (~5k tokens)'
    case 'medium':
      return 'Medium (~20k tokens)'
    case 'high':
      return 'High (~50k tokens)'
  }
}

// =============================================================================
// Thinking Config
// =============================================================================

export const ThinkingConfig = Schema.Struct({
  type: Schema.Literal('enabled', 'disabled'),
  budget: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
})
export type ThinkingConfig = typeof ThinkingConfig.Type

// =============================================================================
// Message Types (compatible with AI SDK CoreMessage)
// =============================================================================

export const AIMessageRole = Schema.Literal('user', 'assistant', 'system', 'tool')
export type AIMessageRole = typeof AIMessageRole.Type

export const AITextContent = Schema.Struct({
  type: Schema.Literal('text'),
  text: Schema.String,
})
export type AITextContent = typeof AITextContent.Type

export const AIToolCallContent = Schema.Struct({
  type: Schema.Literal('tool-call'),
  toolCallId: Schema.String,
  toolName: Schema.String,
  args: Schema.Unknown,
})
export type AIToolCallContent = typeof AIToolCallContent.Type

export const AIToolResultContent = Schema.Struct({
  type: Schema.Literal('tool-result'),
  toolCallId: Schema.String,
  toolName: Schema.optional(Schema.String),
  result: Schema.Unknown,
})
export type AIToolResultContent = typeof AIToolResultContent.Type

export const AIMessageContent = Schema.Union(
  Schema.String,
  Schema.Array(Schema.Union(AITextContent, AIToolCallContent, AIToolResultContent))
)
export type AIMessageContent = typeof AIMessageContent.Type

export const AIMessage = Schema.Struct({
  role: AIMessageRole,
  content: AIMessageContent,
})
export type AIMessage = typeof AIMessage.Type

// =============================================================================
// Stream Chat Request
// =============================================================================

export const StreamChatRequest = Schema.Struct({
  modelId: Schema.String,
  provider: AIProvider,
  messages: Schema.Array(AIMessage),
  thinking: Schema.optional(ThinkingConfig),
  cwd: Schema.optional(Schema.String),
  systemPrompt: Schema.optional(Schema.String),
  maxSteps: Schema.optional(Schema.Number.pipe(Schema.greaterThan(0))),
})
export type StreamChatRequest = typeof StreamChatRequest.Type

// =============================================================================
// Model Configuration
// =============================================================================

export const AIModelConfig = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  provider: AIProvider,
  contextWindow: Schema.Number,
  supportsThinking: Schema.optional(Schema.Boolean),
  supportsTools: Schema.optional(Schema.Boolean),
})
export type AIModelConfig = typeof AIModelConfig.Type

// =============================================================================
// Default Models
// =============================================================================

export const DEFAULT_MODELS: readonly AIModelConfig[] = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    contextWindow: 200000,
    supportsThinking: true,
    supportsTools: true,
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    supportsThinking: true,
    supportsTools: true,
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    supportsThinking: false,
    supportsTools: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128000,
    supportsThinking: false,
    supportsTools: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128000,
    supportsThinking: false,
    supportsTools: true,
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Code (Local)',
    provider: 'claude-code',
    contextWindow: 200000,
    supportsThinking: true,
    supportsTools: true,
  },
] as const
