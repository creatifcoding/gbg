/**
 * Atom DevTools Integration - Global hook for React DevTools and external tools
 *
 * Provides a standardized interface for:
 * - React DevTools timeline integration
 * - External debugging tools
 * - Custom DevTools extensions
 *
 * @module primitives/atoms/observability/devtools
 */

import type { AtomObservabilityEvent } from './schemas'

// =============================================================================
// Global Hook Name
// =============================================================================

const DEVTOOLS_HOOK = '__ATOM_DEVTOOLS__'
const CUSTOM_EVENT_NAME = 'atom:event'

// =============================================================================
// Types
// =============================================================================

export interface AtomDevToolsHook {
  /** Emit an observability event to all listeners */
  emit: (event: AtomObservabilityEvent) => void
  /** Subscribe to all observability events */
  subscribe: (listener: (event: AtomObservabilityEvent) => void) => () => void
  /** Get all events since initialization (for late-joining DevTools) */
  getHistory: () => readonly AtomObservabilityEvent[]
  /** Clear event history */
  clearHistory: () => void
  /** Check if DevTools is active */
  isActive: () => boolean
}

// =============================================================================
// Implementation
// =============================================================================

let globalHook: AtomDevToolsHook | null = null

/**
 * Initialize the global DevTools hook
 *
 * Call this once at app startup (e.g., in main.tsx) to enable DevTools integration.
 * Safe to call multiple times - returns existing hook if already initialized.
 *
 * @example
 * ```typescript
 * // main.tsx
 * import { initAtomDevTools } from '@/lib/primitives/atoms/observability'
 *
 * if (import.meta.env.DEV) {
 *   initAtomDevTools()
 * }
 * ```
 */
export function initAtomDevTools(): AtomDevToolsHook {
  // Return existing hook if already initialized
  if (globalHook) {
    return globalHook
  }

  const listeners = new Set<(event: AtomObservabilityEvent) => void>()
  const history: AtomObservabilityEvent[] = []
  const MAX_HISTORY = 1000 // Limit history to prevent memory leaks

  const hook: AtomDevToolsHook = {
    emit: (event) => {
      // Add to history (with limit)
      history.push(event)
      if (history.length > MAX_HISTORY) {
        history.shift()
      }

      // Notify all listeners
      listeners.forEach((l) => {
        try {
          l(event)
        } catch (err) {
          console.error('[AtomDevTools] Listener error:', err)
        }
      })

      // Emit CustomEvent for browser DevTools extensions
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(CUSTOM_EVENT_NAME, {
            detail: event,
          })
        )
      }
    },

    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    getHistory: () => [...history],

    clearHistory: () => {
      history.length = 0
    },

    isActive: () => listeners.size > 0,
  }

  // Attach to window for external access
  if (typeof window !== 'undefined') {
    ;(window as any)[DEVTOOLS_HOOK] = hook
  }

  globalHook = hook
  return hook
}

/**
 * Get the DevTools hook if initialized
 *
 * Returns null if initAtomDevTools() hasn't been called.
 * Use this to optionally emit events when DevTools might be available.
 *
 * @example
 * ```typescript
 * const devtools = getAtomDevTools()
 * if (devtools) {
 *   devtools.emit(new AtomWrite({ ... }))
 * }
 * ```
 */
export function getAtomDevTools(): AtomDevToolsHook | null {
  // Check window first (in case externally initialized)
  if (typeof window !== 'undefined' && (window as any)[DEVTOOLS_HOOK]) {
    return (window as any)[DEVTOOLS_HOOK]
  }
  return globalHook
}

/**
 * Emit an event to DevTools if available
 *
 * Convenience function that handles the null check.
 * No-op if DevTools isn't initialized.
 *
 * @example
 * ```typescript
 * emitToDevTools(new AtomWrite({ groupId: 'map:123', ... }))
 * ```
 */
export function emitToDevTools(event: AtomObservabilityEvent): void {
  getAtomDevTools()?.emit(event)
}

// =============================================================================
// React DevTools Integration Helpers
// =============================================================================

/**
 * Hook into React DevTools timeline
 *
 * This creates markers in the React DevTools Performance tab.
 * Only works in development mode with React DevTools installed.
 */
export function markDevToolsEvent(
  name: string,
  detail?: Record<string, unknown>
): void {
  if (typeof performance !== 'undefined' && performance.mark) {
    try {
      performance.mark(name, { detail })
    } catch {
      // Ignore - some browsers don't support detail
      performance.mark(name)
    }
  }
}

/**
 * Measure duration between two marks
 */
export function measureDevToolsEvent(
  name: string,
  startMark: string,
  endMark: string
): void {
  if (typeof performance !== 'undefined' && performance.measure) {
    try {
      performance.measure(name, startMark, endMark)
    } catch {
      // Ignore measurement errors
    }
  }
}
