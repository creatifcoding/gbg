/**
 * Anthropic LanguageModel layer factory.
 *
 * Creates an @effect/ai LanguageModel backed by Anthropic's API,
 * authenticated via Pi's OAuth tokens (anthropic provider).
 *
 * Uses `AnthropicClient.layer()` (not `make()`) to avoid Scope management.
 * Token is read from PiAuthBridge at layer construction time and passed
 * directly as `apiKey`.
 */
import { AnthropicClient, AnthropicLanguageModel } from '@effect/ai-anthropic'
import { FetchHttpClient } from '@effect/platform'
import { Effect, Layer, Redacted } from 'effect'

import { PiAuthBridge } from '../auth/PiAuthBridge'

// ── Constants ──

const PROVIDER_ID = 'anthropic'

// ── Layer factory ──

/**
 * Create an Anthropic LanguageModel layer using PiAuthBridge for OAuth tokens.
 *
 * Since `AnthropicClient.layer()` needs a static apiKey (not effectful),
 * we use `Layer.unwrapEffect` to read the token first, then build the layer.
 *
 * @param modelId - Anthropic model identifier (e.g., 'claude-sonnet-4-20250514')
 * @param config - Optional Anthropic-specific configuration
 */
export const makeAnthropicLayer = (
  modelId: string = 'claude-sonnet-4-20250514',
  config?: Omit<AnthropicLanguageModel.Config.Service, 'model'>,
) => {
  // Build the full layer dynamically: read token → construct client layer → provide model layer
  const dynamicLayer = Layer.unwrapEffect(
    Effect.gen(function* () {
      const bridge = yield* PiAuthBridge
      const token = yield* bridge.getApiKeyRaw(PROVIDER_ID)

      const clientLayer = AnthropicClient.layer({
        apiKey: Redacted.make(token),
      }).pipe(Layer.provide(FetchHttpClient.layer))

      const languageModelLayer = AnthropicLanguageModel.layer({
        model: modelId,
        config,
      })

      return languageModelLayer.pipe(Layer.provide(clientLayer))
    }),
  )

  return dynamicLayer
}

/**
 * Create an Anthropic LanguageModel layer using ANTHROPIC_API_KEY env var.
 *
 * @param modelId - Anthropic model identifier
 * @param config - Optional configuration
 */
export const makeAnthropicLayerFromEnv = (
  modelId: string = 'claude-sonnet-4-20250514',
  config?: Omit<AnthropicLanguageModel.Config.Service, 'model'>,
) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const clientLayer = AnthropicClient.layer({
    apiKey: Redacted.make(apiKey),
  }).pipe(Layer.provide(FetchHttpClient.layer))

  const languageModelLayer = AnthropicLanguageModel.layer({
    model: modelId,
    config,
  })

  return languageModelLayer.pipe(Layer.provide(clientLayer))
}

/**
 * Pre-built layer for Claude Sonnet 4 (balanced speed + capability).
 */
export const ClaudeSonnet4Layer = makeAnthropicLayer('claude-sonnet-4-20250514')

/**
 * Pre-built layer for Claude Haiku 3.5 (fast, cheap).
 */
export const ClaudeHaiku35Layer = makeAnthropicLayer('claude-3-5-haiku-20241022')

/**
 * Pre-built layer for Claude Opus 4 (maximum capability).
 */
export const ClaudeOpus4Layer = makeAnthropicLayer('claude-opus-4-20250514')

// ── Type exports ──

export { PROVIDER_ID as ANTHROPIC_PROVIDER_ID }
