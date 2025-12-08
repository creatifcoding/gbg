/**
 * Timing Utility Test Suite
 *
 * Tests for high-resolution timing with Tauri/browser fallback.
 * Uses hypothesis-driven testing pattern.
 *
 * @module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

describe('Timing Utility', () => {
  beforeEach(() => {
    // Reset modules to clear cached state
    vi.resetModules()
    // Clear __TAURI_INTERNALS__ before each test
    delete (window as any).__TAURI_INTERNALS__
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ===========================================================================
  // ENVIRONMENT DETECTION
  // ===========================================================================

  describe('Environment Detection', () => {
    /**
     * H1: isTauri() returns true when __TAURI_INTERNALS__ exists
     */
    it('detects Tauri environment via __TAURI_INTERNALS__', async () => {
      // Arrange
      ;(window as any).__TAURI_INTERNALS__ = {}

      // Act
      const { isTauri } = await import('../playground/timing')

      // Assert
      expect(isTauri()).toBe(true)
    })

    /**
     * H2: isTauri() returns false when __TAURI_INTERNALS__ is absent
     */
    it('returns false when not in Tauri', async () => {
      // Arrange: No __TAURI_INTERNALS__

      // Act
      const { isTauri } = await import('../playground/timing')

      // Assert
      expect(isTauri()).toBe(false)
    })
  })

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  describe('initTiming()', () => {
    /**
     * H3: Initializes with high-res timing when in Tauri
     */
    it('enables high-res timing when in Tauri', async () => {
      // Arrange
      ;(window as any).__TAURI_INTERNALS__ = {}
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(12345)

      // Act
      const {
        initTiming,
        isHighResolution,
        _resetForTesting,
      } = await import('../playground/timing')
      _resetForTesting()
      await initTiming()

      // Assert
      expect(isHighResolution()).toBe(true)
    })

    /**
     * H4: Falls back to performance.now() when not in Tauri
     */
    it('uses performance.now() fallback when not in Tauri', async () => {
      // Arrange: No __TAURI_INTERNALS__

      // Act
      const {
        initTiming,
        isHighResolution,
        _resetForTesting,
      } = await import('../playground/timing')
      _resetForTesting()
      await initTiming()

      // Assert
      expect(isHighResolution()).toBe(false)
    })

    /**
     * H5: Idempotent - multiple calls don't reinitialize
     */
    it('is idempotent', async () => {
      // Arrange
      ;(window as any).__TAURI_INTERNALS__ = {}
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(1000)

      // Act
      const {
        initTiming,
        isInitialized,
        _resetForTesting,
      } = await import('../playground/timing')
      _resetForTesting()

      expect(isInitialized()).toBe(false)
      await initTiming()
      expect(isInitialized()).toBe(true)
      await initTiming() // Second call
      await initTiming() // Third call
      expect(isInitialized()).toBe(true)
    })

    /**
     * H6: Handles Tauri import failure gracefully
     *
     * Note: The actual try/catch behavior is tested implicitly -
     * if the import fails in a real scenario, it falls back to performance.now().
     * We verify this by checking that nowMicros() works in fallback mode.
     */
    it('falls back gracefully when not in Tauri', async () => {
      // Arrange: No __TAURI_INTERNALS__ (simulates Tauri API not available)

      // Act
      const {
        initTiming,
        isHighResolution,
        nowMicros,
        _resetForTesting,
      } = await import('../playground/timing')
      _resetForTesting()

      // Should not throw
      await initTiming()

      // Assert
      expect(isHighResolution()).toBe(false)

      // Should still work with fallback
      const result = await nowMicros()
      expect(result).toBeGreaterThan(0)
    })
  })

  // ===========================================================================
  // nowMicros()
  // ===========================================================================

  describe('nowMicros()', () => {
    /**
     * H7: Returns monotonically increasing values
     */
    it('returns monotonically increasing values', async () => {
      // Arrange
      const {
        initTiming,
        nowMicros,
        _resetForTesting,
      } = await import('../playground/timing')
      _resetForTesting()
      await initTiming()

      // Act
      const t1 = await nowMicros()
      const t2 = await nowMicros()
      const t3 = await nowMicros()

      // Assert
      expect(t2).toBeGreaterThanOrEqual(t1)
      expect(t3).toBeGreaterThanOrEqual(t2)
    })

    /**
     * H8: Invokes Tauri command when in Tauri environment
     */
    it('invokes now_micros command in Tauri', async () => {
      // Arrange
      ;(window as any).__TAURI_INTERNALS__ = {}
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(42000)

      // Act
      const {
        initTiming,
        nowMicros,
        _resetForTesting,
      } = await import('../playground/timing')
      _resetForTesting()
      await initTiming()
      const result = await nowMicros()

      // Assert
      expect(invoke).toHaveBeenCalledWith('now_micros')
      expect(result).toBe(42000)
    })

    /**
     * H9: Returns reasonable values in fallback mode
     */
    it('returns reasonable values in fallback mode', async () => {
      // Arrange: No Tauri
      const {
        initTiming,
        nowMicros,
        _resetForTesting,
      } = await import('../playground/timing')
      _resetForTesting()
      await initTiming()

      // Act
      const before = performance.now() * 1000
      const result = await nowMicros()
      const after = performance.now() * 1000

      // Assert: Result should be between before and after
      expect(result).toBeGreaterThanOrEqual(before - 1000) // Allow 1ms tolerance
      expect(result).toBeLessThanOrEqual(after + 1000)
    })
  })

  // ===========================================================================
  // nowMicrosSync()
  // ===========================================================================

  describe('nowMicrosSync()', () => {
    /**
     * H10: Sync fallback always uses performance.now()
     */
    it('uses performance.now() regardless of environment', async () => {
      // Arrange: Even with Tauri present
      ;(window as any).__TAURI_INTERNALS__ = {}

      const { nowMicrosSync } = await import('../playground/timing')

      // Act
      const before = performance.now() * 1000
      const result = nowMicrosSync()
      const after = performance.now() * 1000

      // Assert
      expect(result).toBeGreaterThanOrEqual(before)
      expect(result).toBeLessThanOrEqual(after)
    })

    /**
     * H11: Returns monotonically increasing values
     */
    it('returns monotonically increasing values', async () => {
      const { nowMicrosSync } = await import('../playground/timing')

      const t1 = nowMicrosSync()
      const t2 = nowMicrosSync()
      const t3 = nowMicrosSync()

      expect(t2).toBeGreaterThanOrEqual(t1)
      expect(t3).toBeGreaterThanOrEqual(t2)
    })
  })

  // ===========================================================================
  // _resetForTesting()
  // ===========================================================================

  describe('_resetForTesting()', () => {
    /**
     * H12: Reset clears all cached state
     */
    it('resets all cached state', async () => {
      // Arrange
      ;(window as any).__TAURI_INTERNALS__ = {}
      const { invoke } = await import('@tauri-apps/api/core')
      vi.mocked(invoke).mockResolvedValue(1000)

      const {
        initTiming,
        isHighResolution,
        isInitialized,
        _resetForTesting,
      } = await import('../playground/timing')

      // Initialize first
      await initTiming()
      expect(isInitialized()).toBe(true)
      expect(isHighResolution()).toBe(true)

      // Act: Reset
      _resetForTesting()

      // Assert: State is cleared
      expect(isInitialized()).toBe(false)
      expect(isHighResolution()).toBe(false)
    })
  })
})
