/**
 * High-Resolution Timing Utility
 *
 * Provides microsecond-resolution timing via Tauri IPC when available,
 * with graceful fallback to performance.now() * 1000 in browser.
 *
 * ## Usage
 *
 * ```typescript
 * import { initTiming, nowMicros, isHighResolution } from './timing'
 *
 * // Initialize once at startup
 * await initTiming()
 *
 * // Measure elapsed time
 * const start = await nowMicros()
 * // ... do work ...
 * const end = await nowMicros()
 * const elapsedMicros = end - start
 *
 * // Check if using high-res timing
 * console.log('High-res:', isHighResolution())
 * ```
 *
 * @module
 */

// =============================================================================
// TAURI DETECTION
// =============================================================================

/**
 * Detect if running inside Tauri webview.
 * Checks for __TAURI_INTERNALS__ which is injected by Tauri runtime.
 */
export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

// =============================================================================
// STANDALONE API (for hot path where Effect overhead is unacceptable)
// =============================================================================

/** Cached Tauri invoke function */
let cachedInvoke: ((cmd: string) => Promise<number>) | null = null

/** Whether we're using high-resolution Tauri timing */
let cachedIsHighRes = false

/** Whether initTiming has been called */
let initialized = false

/**
 * Initialize timing subsystem.
 *
 * Call once at app startup. Safe to call multiple times (idempotent).
 * Detects Tauri environment and caches the invoke function for performance.
 *
 * @returns Promise that resolves when initialization is complete
 */
export async function initTiming(): Promise<void> {
  if (initialized) return

  if (isTauri()) {
    try {
      // Dynamic import to avoid bundler issues when not in Tauri
      const { invoke } = await import('@tauri-apps/api/core')
      cachedInvoke = (cmd) => invoke<number>(cmd)
      cachedIsHighRes = true
      console.info('[Timing] High-res Tauri timing enabled (μs resolution)')
    } catch (e) {
      console.warn('[Timing] Failed to load Tauri API, using fallback:', e)
      cachedIsHighRes = false
    }
  } else {
    console.warn(
      '[Timing] Not in Tauri environment, using performance.now() fallback (~100μs resolution)'
    )
    cachedIsHighRes = false
  }

  initialized = true
}

/**
 * Get current time in microseconds.
 *
 * When in Tauri: Returns microseconds since epoch via Rust's std::time::Instant.
 * When in browser: Returns performance.now() * 1000 (milliseconds → microseconds).
 *
 * IMPORTANT: Call initTiming() before first use for optimal performance.
 * If not initialized, will use sync fallback.
 *
 * @returns Microseconds since epoch (Tauri) or page load (browser)
 */
export async function nowMicros(): Promise<number> {
  if (cachedInvoke) {
    return cachedInvoke('now_micros')
  }
  return performance.now() * 1000
}

/**
 * Synchronous timing fallback.
 *
 * Always uses performance.now() regardless of environment.
 * Use when async is not possible (e.g., in tight loops where await overhead matters).
 *
 * Note: This has browser's reduced precision (~100μs) due to Spectre mitigations.
 *
 * @returns Microseconds since page load
 */
export function nowMicrosSync(): number {
  return performance.now() * 1000
}

/**
 * Check if using high-resolution timing.
 *
 * @returns true if Tauri timing is active, false if using browser fallback
 */
export function isHighResolution(): boolean {
  return cachedIsHighRes
}

/**
 * Check if timing has been initialized.
 *
 * @returns true if initTiming() has been called
 */
export function isInitialized(): boolean {
  return initialized
}

/**
 * Reset timing state (for testing purposes).
 *
 * @internal
 */
export function _resetForTesting(): void {
  cachedInvoke = null
  cachedIsHighRes = false
  initialized = false
}
