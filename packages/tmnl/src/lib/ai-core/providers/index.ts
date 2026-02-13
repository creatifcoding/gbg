/**
 * AI Core Providers
 *
 * ChatDataProvider service and implementations.
 * Strategy pattern for swappable chat data sources.
 *
 * @example
 * ```tsx
 * import { ChatDataProvider, AISDKProvider, NoopProvider } from '@/lib/ai-core/providers'
 *
 * // Use AI SDK provider
 * Effect.provide(AISDKProvider.Default)
 *
 * // Or use noop for testing
 * Effect.provide(NoopProvider.Default)
 * ```
 */

// =============================================================================
// Core Service
// =============================================================================

export {
  // Service Tag
  ChatDataProvider,
  // Shapes & Types
  type ChatDataProviderShape,
  type ChatDataProviderType,
  // Schemas
  ProviderStatus,
  SendMessageOptions,
  ProviderState,
  ExtensionUIRequest,
  ExtensionUIResponse,
  ExtensionUIResponseKind,
  // Errors
  ChatSendError,
  ProviderNotConfiguredError,
  // Default provider
  NoopProvider,
  BUILT_IN_PROVIDERS,
} from './ChatDataProvider'

// =============================================================================
// AI SDK Provider
// =============================================================================

export {
  // Provider
  AISDKProvider,
  // Config
  AISDKProviderConfig,
  type AISDKProviderConfigShape,
  // Bridge (for React adapter)
  AISDKBridgeService,
  type AISDKBridge,
} from './AISDKProvider'

// =============================================================================
// React Hook Adapter
// =============================================================================

export {
  useAISDKProviderBridge,
  type UseAISDKProviderBridgeOptions,
  type UseAISDKProviderBridgeReturn,
} from './useAISDKProviderBridge'

// =============================================================================
// Pi Provider
// =============================================================================

export {
  PiProvider,
  PiProviderConfig,
  PiProviderConfigDefault,
  type PiProviderConfigShape,
} from './pi'
