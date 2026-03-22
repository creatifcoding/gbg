/**
 * Effect Schema types for Telegram Agent
 *
 * Follows Schema Discipline — NO RAW TYPES
 */

import { Schema } from 'effect';

// ============================================================================
// Connection State
// ============================================================================

export const ConnectionState = Schema.Literal('disconnected', 'connecting', 'connected', 'error');
export type ConnectionState = typeof ConnectionState.Type;

// ============================================================================
// Message Types
// ============================================================================

export const TelegramMessageRole = Schema.Literal('user', 'assistant', 'system');
export type TelegramMessageRole = typeof TelegramMessageRole.Type;

export const TelegramMessage = Schema.Struct({
  id: Schema.String,
  chatId: Schema.Number,
  role: TelegramMessageRole,
  content: Schema.String,
  timestamp: Schema.Number,
  metadata: Schema.optional(Schema.Unknown),
});
export type TelegramMessage = typeof TelegramMessage.Type;

// ============================================================================
// Chat State
// ============================================================================

export const TelegramChatState = Schema.Struct({
  chatId: Schema.Number,
  username: Schema.optional(Schema.String),
  firstName: Schema.optional(Schema.String),
  messages: Schema.Array(TelegramMessage),
  lastActivity: Schema.Number,
});
export type TelegramChatState = typeof TelegramChatState.Type;

// ============================================================================
// Bot Status
// ============================================================================

export const BotStatus = Schema.Literal('idle', 'thinking', 'streaming', 'error');
export type BotStatus = typeof BotStatus.Type;

// ============================================================================
// Command Types
// ============================================================================

export const TelegramCommand = Schema.TaggedStruct('TelegramCommand', {
  command: Schema.String,
  args: Schema.Array(Schema.String),
  chatId: Schema.Number,
});
export type TelegramCommand = typeof TelegramCommand.Type;

// ============================================================================
// Events (for XState)
// ============================================================================

export const TelegramEventConnect = Schema.TaggedStruct('CONNECT', {});
export type TelegramEventConnect = typeof TelegramEventConnect.Type;

export const TelegramEventDisconnect = Schema.TaggedStruct('DISCONNECT', {});
export type TelegramEventDisconnect = typeof TelegramEventDisconnect.Type;

export const TelegramEventMessageReceived = Schema.TaggedStruct('MESSAGE_RECEIVED', {
  chatId: Schema.Number,
  text: Schema.String,
  username: Schema.optional(Schema.String),
});
export type TelegramEventMessageReceived = typeof TelegramEventMessageReceived.Type;

export const TelegramEventAiThinking = Schema.TaggedStruct('AI_THINKING', {
  chatId: Schema.Number,
});
export type TelegramEventAiThinking = typeof TelegramEventAiThinking.Type;

export const TelegramEventAiStreaming = Schema.TaggedStruct('AI_STREAMING', {
  chatId: Schema.Number,
});
export type TelegramEventAiStreaming = typeof TelegramEventAiStreaming.Type;

export const TelegramEventAiComplete = Schema.TaggedStruct('AI_COMPLETE', {
  chatId: Schema.Number,
});
export type TelegramEventAiComplete = typeof TelegramEventAiComplete.Type;

export const TelegramEventError = Schema.TaggedStruct('ERROR', {
  error: Schema.String,
});
export type TelegramEventError = typeof TelegramEventError.Type;

export const TelegramEvent = Schema.Union(
  TelegramEventConnect,
  TelegramEventDisconnect,
  TelegramEventMessageReceived,
  TelegramEventAiThinking,
  TelegramEventAiStreaming,
  TelegramEventAiComplete,
  TelegramEventError
);
export type TelegramEvent = typeof TelegramEvent.Type;
