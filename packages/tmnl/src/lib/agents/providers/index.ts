/**
 * Provider Registry — select LanguageModel layer by provider ID.
 *
 * Maps provider identifiers to their @effect/ai LanguageModel layer factories.
 * OAuth-based layers require PiAuthBridge in their dependency graph.
 * Env-based layers use OPENAI_API_KEY / ANTHROPIC_API_KEY directly.
 */
import type { LanguageModel } from '@effect/ai'
import type { Layer } from 'effect'

import type { PiAuthBridge } from '../auth/PiAuthBridge'
import {
  ANTHROPIC_PROVIDER_ID,
  ClaudeHaiku35Layer,
  ClaudeOpus4Layer,
  ClaudeSonnet4Layer,
  makeAnthropicLayer,
  makeAnthropicLayerFromEnv,
} from './anthropic'
import {
  makeOpenAiCodexLayer,
  makeOpenAiLayer,
  makeOpenAiLayerFromEnv,
  OpenAiMiniLayerEnv,
  OPENAI_PROVIDER_ID,
} from './openai'

// ── Provider type ──

export type ProviderId = 'openai-codex' | 'anthropic'

export interface ProviderEntry {
  readonly id: ProviderId
  readonly name: string
  readonly defaultModel: string
  readonly makeLayer: (modelId?: string) => Layer.Layer<LanguageModel.LanguageModel, any, typeof PiAuthBridge>
}

// ── Registry ──

const PROVIDERS: Record<ProviderId, ProviderEntry> = {
  'openai-codex': {
    id: 'openai-codex',
    name: 'OpenAI (Codex via ChatGPT)',
    defaultModel: 'gpt-5.2',
    makeLayer: (modelId) => makeOpenAiCodexLayer(modelId ?? 'gpt-5.2') as any,
  },
  'anthropic': {
    id: 'anthropic',
    name: 'Anthropic (Claude Pro/Max)',
    defaultModel: 'claude-sonnet-4-20250514',
    makeLayer: (modelId) => makeAnthropicLayer(modelId ?? 'claude-sonnet-4-20250514') as any,
  },
}

/**
 * Get a provider entry by ID.
 */
export const getProvider = (id: ProviderId): ProviderEntry | undefined =>
  PROVIDERS[id]

/**
 * Get a LanguageModel layer for a specific provider and model.
 * Falls back to the provider's default model if modelId is omitted.
 * Requires PiAuthBridge in context.
 */
export const getProviderLayer = (
  providerId: ProviderId,
  modelId?: string,
): Layer.Layer<LanguageModel.LanguageModel, any, typeof PiAuthBridge> => {
  const provider = PROVIDERS[providerId]
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`)
  }
  return provider.makeLayer(modelId ?? provider.defaultModel)
}

/**
 * List all available providers.
 */
export const listProviders = (): ReadonlyArray<ProviderEntry> =>
  Object.values(PROVIDERS)

// ── Re-exports ──

export {
  makeOpenAiCodexLayer,
  makeOpenAiLayer,
  makeOpenAiLayerFromEnv,
  OpenAiMiniLayerEnv,
  OPENAI_PROVIDER_ID,
} from './openai'
export {
  makeAnthropicLayer,
  makeAnthropicLayerFromEnv,
  ClaudeSonnet4Layer,
  ClaudeHaiku35Layer,
  ClaudeOpus4Layer,
  ANTHROPIC_PROVIDER_ID,
} from './anthropic'
