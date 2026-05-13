/**
 * Token derivation function tests.
 */
import { describe, it, expect } from 'vitest'
import {
  ACCENT, SEMANTIC, ALPHA,
  borderTint, bgTint, separatorColor, actionBorderColor,
  badgeBgColor, badgeBorderColor,
} from '../tokens'

describe('tokens', () => {
  describe('ACCENT palette', () => {
    it('has all 12 category accent colors', () => {
      const keys = Object.keys(ACCENT)
      expect(keys).toHaveLength(12)
      expect(keys).toContain('stream')
      expect(keys).toContain('network')
      expect(keys).toContain('session')
      expect(keys).toContain('sessionCrud')
      expect(keys).toContain('tool')
      expect(keys).toContain('model')
      expect(keys).toContain('timeout')
      expect(keys).toContain('compaction')
      expect(keys).toContain('defect')
      expect(keys).toContain('adapterDefect')
      expect(keys).toContain('storeDefect')
      expect(keys).toContain('interruption')
    })

    it('all values are valid hex colors', () => {
      for (const [key, val] of Object.entries(ACCENT)) {
        expect(val, `ACCENT.${key}`).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })
  })

  describe('SEMANTIC colors', () => {
    it('has positive, muted, label, secondary, value', () => {
      expect(SEMANTIC.positive).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(SEMANTIC.muted).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(SEMANTIC.label).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(SEMANTIC.secondary).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(SEMANTIC.value).toMatch(/^#[0-9a-fA-F]{6}$/)
    })
  })

  describe('borderTint()', () => {
    it('converts hex to rgba with default alpha', () => {
      const result = borderTint('#f87171')
      expect(result).toBe(`rgba(248,113,113,${ALPHA.border})`)
    })

    it('accepts custom alpha', () => {
      const result = borderTint('#ef4444', 0.3)
      expect(result).toBe('rgba(239,68,68,0.3)')
    })
  })

  describe('bgTint()', () => {
    it('returns rgba with bgOpacity', () => {
      const result = bgTint('red')
      expect(result).toContain('rgba(10,3,3')
      expect(result).toContain(`${ALPHA.bgOpacity}`)
    })

    it('handles all hue keys', () => {
      const hues = ['red', 'orange', 'amber', 'neutral', 'indigo', 'purple', 'dark', 'slate'] as const
      for (const hue of hues) {
        const result = bgTint(hue)
        expect(result, `bgTint('${hue}')`).toMatch(/^rgba\(\d+,\d+,\d+,[\d.]+\)$/)
      }
    })
  })

  describe('separatorColor()', () => {
    it('uses ALPHA.separator', () => {
      const result = separatorColor('#818cf8')
      expect(result).toBe(`rgba(129,140,248,${ALPHA.separator})`)
    })
  })

  describe('actionBorderColor()', () => {
    it('uses ALPHA.actionBorder', () => {
      const result = actionBorderColor('#c084fc')
      expect(result).toBe(`rgba(192,132,252,${ALPHA.actionBorder})`)
    })
  })

  describe('badgeBgColor()', () => {
    it('appends alpha hex to accent', () => {
      const result = badgeBgColor('#f87171')
      // 0.12 * 255 = 30.6 → 31 → '1f'
      expect(result).toBe('#f871711f')
    })
  })

  describe('badgeBorderColor()', () => {
    it('appends alpha hex to accent', () => {
      const result = badgeBorderColor('#f87171')
      // 0.2 * 255 = 51 → '33'
      expect(result).toBe('#f8717133')
    })
  })
})
