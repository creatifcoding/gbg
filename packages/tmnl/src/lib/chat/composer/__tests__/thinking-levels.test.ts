import { describe, it, expect } from 'vitest'
import { deriveThinkingLevels, reconcileThinkingLevel } from '../thinking-levels'

describe('deriveThinkingLevels', () => {
  it('returns null for non-reasoning models', () => {
    expect(deriveThinkingLevels('openai', false)).toBeNull()
    expect(deriveThinkingLevels('anthropic', false)).toBeNull()
  })

  it('returns null when provider is undefined', () => {
    expect(deriveThinkingLevels(undefined, true)).toBeNull()
  })

  it('returns 4 levels for Anthropic reasoning models', () => {
    const levels = deriveThinkingLevels('anthropic', true)
    expect(levels).not.toBeNull()
    expect(levels!).toHaveLength(4)
    expect(levels!.map(l => l.id)).toEqual(['none', 'low', 'medium', 'high'])
  })

  it('shows token budgets for Anthropic', () => {
    const levels = deriveThinkingLevels('anthropic', true)!
    expect(levels[0].tokens).toBe('0')
    expect(levels[1].tokens).toBe('~2k')
    expect(levels[2].tokens).toBe('~8k')
    expect(levels[3].tokens).toBe('~16k')
  })

  it('shows effort labels for OpenAI', () => {
    const levels = deriveThinkingLevels('openai', true)!
    expect(levels[0].tokens).toBe('—')
    expect(levels[1].tokens).toBe('low')
    expect(levels[2].tokens).toBe('med')
    expect(levels[3].tokens).toBe('high')
  })

  it('classifies amazon-bedrock as anthropic family', () => {
    const levels = deriveThinkingLevels('amazon-bedrock', true)!
    expect(levels[2].description).toContain('budget')
  })

  it('classifies github-copilot as openai family', () => {
    const levels = deriveThinkingLevels('github-copilot', true)!
    expect(levels[2].description).toContain('effort')
  })

  it('classifies google as google family', () => {
    const levels = deriveThinkingLevels('google', true)!
    expect(levels[2].description).toContain('thinking')
  })

  it('classifies unknown providers as generic', () => {
    const levels = deriveThinkingLevels('some-custom-provider', true)!
    expect(levels).toHaveLength(4)
    expect(levels[2].description).toContain('reasoning')
  })

  it('includes descriptions on every level', () => {
    const levels = deriveThinkingLevels('anthropic', true)!
    for (const level of levels) {
      expect(level.description).toBeTruthy()
    }
  })

  it('includes animation presets on every level', () => {
    const levels = deriveThinkingLevels('openai', true)!
    for (const level of levels) {
      expect(level.animation).toBeDefined()
      expect(level.animation.scale).toBeDefined()
      expect(level.animation.duration).toBeDefined()
    }
  })
})

describe('reconcileThinkingLevel', () => {
  it('preserves current level when model supports reasoning', () => {
    expect(reconcileThinkingLevel('high', true)).toBe('high')
    expect(reconcileThinkingLevel('medium', true)).toBe('medium')
  })

  it('resets to none when model does not support reasoning', () => {
    expect(reconcileThinkingLevel('high', false)).toBe('none')
    expect(reconcileThinkingLevel('medium', false)).toBe('none')
  })

  it('preserves level when reasoning is undefined (unknown model)', () => {
    expect(reconcileThinkingLevel('high', undefined)).toBe('high')
  })
})
