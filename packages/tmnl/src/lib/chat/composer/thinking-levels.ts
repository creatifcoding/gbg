/**
 * Model-Aware Thinking Levels
 *
 * Derives available thinking levels from the selected model's provider
 * and reasoning capability. Replaces the static DEFAULT_THINKING_LEVELS
 * with levels that reflect actual provider behavior:
 *
 *   - Anthropic (adaptive): effort levels, token budgets per level
 *   - OpenAI (reasoning_effort): effort string, no token budgets
 *   - Google: thinking toggle, no granular levels
 *   - Non-reasoning models: thinking button hidden entirely
 *
 * pi-ai SDK translation chain:
 *   ThinkingLevel → SimpleStreamOptions.reasoning → provider.streamSimple()
 *   - Anthropic: adaptive thinking (effort) or budget-based (thinkingBudgetTokens)
 *   - OpenAI: params.reasoning.effort
 *   - Google: thinkingConfig.thinkingBudget
 *
 * @module chat/composer/thinking-levels
 */

import type { ThinkingLevel, ThinkingLevelOption } from './types'

// =============================================================================
// Provider Families
// =============================================================================

/** Providers that use Anthropic's adaptive/budget thinking */
const ANTHROPIC_FAMILY = new Set([
  'anthropic',
  'amazon-bedrock', // Bedrock Converse wraps Anthropic models
])

/** Providers that use OpenAI's reasoning_effort */
const OPENAI_FAMILY = new Set([
  'openai',
  'azure-openai-responses',
  'openai-codex',
  'github-copilot',
  'xai',
  'groq',
  'cerebras',
  'openrouter', // routes to various, but reasoning_effort is the param
])

/** Providers that use Google's thinking config */
const GOOGLE_FAMILY = new Set([
  'google',
  'google-gemini-cli',
  'google-antigravity',
  'google-vertex',
])

// =============================================================================
// Token Budget Descriptions
//
// These match pi-ai's adjustMaxTokensForThinking defaults:
//   minimal: 1024, low: 2048, medium: 8192, high: 16384
// =============================================================================

function anthropicDescription(level: ThinkingLevel): string {
  switch (level) {
    case 'none': return 'No extended thinking'
    case 'low': return '~2k budget · minimal reasoning'
    case 'medium': return '~8k budget · moderate reasoning'
    case 'high': return '~16k budget · deep reasoning'
  }
}

function openaiDescription(level: ThinkingLevel): string {
  switch (level) {
    case 'none': return 'No reasoning'
    case 'low': return 'Low effort · fast responses'
    case 'medium': return 'Medium effort · balanced'
    case 'high': return 'High effort · thorough reasoning'
  }
}

function googleDescription(level: ThinkingLevel): string {
  switch (level) {
    case 'none': return 'No thinking'
    case 'low': return 'Brief thinking'
    case 'medium': return 'Moderate thinking'
    case 'high': return 'Extended thinking'
  }
}

function genericDescription(level: ThinkingLevel): string {
  switch (level) {
    case 'none': return 'Disabled'
    case 'low': return 'Light reasoning'
    case 'medium': return 'Moderate reasoning'
    case 'high': return 'Deep reasoning'
  }
}

// =============================================================================
// Token Estimate Labels
// =============================================================================

function anthropicTokens(level: ThinkingLevel): string {
  switch (level) {
    case 'none': return '0'
    case 'low': return '~2k'
    case 'medium': return '~8k'
    case 'high': return '~16k'
  }
}

function openaiTokens(level: ThinkingLevel): string {
  // OpenAI reasoning_effort doesn't use explicit token budgets
  switch (level) {
    case 'none': return '—'
    case 'low': return 'low'
    case 'medium': return 'med'
    case 'high': return 'high'
  }
}

function googleTokens(level: ThinkingLevel): string {
  switch (level) {
    case 'none': return '0'
    case 'low': return '~2k'
    case 'medium': return '~8k'
    case 'high': return '~16k'
  }
}

function genericTokens(level: ThinkingLevel): string {
  switch (level) {
    case 'none': return '0'
    case 'low': return '~2k'
    case 'medium': return '~8k'
    case 'high': return '~16k'
  }
}

// =============================================================================
// Shared Animation Presets (preserved from DEFAULT_THINKING_LEVELS)
// =============================================================================

import type { ThinkingAnimationPreset } from './types'
import type { Easing } from 'motion/react'

