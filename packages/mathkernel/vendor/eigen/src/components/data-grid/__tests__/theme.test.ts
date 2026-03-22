/**
 * Theme Composer Transformation Tests
 *
 * Tests for TMNL_TOKENS, createScaleHelpers, and theme param generation.
 * @module data-grid/__tests__/theme
 */

import { describe, test, expect } from 'bun:test'
import { TMNL_TOKENS, STATUS_COLORS, tmnlDataGridTheme } from '../theme'
import { clampScale, createScaleHelpers } from '../DataGridContext'

// =============================================================================
// TMNL_TOKENS Tests
// =============================================================================

describe('TMNL_TOKENS', () => {
  describe('colors', () => {
    test('has required color keys', () => {
      const requiredKeys = [
        'background',
        'border',
        'text',
        'textMuted',
        'accent',
        'statusActive',
        'statusPending',
        'statusInactive',
      ]

      for (const key of requiredKeys) {
        expect(TMNL_TOKENS.colors).toHaveProperty(key)
      }
    })

    test('all colors are valid hex or named colors', () => {
      const hexPattern = /^#[0-9A-Fa-f]{6}$/

      for (const [key, value] of Object.entries(TMNL_TOKENS.colors)) {
        expect(hexPattern.test(value)).toBe(true)
      }
    })

    test('background is pure black', () => {
      expect(TMNL_TOKENS.colors.background).toBe('#000000')
    })

    test('accent is white for TMNL aesthetic', () => {
      expect(TMNL_TOKENS.colors.accent).toBe('#ffffff')
    })
  })

  describe('typography', () => {
    test('has required typography keys', () => {
      expect(TMNL_TOKENS.typography).toHaveProperty('fontFamily')
      expect(TMNL_TOKENS.typography).toHaveProperty('fontSize')
      expect(TMNL_TOKENS.typography).toHaveProperty('fontSizeXs')
      expect(TMNL_TOKENS.typography).toHaveProperty('fontSizeSm')
      expect(TMNL_TOKENS.typography).toHaveProperty('fontSizeLg')
    })

    test('fontFamily is monospace', () => {
      expect(TMNL_TOKENS.typography.fontFamily).toContain('monospace')
    })

    test('fontSizeXs is minimum 12px (typography floor)', () => {
      expect(TMNL_TOKENS.typography.fontSizeXs).toBeGreaterThanOrEqual(12)
    })

    test('fontSizeSm is at least 12px (typography floor)', () => {
      expect(TMNL_TOKENS.typography.fontSizeSm).toBeGreaterThanOrEqual(12)
    })

    test('fontSize hierarchy is monotonic', () => {
      expect(TMNL_TOKENS.typography.fontSizeXs).toBeLessThanOrEqual(
        TMNL_TOKENS.typography.fontSizeSm
      )
      expect(TMNL_TOKENS.typography.fontSizeSm).toBeLessThanOrEqual(
        TMNL_TOKENS.typography.fontSize
      )
      expect(TMNL_TOKENS.typography.fontSize).toBeLessThanOrEqual(
        TMNL_TOKENS.typography.fontSizeLg
      )
    })
  })

  describe('spacing', () => {
    test('has required spacing keys', () => {
      expect(TMNL_TOKENS.spacing).toHaveProperty('rowHeight')
      expect(TMNL_TOKENS.spacing).toHaveProperty('headerHeight')
      expect(TMNL_TOKENS.spacing).toHaveProperty('cellPadding')
    })

    test('rowHeight is positive', () => {
      expect(TMNL_TOKENS.spacing.rowHeight).toBeGreaterThan(0)
    })

    test('headerHeight is positive', () => {
      expect(TMNL_TOKENS.spacing.headerHeight).toBeGreaterThan(0)
    })
  })
})

// =============================================================================
// STATUS_COLORS Tests
// =============================================================================

describe('STATUS_COLORS', () => {
  test('has all status keys', () => {
    expect(STATUS_COLORS).toHaveProperty('active')
    expect(STATUS_COLORS).toHaveProperty('pending')
    expect(STATUS_COLORS).toHaveProperty('inactive')
    expect(STATUS_COLORS).toHaveProperty('default')
  })

  test('active maps to statusActive token', () => {
    expect(STATUS_COLORS.active).toBe(TMNL_TOKENS.colors.statusActive)
  })

  test('pending maps to statusPending token', () => {
    expect(STATUS_COLORS.pending).toBe(TMNL_TOKENS.colors.statusPending)
  })

  test('inactive maps to statusInactive token', () => {
    expect(STATUS_COLORS.inactive).toBe(TMNL_TOKENS.colors.statusInactive)
  })

  test('default maps to textMuted token', () => {
    expect(STATUS_COLORS.default).toBe(TMNL_TOKENS.colors.textMuted)
  })
})

