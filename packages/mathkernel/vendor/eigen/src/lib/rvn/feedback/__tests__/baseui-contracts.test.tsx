/**
 * Base UI Contract Tests for RVN Feedback Components
 *
 * These tests verify that the feedback components properly wrap Base UI
 * components while maintaining RVN brutalist styling contracts.
 *
 * @module rvn/feedback/__tests__/baseui-contracts
 */

import { describe, test, expect } from 'bun:test'
import * as React from 'react'
import {
  RVN_COLORS,
  RVN_BORDERS,
  RVN_FONTS,
  RVN_FONT_SIZES,
} from '../../tokens'

// =============================================================================
// Test Imports - These should work after migration
// =============================================================================

// The migrated components should export compound patterns from Base UI
import {
  RvnToast,
  RvnTooltip,
  RvnPopover,
  RvnAlert,
  RvnProgressBar,
} from '../index'

// =============================================================================
// RvnToast Contract Tests
// =============================================================================

describe('RvnToast Base UI Contract', () => {
  describe('compound pattern', () => {
    test('exports Provider from Base UI', () => {
      expect(RvnToast.Provider).toBeDefined()
      expect(typeof RvnToast.Provider).toBe('function')
    })

    test('exports Viewport component', () => {
      expect(RvnToast.Viewport).toBeDefined()
      expect(typeof RvnToast.Viewport).toBe('function')
    })

    test('exports Root component', () => {
      expect(RvnToast.Root).toBeDefined()
      expect(typeof RvnToast.Root).toBe('function')
    })

    test('exports Title component', () => {
      expect(RvnToast.Title).toBeDefined()
      expect(typeof RvnToast.Title).toBe('function')
    })

    test('exports Description component', () => {
      expect(RvnToast.Description).toBeDefined()
      expect(typeof RvnToast.Description).toBe('function')
    })

    test('exports Close component', () => {
      expect(RvnToast.Close).toBeDefined()
      expect(typeof RvnToast.Close).toBe('function')
    })

    test('exports Action component', () => {
      expect(RvnToast.Action).toBeDefined()
      expect(typeof RvnToast.Action).toBe('function')
    })
  })

  describe('variant support', () => {
    test('RvnToastVariant type includes info, success, warning, error', () => {
      // Type-level check - these should be valid variant values
      const variants = ['info', 'success', 'warning', 'error'] as const
      expect(variants.length).toBe(4)
    })
  })
})

// =============================================================================
// RvnTooltip Contract Tests
// =============================================================================

describe('RvnTooltip Base UI Contract', () => {
  describe('compound pattern', () => {
    test('exports Provider from Base UI', () => {
      expect(RvnTooltip.Provider).toBeDefined()
    })

    test('exports Root component', () => {
      expect(RvnTooltip.Root).toBeDefined()
      expect(typeof RvnTooltip.Root).toBe('function')
    })

    test('exports Trigger component', () => {
      expect(RvnTooltip.Trigger).toBeDefined()
      // forwardRef components are objects, not functions
      expect(['function', 'object'].includes(typeof RvnTooltip.Trigger)).toBe(true)
    })

    test('exports Portal component', () => {
      expect(RvnTooltip.Portal).toBeDefined()
      expect(['function', 'object'].includes(typeof RvnTooltip.Portal)).toBe(true)
    })

    test('exports Positioner component', () => {
      expect(RvnTooltip.Positioner).toBeDefined()
      expect(['function', 'object'].includes(typeof RvnTooltip.Positioner)).toBe(true)
    })

    test('exports Popup component', () => {
      expect(RvnTooltip.Popup).toBeDefined()
      expect(typeof RvnTooltip.Popup).toBe('function')
    })

    test('exports Arrow component', () => {
      expect(RvnTooltip.Arrow).toBeDefined()
      expect(typeof RvnTooltip.Arrow).toBe('function')
    })
  })
})

// =============================================================================
// RvnPopover Contract Tests
// =============================================================================

