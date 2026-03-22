/**
 * TMNL Agent Calling Module
 *
 * Specialized agent calling functionality that intercepts Pi's OAuth
 * infrastructure and bridges it into @effect/ai LanguageModel layers.
 *
 * ## Quick Start (OAuth → Codex)
 *
 * ```ts
 * import { LanguageModel } from '@effect/ai'
 * import { Effect, Stream } from 'effect'
 * import { PiAuthBridgeLive, makeOpenAiCodexLayer } from '@/lib/agents'
 *
 * const program = Effect.gen(function* () {
 *   const model = yield* LanguageModel.LanguageModel
 *   const stream = model.streamText({
 *     system: 'Be concise.',
 *     prompt: 'What is 2 + 2?',
 *   })
 *   let text = ''
 *   yield* Stream.runForEach(stream, (chunk) =>
 *     Effect.sync(() => {
 *       if ((chunk as any).type === 'text-delta') text += (chunk as any).delta
 *     })
 *   )
 *   return text
 * })
 *
 * // Layer: LanguageModel ← Codex middleware ← PiAuthBridge
 * const layer = makeOpenAiCodexLayer('gpt-5.2')
 *   .pipe(Layer.provide(PiAuthBridgeLive))
 * await Effect.runPromise(program.pipe(Effect.provide(layer)))
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
 *   → Codex HttpClient Middleware (headers, body transform, SSE normalization)
 *     → OpenAiClient → LanguageModel (unified @effect/ai interface)
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
  makeOpenAiCodexLayer,
  makeOpenAiLayer,
  makeOpenAiLayerFromEnv,
  OpenAiMiniLayerEnv,
  OPENAI_PROVIDER_ID,
} from './providers'
export type { ProviderId, ProviderEntry } from './providers'

// Agent Harness Config
export {
  AgentHarnessConfig,
  AgentHarnessConfigTag,
  AgentHarnessConfigDefault,
  AgentHarnessConfigFrom,
} from './AgentHarnessConfig'

// Atoms
export { agentAuthRuntime, availableProvidersAtom, hasAuthAtom } from './atoms'