// =============================================================================
// clampScale Tests
// =============================================================================

describe('clampScale', () => {
  test('returns identity for values in range [0.5, 2.0]', () => {
    expect(clampScale(1.0)).toBe(1.0)
    expect(clampScale(0.5)).toBe(0.5)
    expect(clampScale(2.0)).toBe(2.0)
    expect(clampScale(1.5)).toBe(1.5)
  })

  test('clamps values below minimum to 0.5', () => {
    expect(clampScale(0)).toBe(0.5)
    expect(clampScale(-1)).toBe(0.5)
    expect(clampScale(0.1)).toBe(0.5)
    expect(clampScale(0.49)).toBe(0.5)
  })

  test('clamps values above maximum to 2.0', () => {
    expect(clampScale(3)).toBe(2.0)
    expect(clampScale(100)).toBe(2.0)
    expect(clampScale(2.1)).toBe(2.0)
  })
})

// =============================================================================
// createScaleHelpers Tests
// =============================================================================

describe('createScaleHelpers', () => {
  describe('at scaleFactor=1.0 (identity)', () => {
    const helpers = createScaleHelpers(1.0)

    test('scaled returns input unchanged', () => {
      expect(helpers.scaled(12)).toBe(12)
      expect(helpers.scaled(16)).toBe(16)
      expect(helpers.scaled(100)).toBe(100)
    })

    test('scaledPx returns input with px suffix', () => {
      expect(helpers.scaledPx(12)).toBe('12px')
      expect(helpers.scaledPx(16)).toBe('16px')
    })

    test('scaleFactor returns 1.0', () => {
      expect(helpers.scaleFactor).toBe(1.0)
    })
  })

  describe('at scaleFactor=0.5 (minimum)', () => {
    const helpers = createScaleHelpers(0.5)

    test('scaled halves the input', () => {
      expect(helpers.scaled(12)).toBe(6)
      expect(helpers.scaled(16)).toBe(8)
      expect(helpers.scaled(100)).toBe(50)
    })

    test('scaledPx returns halved value with px suffix', () => {
      expect(helpers.scaledPx(12)).toBe('6px')
      expect(helpers.scaledPx(100)).toBe('50px')
    })

    test('scaleFactor returns 0.5', () => {
      expect(helpers.scaleFactor).toBe(0.5)
    })
  })

  describe('at scaleFactor=2.0 (maximum)', () => {
    const helpers = createScaleHelpers(2.0)

    test('scaled doubles the input', () => {
      expect(helpers.scaled(12)).toBe(24)
      expect(helpers.scaled(16)).toBe(32)
      expect(helpers.scaled(100)).toBe(200)
    })

    test('scaledPx returns doubled value with px suffix', () => {
      expect(helpers.scaledPx(12)).toBe('24px')
      expect(helpers.scaledPx(100)).toBe('200px')
    })

    test('scaleFactor returns 2.0', () => {
      expect(helpers.scaleFactor).toBe(2.0)
    })
  })

  describe('at out-of-bounds scaleFactor', () => {
    test('clamps below-minimum to 0.5', () => {
      const helpers = createScaleHelpers(0.1)
      expect(helpers.scaleFactor).toBe(0.5)
      expect(helpers.scaled(20)).toBe(10)
    })

    test('clamps above-maximum to 2.0', () => {
      const helpers = createScaleHelpers(5.0)
      expect(helpers.scaleFactor).toBe(2.0)
      expect(helpers.scaled(20)).toBe(40)
    })
  })

  describe('rounding behavior', () => {
    const helpers = createScaleHelpers(1.333)

    test('rounds to nearest integer', () => {
      // 12 * 1.333 = 15.996 → 16
      expect(helpers.scaled(12)).toBe(16)
      // 10 * 1.333 = 13.33 → 13
      expect(helpers.scaled(10)).toBe(13)
    })
  })
})

// =============================================================================
// tmnlDataGridTheme Tests
// =============================================================================

describe('tmnlDataGridTheme', () => {
  test('is defined', () => {
    expect(tmnlDataGridTheme).toBeDefined()
  })

  // AG-Grid theme is opaque, but we can verify it doesn't throw on creation
  test('theme object has expected structure (themeQuartz base)', () => {
    // Theme should be chainable (themeQuartz.withParams returns a theme)
    expect(typeof tmnlDataGridTheme).toBe('object')
  })
})