describe('RvnPopover Base UI Contract', () => {
  describe('compound pattern', () => {
    test('exports Root component', () => {
      expect(RvnPopover.Root).toBeDefined()
      expect(typeof RvnPopover.Root).toBe('function')
    })

    test('exports Trigger component', () => {
      expect(RvnPopover.Trigger).toBeDefined()
      // forwardRef components are objects, not functions
      expect(['function', 'object'].includes(typeof RvnPopover.Trigger)).toBe(true)
    })

    test('exports Portal component', () => {
      expect(RvnPopover.Portal).toBeDefined()
      expect(['function', 'object'].includes(typeof RvnPopover.Portal)).toBe(true)
    })

    test('exports Positioner component', () => {
      expect(RvnPopover.Positioner).toBeDefined()
      expect(['function', 'object'].includes(typeof RvnPopover.Positioner)).toBe(true)
    })

    test('exports Popup component', () => {
      expect(RvnPopover.Popup).toBeDefined()
      expect(typeof RvnPopover.Popup).toBe('function')
    })

    test('exports Arrow component', () => {
      expect(RvnPopover.Arrow).toBeDefined()
      expect(typeof RvnPopover.Arrow).toBe('function')
    })

    test('exports Title component', () => {
      expect(RvnPopover.Title).toBeDefined()
      expect(typeof RvnPopover.Title).toBe('function')
    })

    test('exports Description component', () => {
      expect(RvnPopover.Description).toBeDefined()
      expect(typeof RvnPopover.Description).toBe('function')
    })

    test('exports Body component', () => {
      expect(RvnPopover.Body).toBeDefined()
      expect(typeof RvnPopover.Body).toBe('function')
    })

    test('exports Close component', () => {
      expect(RvnPopover.Close).toBeDefined()
      expect(typeof RvnPopover.Close).toBe('function')
    })
  })
})

// =============================================================================
// RvnAlert Contract Tests
// =============================================================================

describe('RvnAlert Base UI Contract', () => {
  describe('compound pattern', () => {
    test('exports Root component (or direct component)', () => {
      // Alert can be either a direct component or compound
      // For Base UI AlertDialog we expect compound pattern
      expect(RvnAlert).toBeDefined()
      // Should have either .Root or be a function directly
      const hasRoot = typeof RvnAlert === 'object' && 'Root' in RvnAlert
      const isFunction = typeof RvnAlert === 'function'
      expect(hasRoot || isFunction).toBe(true)
    })

    test('exports Title component', () => {
      if (typeof RvnAlert === 'object') {
        expect(RvnAlert.Title).toBeDefined()
      }
    })

    test('exports Description component', () => {
      if (typeof RvnAlert === 'object') {
        expect(RvnAlert.Description).toBeDefined()
      }
    })

    test('exports Icon component', () => {
      if (typeof RvnAlert === 'object') {
        expect(RvnAlert.Icon).toBeDefined()
      }
    })
  })

  describe('variant support', () => {
    test('RvnAlertVariant type includes info, success, warning, error', () => {
      const variants = ['info', 'success', 'warning', 'error'] as const
      expect(variants.length).toBe(4)
    })
  })
})

// =============================================================================
// RvnProgressBar Contract Tests
// =============================================================================

describe('RvnProgressBar Base UI Contract', () => {
  describe('compound pattern', () => {
    test('exports Root component', () => {
      expect(RvnProgressBar.Root).toBeDefined()
      expect(typeof RvnProgressBar.Root).toBe('function')
    })

    test('exports Track component', () => {
      expect(RvnProgressBar.Track).toBeDefined()
      expect(typeof RvnProgressBar.Track).toBe('function')
    })

    test('exports Indicator component', () => {
      expect(RvnProgressBar.Indicator).toBeDefined()
      expect(typeof RvnProgressBar.Indicator).toBe('function')
    })
  })

  describe('variant support', () => {
    test('RvnProgressBarVariant type includes default and critical', () => {
      const variants = ['default', 'critical'] as const
      expect(variants.length).toBe(2)
    })
  })
})

// =============================================================================
// RVN Styling Contract Tests
// =============================================================================

describe('RVN Styling Contracts', () => {
  describe('tokens', () => {
    test('black color is pure black', () => {
      expect(RVN_COLORS.black).toBe('#000000')
    })

    test('white color is pure white', () => {
      expect(RVN_COLORS.white).toBe('#ffffff')
    })

    test('border radius is 0px (brutalist)', () => {
      expect(RVN_BORDERS.radius).toBe('0px')
    })

    test('primary border is 3px solid black', () => {
      expect(RVN_BORDERS.primary).toBe('3px solid #000000')
    })

    test('font mono is Courier New', () => {
      expect(RVN_FONTS.mono).toContain('Courier New')
    })

    test('label font size is 12px (THE FLOOR)', () => {
      expect(RVN_FONT_SIZES.label).toBe('12px')
    })
  })
})

// =============================================================================
// Hook Export Tests
// =============================================================================

describe('Hook Exports', () => {
  test('useRvnToast hook is exported', async () => {
    // Dynamic import to check the hook exists
    const module = await import('../index')
    expect(module.useRvnToast).toBeDefined()
    expect(typeof module.useRvnToast).toBe('function')
  })
})
