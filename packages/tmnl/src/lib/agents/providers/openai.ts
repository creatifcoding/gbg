/**
 * OpenAI LanguageModel layer factory.
 *
 * Creates an @effect/ai LanguageModel backed by OpenAI's Responses API,
 * authenticated via Pi's OAuth tokens (openai-codex provider) OR
 * OPENAI_API_KEY environment variable.
 *
 * API endpoint: https://api.openai.com (standard OpenAI Responses API)
 *
 * NOTE: The Codex subscription OAuth token (from chatgpt.com) has scopes
 * for chatgpt.com/backend-api, NOT api.openai.com/v1/responses. For OAuth,
 * you may get 401 "Missing scopes: api.responses.write". Use env var path
 * (makeOpenAiLayerFromEnv) with a proper API key for reliable access.
 */
import { OpenAiClient, OpenAiLanguageModel } from '@effect/ai-openai'
import { FetchHttpClient } from '@effect/platform'
import { Effect, Layer, Redacted } from 'effect'

import { PiAuthBridge } from '../auth/PiAuthBridge'

// ── Constants ──

const PROVIDER_ID = 'openai-codex'

// ── Layer factory ──

/**
 * Create an OpenAI LanguageModel layer using PiAuthBridge for OAuth tokens.
 *
 * Uses `Layer.unwrapEffect` to read the token from PiAuthBridge first,
 * then constructs the client layer with the token as apiKey.
 *
 * ⚠️ Codex subscription tokens may lack `api.responses.write` scope
 * for the standard OpenAI API. Use `makeOpenAiLayerFromEnv` with
 * OPENAI_API_KEY for reliable access.
 *
 * @param modelId - OpenAI model identifier (e.g., 'gpt-4o', 'gpt-4o-mini')
 * @param config - Optional OpenAI language model configuration
 */
export const makeOpenAiLayer = (
  modelId: string = 'gpt-4o-mini',
  config?: Omit<OpenAiLanguageModel.Config.Service, 'model'>,
) => {
  const dynamicLayer = Layer.unwrapEffect(
    Effect.gen(function* () {
      const bridge = yield* PiAuthBridge
      const token = yield* bridge.getApiKeyRaw(PROVIDER_ID)

      const clientLayer = OpenAiClient.layer({
        apiKey: Redacted.make(token),
      }).pipe(Layer.provide(FetchHttpClient.layer))

      const languageModelLayer = OpenAiLanguageModel.layer({
        model: modelId,
        config,
      })

      return languageModelLayer.pipe(Layer.provide(clientLayer))
    }),
  )

  return dynamicLayer
}

/**
 * Create an OpenAI LanguageModel layer using OPENAI_API_KEY env var.
 *
 * No PiAuthBridge dependency. Uses standard OpenAI API.
 *
 * @param modelId - OpenAI model identifier
 * @param config - Optional configuration
 */
export const makeOpenAiLayerFromEnv = (
  modelId: string = 'gpt-4o-mini',
  config?: Omit<OpenAiLanguageModel.Config.Service, 'model'>,
) => {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const clientLayer = OpenAiClient.layer({
    apiKey: Redacted.make(apiKey),
  }).pipe(Layer.provide(FetchHttpClient.layer))

  const languageModelLayer = OpenAiLanguageModel.layer({
    model: modelId,
    config,
  })

  return languageModelLayer.pipe(Layer.provide(clientLayer))
}

/**
 * Pre-built layer for gpt-4o-mini using env var (no OAuth dependency).
 */
export const OpenAiMiniLayerEnv = makeOpenAiLayerFromEnv('gpt-4o-mini')

// ── Type exports ──

export { PROVIDER_ID as OPENAI_PROVIDER_ID }