const ANIM_NONE: ThinkingAnimationPreset = {
  scale: { pressed: 0.98, final: 1 },
  shadow: { layers: [] },
  duration: { press: 50, release: 100 },
  easing: 'easeOut' as Easing,
}

const ANIM_LOW: ThinkingAnimationPreset = {
  scale: { pressed: 0.92, final: 1 },
  shadow: {
    layers: [
      { color: '255, 255, 255', opacity: 0.4, blur: 6 },
      { color: '255, 255, 255', opacity: 0.2, blur: 12 },
    ],
  },
  duration: { press: 80, release: 150 },
  easing: [0.4, 0, 0.2, 1] as Easing,
}

const ANIM_MEDIUM: ThinkingAnimationPreset = {
  scale: { pressed: 0.88, overshoot: 1.04, final: 1 },
  shadow: {
    layers: [
      { color: '255, 255, 255', opacity: 0.5, blur: 4 },
      { color: '255, 255, 255', opacity: 0.35, blur: 10 },
      { color: '255, 255, 255', opacity: 0.2, blur: 20 },
    ],
  },
  duration: { press: 80, release: 250 },
  pulse: { scale: 1.8, opacity: 0.4, duration: 300, color: '255, 255, 255' },
  easing: [0.34, 1.56, 0.64, 1] as Easing,
}

const ANIM_HIGH: ThinkingAnimationPreset = {
  scale: { pressed: 0.82, overshoot: 1.08, final: 1 },
  shadow: {
    layers: [
      { color: '255, 255, 255', opacity: 0.6, blur: 3 },
      { color: '255, 255, 255', opacity: 0.45, blur: 8 },
      { color: '255, 255, 255', opacity: 0.3, blur: 16 },
      { color: '255, 255, 255', opacity: 0.15, blur: 28 },
    ],
  },
  duration: { press: 80, release: 350 },
  pulse: { scale: 2.2, opacity: 0.6, duration: 400, color: '255, 255, 255' },
  easing: [0.34, 1.8, 0.64, 1] as Easing,
}

// =============================================================================
// Core Derivation
// =============================================================================

type ProviderFamily = 'anthropic' | 'openai' | 'google' | 'generic'

function classifyProvider(provider: string): ProviderFamily {
  if (ANTHROPIC_FAMILY.has(provider)) return 'anthropic'
  if (OPENAI_FAMILY.has(provider)) return 'openai'
  if (GOOGLE_FAMILY.has(provider)) return 'google'
  return 'generic'
}

function getDescription(family: ProviderFamily, level: ThinkingLevel): string {
  switch (family) {
    case 'anthropic': return anthropicDescription(level)
    case 'openai': return openaiDescription(level)
    case 'google': return googleDescription(level)
    case 'generic': return genericDescription(level)
  }
}

function getTokens(family: ProviderFamily, level: ThinkingLevel): string {
  switch (family) {
    case 'anthropic': return anthropicTokens(level)
    case 'openai': return openaiTokens(level)
    case 'google': return googleTokens(level)
    case 'generic': return genericTokens(level)
  }
}

/**
 * Derive thinking levels from the selected model's provider and reasoning support.
 *
 * Returns `null` when the model doesn't support reasoning — the thinking
 * button should be hidden entirely.
 */
export function deriveThinkingLevels(
  provider: string | undefined,
  reasoning: boolean | undefined,
): ThinkingLevelOption[] | null {
  // No reasoning support → hide thinking entirely
  if (reasoning === false || !provider) return null

  const family = classifyProvider(provider)
  const levels: ThinkingLevel[] = ['none', 'low', 'medium', 'high']
  const animations = [ANIM_NONE, ANIM_LOW, ANIM_MEDIUM, ANIM_HIGH]

  return levels.map((level, i) => ({
    id: level,
    name: level === 'none' ? 'Off' : level.charAt(0).toUpperCase() + level.slice(1),
    tokens: getTokens(family, level),
    description: getDescription(family, level),
    animation: animations[i],
  }))
}

/**
 * Check if a ThinkingLevel should be reset when the model changes.
 * If the new model doesn't support reasoning, returns 'none'.
 * Otherwise preserves the current level.
 */
export function reconcileThinkingLevel(
  currentLevel: ThinkingLevel,
  reasoning: boolean | undefined,
): ThinkingLevel {
  if (reasoning === false) return 'none'
  return currentLevel
}
