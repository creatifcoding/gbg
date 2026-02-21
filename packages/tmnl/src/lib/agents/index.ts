/**
 * TMNL Agent Calling Module
 *
 * Specialized agent calling functionality that intercepts Pi's OAuth
 * infrastructure and bridges it into @effect/ai LanguageModel layers.
 *
 * ## Quick Start (with OAuth)
 *
 * ```ts
 * import { LanguageModel } from '@effect/ai'
 * import { Effect } from 'effect'
 * import { PiAuthBridgeLive, makeOpenAiLayer } from '@/lib/agents'
 *
 * const program = Effect.gen(function* () {
 *   const model = yield* LanguageModel.LanguageModel
 *   const response = yield* model.generateText({
 *     prompt: 'What is 2 + 2?',
 *   })
 *   return response.text
 * })
 *
 * // Layer composition: LanguageModel ← OpenAiClient ← PiAuthBridge
 * const openAiLayer = makeOpenAiLayer('gpt-4o-mini')
 * const fullLayer = Layer.mergeAll(
 *   PiAuthBridgeLive,
 *   openAiLayer.pipe(Layer.provide(PiAuthBridgeLive)),
 * )
 * await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
 * ```
 *
 * ## Quick Start (env var, no OAuth)
 *
 * ```ts
 * import { makeOpenAiLayerFromEnv } from '@/lib/agents'
 *
 * const layer = makeOpenAiLayerFromEnv('gpt-4o-mini')
 * await Effect.runPromise(program.pipe(Effect.provide(layer)))
 * ```
 *
 * ## Architecture
 *
 * ```
 * PiAuthBridge (reads ~/.pi/agent/auth.json)
 *   → OpenAiClient.make({ apiKey }) / AnthropicClient.make({ apiKey })
 *     → LanguageModel (unified @effect/ai interface)
 *       → Your Effect programs
 * ```
 */

// Auth
export {
  AuthError,
  PiAuthBridge,
  PiAuthBridgeFrom,
  PiAuthBridgeLive,
  ProviderInfo,
  ProviderStatus,
} from './auth'
export type { PiAuthBridgeShape } from './auth'

// Providers
export {
  ANTHROPIC_PROVIDER_ID,
  ClaudeHaiku35Layer,
  ClaudeOpus4Layer,
  ClaudeSonnet4Layer,
  getProvider,
  getProviderLayer,
  listProviders,
  makeAnthropicLayer,
  makeAnthropicLayerFromEnv,
  makeOpenAiLayer,
  makeOpenAiLayerFromEnv,
  OpenAiMiniLayerEnv,
  OPENAI_PROVIDER_ID,
} from './providers'
export type { ProviderId, ProviderEntry } from './providers'

// Atoms
export { agentAuthRuntime, availableProvidersAtom, hasAuthAtom } from './atoms'
