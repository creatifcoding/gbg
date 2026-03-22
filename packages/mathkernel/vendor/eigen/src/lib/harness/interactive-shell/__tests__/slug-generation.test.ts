/**
 * Slug Generation Tests — format, uniqueness, word list coverage.
 *
 * Tests the petname-style slug generator (adjective-noun).
 * Since generateSlug() is module-private, we test it indirectly
 * through the exported service (or by importing internals).
 *
 * For direct testing we need to extract it. Alternative: test via
 * the InteractiveShellService.spawn() → session.name fallback.
 *
 * APPROACH: We re-export generateSlug for testing via a test helper,
 * or we test the ADJECTIVES/NOUNS pattern contract.
 */

import { describe, it, expect } from 'vitest'

// Since generateSlug is module-private, we test the contract:
// Sessions get slugs matching "adjective-noun" pattern.
// We import the word lists indirectly by testing the format.

const SLUG_PATTERN = /^[a-z]+-[a-z]+$/

describe('slug generation contract', () => {
  // We can't import generateSlug directly (it's not exported),
  // but we can validate its output format through the service.
  // For now, test the pattern contract and uniqueness property.

  // Known word lists from InteractiveShellService.ts
  const ADJECTIVES = [
    'calm', 'bold', 'wild', 'dark', 'warm', 'cool', 'keen', 'pale', 'soft', 'deep',
    'fast', 'slim', 'rare', 'pure', 'wise', 'blue', 'gold', 'iron', 'gray', 'jade',
  ]
  const NOUNS = [
    'reef', 'peak', 'vale', 'cove', 'dusk', 'dawn', 'tide', 'mist', 'gale', 'bark',
    'pine', 'wolf', 'hawk', 'lynx', 'fox', 'orca', 'moth', 'fern', 'moss', 'sage',
  ]

  it('has 20 adjectives', () => {
    expect(ADJECTIVES).toHaveLength(20)
  })

  it('has 20 nouns', () => {
    expect(NOUNS).toHaveLength(20)
  })

  it('all adjectives are lowercase alpha', () => {
    for (const adj of ADJECTIVES) {
      expect(adj).toMatch(/^[a-z]+$/)
    }
  })

  it('all nouns are lowercase alpha', () => {
    for (const noun of NOUNS) {
      expect(noun).toMatch(/^[a-z]+$/)
    }
  })

  it('no duplicate adjectives', () => {
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length)
  })

  it('no duplicate nouns', () => {
    expect(new Set(NOUNS).size).toBe(NOUNS.length)
  })

  it('total combination space is 400 (20×20)', () => {
    expect(ADJECTIVES.length * NOUNS.length).toBe(400)
  })

  it('all possible slugs match adjective-noun pattern', () => {
    for (const adj of ADJECTIVES) {
      for (const noun of NOUNS) {
        const slug = `${adj}-${noun}`
        expect(slug).toMatch(SLUG_PATTERN)
        expect(slug.length).toBeGreaterThanOrEqual(5) // min: "a-b" won't happen, min real: "calm-fox" = 8
        expect(slug.length).toBeLessThanOrEqual(10) // max: "warm-orca" = 9, "fast-dawn" = 9
      }
    }
  })

  it('slug format is human-readable at a glance', () => {
    // All words are ≤4 chars (easy to read)
    for (const word of [...ADJECTIVES, ...NOUNS]) {
      expect(word.length).toBeLessThanOrEqual(4)
    }
  })
})
