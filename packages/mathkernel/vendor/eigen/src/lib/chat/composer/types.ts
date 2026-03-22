/**
 * Composer Types
 *
 * Domain types for the TMNL chat composer.
 * Forked from chat-shell/ChatInput — stripped of brutalist concerns.
 */

import type { Easing } from 'motion/react'

// =============================================================================
// Core Domain
// =============================================================================

export type ChatMode = 'terminal' | 'ai'
export type ThinkingLevel = 'none' | 'low' | 'medium' | 'high'

export interface ContextChip {
  id: string
  label: string
  type: 'hashtag' | 'context' | 'pending'
  enabled?: boolean
}

export interface ComposerSubmitParams {
  value: string
  mode: ChatMode
  thinkingLevel: ThinkingLevel
  contextChips: ContextChip[]
}

// =============================================================================
// Animation Presets
// =============================================================================

export interface ShadowLayer {
  color: string
  opacity: number
  blur: number
  offsetX?: number
  offsetY?: number
}

export interface ThinkingAnimationPreset {
  scale: {
    pressed: number
    overshoot?: number
    final: number
  }
  shadow: {
    layers: ShadowLayer[]
  }
  duration: {
    press: number
    release: number
  }
  pulse?: {
    scale: number
    opacity: number
    duration: number
    color: string
  }
  easing: Easing
}

export interface ThinkingLevelOption {
  id: ThinkingLevel
  name: string
  tokens: string
  /** Provider-specific description of what this level does */
  description?: string
  animation: ThinkingAnimationPreset
}

// =============================================================================
// Default Thinking Levels
// =============================================================================

export const DEFAULT_THINKING_LEVELS: ThinkingLevelOption[] = [
  {
    id: 'none',
    name: 'Off',
    tokens: '0',
    animation: {
      scale: { pressed: 0.98, final: 1 },
      shadow: { layers: [] },
      duration: { press: 50, release: 100 },
      easing: 'easeOut',
    },
  },
  {
    id: 'low',
    name: 'Low',
    tokens: '~5k',
    animation: {
      scale: { pressed: 0.92, final: 1 },
      shadow: {
        layers: [
          { color: '255, 255, 255', opacity: 0.4, blur: 6 },
          { color: '255, 255, 255', opacity: 0.2, blur: 12 },
        ],
      },
      duration: { press: 80, release: 150 },
      easing: [0.4, 0, 0.2, 1],
    },
  },
  {
    id: 'medium',
    name: 'Medium',
    tokens: '~20k',
    animation: {
      scale: { pressed: 0.88, overshoot: 1.04, final: 1 },
      shadow: {
        layers: [
          { color: '255, 255, 255', opacity: 0.5, blur: 4 },
          { color: '255, 255, 255', opacity: 0.35, blur: 10 },
          { color: '255, 255, 255', opacity: 0.2, blur: 20 },
        ],
      },
      duration: { press: 80, release: 250 },
      pulse: {
        scale: 1.8,
        opacity: 0.4,
        duration: 300,
        color: '255, 255, 255',
      },
      easing: [0.34, 1.56, 0.64, 1],
    },
  },
  {
    id: 'high',
    name: 'High',
    tokens: '~50k',
    animation: {
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
      pulse: {
        scale: 2.2,
        opacity: 0.6,
        duration: 400,
        color: '255, 255, 255',
      },
      easing: [0.34, 1.8, 0.64, 1],
    },
  },
]
