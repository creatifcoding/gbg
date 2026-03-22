/**
 * ChatDataProvider Service
 *
 * Effect.Service pattern for chat data abstraction.
 * Provides injectable providers that can be swapped at runtime.
 *
 * Strategy pattern: TerminalV3Provider vs AISDKProvider
 * - TerminalV3Provider wraps useBlockTerminal + blocksAtom
 * - AISDKProvider wraps useChatWithTools + AI SDK messages
 *
 * @example
 * ```tsx
 * import { ChatDataProvider, AISDKProvider } from '@/lib/ai-core/providers'
 * import { Effect } from 'effect'
 *
 * // Provide the desired implementation
 * const program = Effect.gen(function* () {
 *   const provider = yield* ChatDataProvider
 *   yield* provider.sendMessage('Hello')
 *   const messages = yield* provider.getMessages
 * }).pipe(Effect.provide(AISDKProvider.Default))
 * ```
 */

import { Context, Effect, Layer, Schema, Stream, Option } from 'effect'
import type { ChatMessage } from '../types'

// =============================================================================
// SCHEMAS
// =============================================================================

/**
 * Provider status
 */
export const ProviderStatus = Schema.Literal('idle', 'loading', 'streaming', 'error')
export type ProviderStatus = typeof ProviderStatus.Type

/**
 * Send message options
 */
export class SendMessageOptions extends Schema.Class<SendMessageOptions>('SendMessageOptions')({
  /** Message text */
  text: Schema.String,
  /** Optional system prompt override */
  systemPrompt: Schema.optionalWith(Schema.String, { as: 'Option' }),
  /** Optional attachments */
  attachments: Schema.optionalWith(Schema.Array(Schema.Unknown), { default: () => [] }),
}) {}

/**
 * Provider state snapshot
 */
export class ProviderState extends Schema.Class<ProviderState>('ProviderState')({
  /** Current status */
  status: ProviderStatus,
  /** All messages in the conversation */
  messages: Schema.Array(Schema.Unknown), // ChatMessage[], typed as Unknown for flexibility
  /** Current error message if any */
  error: Schema.NullOr(Schema.String),
  /** Whether streaming is active */
  isStreaming: Schema.Boolean,
  /** ID of currently streaming message (if any) */
  streamingMessageId: Schema.NullOr(Schema.String),
}) {}

/**
 * Generic interactive extension UI request surfaced by providers that support it (e.g. pi-rpc).
 */
export class ExtensionUIRequest extends Schema.Class<ExtensionUIRequest>('ExtensionUIRequest')({
  requestId: Schema.String,
  method: Schema.String,
  payload: Schema.Unknown,
  agentId: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export const ExtensionUIResponseKind = Schema.Literal('value', 'confirm', 'cancel')
export type ExtensionUIResponseKind = typeof ExtensionUIResponseKind.Type

/**
 * Generic interactive extension UI response payload.
 */
export class ExtensionUIResponse extends Schema.Class<ExtensionUIResponse>('ExtensionUIResponse')({
  requestId: Schema.String,
  kind: ExtensionUIResponseKind,
  value: Schema.optionalWith(Schema.String, { as: 'Option' }),
  confirmed: Schema.optionalWith(Schema.Boolean, { as: 'Option' }),
}) {}

// =============================================================================
// SERVICE SHAPE
// =============================================================================

/**
 * ChatDataProvider service shape
 *
 * Defines the contract for all chat data providers.
 * Implementations must provide Effect-native operations.
 */
export interface ChatDataProviderShape {
  /** Provider identifier */
  readonly id: string
  /** Provider display name */
  readonly name: string

  /**
   * Get current provider state snapshot
   */
  readonly getState: Effect.Effect<ProviderState>

  /**
   * Get all messages in the conversation
   */
  readonly getMessages: Effect.Effect<readonly ChatMessage[]>

  /**
   * Check if currently streaming
   */
  readonly isStreaming: Effect.Effect<boolean>

  /**
   * Get current error if any
   */
  readonly getError: Effect.Effect<Option.Option<string>>

  /**
   * Send a message to the chat
   */
  readonly sendMessage: (options: SendMessageOptions) => Effect.Effect<void, ChatSendError>

  /**
   * Abort current stream
   */
  readonly abort: Effect.Effect<void>

  /**
   * Clear conversation history
   */
  readonly clear: Effect.Effect<void>

  /**
   * Optional provider capability: expose provider/harness metrics.
   * Implemented by providers that aggregate telemetry in-process (e.g. pi-rpc).
   */
  readonly getMetrics?: Effect.Effect<Readonly<Record<string, number>>>

  /**
   * Optional provider capability: list pending interactive extension UI requests.
   * Implemented by providers like pi-rpc; absent on generic providers.
   */
  readonly getPendingExtensionUI?: Effect.Effect<readonly ExtensionUIRequest[]>

  /**
   * Optional provider capability: send extension UI response back to provider runtime.
   * Implemented by providers like pi-rpc; absent on generic providers.
   */
  readonly respondExtensionUI?: (response: ExtensionUIResponse) => Effect.Effect<void, ChatSendError>

  /**
   * Stream of state changes (for reactive subscriptions)
   */
  readonly stateChanges: Stream.Stream<ProviderState>
}

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Error when sending a message fails
 */
export class ChatSendError extends Schema.TaggedError<ChatSendError>()('ChatSendError', {
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
}) {}

/**
 * Error when provider is not configured
 */
export class ProviderNotConfiguredError extends Schema.TaggedError<ProviderNotConfiguredError>()(
  'ProviderNotConfiguredError',
  {
    providerId: Schema.String,
    reason: Schema.String,
  }
) {}

// =============================================================================
// SERVICE DEFINITION
// =============================================================================

/**
 * ChatDataProvider Service Tag
 *
 * Use Context.Tag for strategy pattern - multiple implementations.
 */
export class ChatDataProvider extends Context.Tag('tmnl/ai-core/ChatDataProvider')<
  ChatDataProvider,
  ChatDataProviderShape
>() {}

// =============================================================================
// NOOP PROVIDER (Default/Fallback)
// =============================================================================

/**
 * No-op provider for when no real provider is configured.
 * Returns empty state and logs warnings.
 */
const noopProviderShape: ChatDataProviderShape = {
  id: 'noop',
  name: 'No Provider Configured',

  getState: Effect.succeed(
    new ProviderState({
      status: 'idle',
      messages: [],
      error: 'No chat provider configured',
      isStreaming: false,
      streamingMessageId: null,
    })
  ),

  getMessages: Effect.succeed([]),

  isStreaming: Effect.succeed(false),

  getError: Effect.succeed(Option.some('No chat provider configured')),

  sendMessage: (_options: SendMessageOptions) =>
    Effect.fail(
      new ChatSendError({
        message: 'Cannot send message: No provider configured',
        cause: Option.none(),
      })
    ),

  abort: Effect.log('ChatDataProvider.abort called but no provider configured').pipe(Effect.asVoid),

  clear: Effect.log('ChatDataProvider.clear called but no provider configured').pipe(Effect.asVoid),

  stateChanges: Stream.empty,
}

export const NoopProvider = {
  Default: Layer.succeed(ChatDataProvider, noopProviderShape),
  shape: noopProviderShape,
}

// =============================================================================
// PROVIDER REGISTRY TYPE
// =============================================================================

/**
 * Provider type for runtime selection
 */
export type ChatDataProviderType = 'noop' | 'ai-sdk' | 'terminal-v3' | 'pi-rpc'

/**
 * Registry of built-in providers
 */
export const BUILT_IN_PROVIDERS = {
  noop: NoopProvider,
} as const
