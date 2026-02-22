/**
 * useCodeModeAtom — React hook for code-mode atoms
 *
 * Subscribes to a code-mode atom by string key.
 * Re-renders when the value changes (via useSyncExternalStore).
 *
 * Usage:
 *   const counter = useCodeModeAtom<number>('counter')
 *   // → re-renders whenever sdk.atoms.set('counter', n) is called
 *
 * @module genifer/code-mode/useCodeModeAtom
 */

'use client'

import { useSyncExternalStore, useCallback } from 'react'
import { subscribeCodeModeAtom, getCodeModeAtom } from './shared-atoms'

/**
 * Subscribe to a code-mode atom by key.
 * Returns the current value, re-rendering on changes.
 */
export function useCodeModeAtom<T = unknown>(key: string): T | undefined {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return subscribeCodeModeAtom(key, onStoreChange as any)
    },
    [key],
  )

  const getSnapshot = useCallback(() => {
    return getCodeModeAtom<T>(key)
  }, [key])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/**
 * Subscribe to multiple code-mode atoms at once.
 * Returns an object keyed by atom key.
 */
export function useCodeModeAtoms<T extends Record<string, unknown>>(
  keys: ReadonlyArray<keyof T & string>,
): Partial<T> {
  // Subscribe to all keys — re-render on any change
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const unsubs = keys.map((key) =>
        subscribeCodeModeAtom(key, onStoreChange as any),
      )
      return () => { unsubs.forEach((fn) => fn()) }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [keys.join(',')],
  )

  const getSnapshot = useCallback((): Partial<T> => {
    const result: Record<string, unknown> = {}
    for (const key of keys) {
      result[key] = getCodeModeAtom(key)
    }
    return result as Partial<T>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join(',')])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
