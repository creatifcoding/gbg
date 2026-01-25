/**
 * Cross-Window Sync Hooks
 *
 * React hooks for subscribing to and broadcasting cross-window state.
 *
 * @module
 */

import { useEffect, useCallback, useState } from 'react'
import { Effect } from 'effect'
import {
  broadcastScaleChange,
  subscribeToScaleChanges,
  type ScaleSyncPayload,
} from './index'

// ─────────────────────────────────────────────────────────────────────────────
// Hook: Window Label
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get current Tauri window label
 */
export function useWindowLabel(): string {
  const [label, setLabel] = useState<string>('main')

  useEffect(() => {
    import('@tauri-apps/api/webviewWindow')
      .then(({ getCurrentWebviewWindow }) => {
        const window = getCurrentWebviewWindow()
        setLabel(window.label)
      })
      .catch(() => {
        // Not in Tauri, use default
        setLabel('browser')
      })
  }, [])

  return label
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: Cross-Window Sync
// ─────────────────────────────────────────────────────────────────────────────

export interface UseCrossWindowSyncOptions {
  /**
   * Called when scale changes in another window
   */
  onScaleChange?: (scale: number) => void
}

/**
 * Hook for cross-window state synchronization
 *
 * Usage:
 * ```tsx
 * const { broadcastScale } = useCrossWindowSync({
 *   onScaleChange: (scale) => setScale(scale),
 * })
 *
 * // When local scale changes
 * broadcastScale(newScale)
 * ```
 */
export function useCrossWindowSync(options: UseCrossWindowSyncOptions = {}) {
  const { onScaleChange } = options
  const windowLabel = useWindowLabel()

  // ─── Subscribe to Scale Changes ──────────────────────────────────────────

  useEffect(() => {
    if (!onScaleChange) return

    let cleanup: (() => void) | undefined

    const handleScaleChange = (payload: ScaleSyncPayload) => {
      onScaleChange(payload.scale)
    }

    subscribeToScaleChanges(handleScaleChange, windowLabel).then((unlisten) => {
      cleanup = unlisten
    })

    return () => {
      cleanup?.()
    }
  }, [onScaleChange, windowLabel])

  // ─── Broadcast Functions ─────────────────────────────────────────────────

  const broadcastScale = useCallback(
    (scale: number) => {
      Effect.runPromise(broadcastScaleChange(scale, windowLabel))
    },
    [windowLabel]
  )

  return {
    windowLabel,
    broadcastScale,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: Scale Sync (Integrated with ScaleProvider)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Hook that integrates cross-window sync with ScaleProvider
 *
 * Should be used inside ScaleProvider to broadcast and receive scale changes.
 *
 * Usage:
 * ```tsx
 * function ScaleSyncBridge() {
 *   const { scale, setScale } = useScale()
 *   useScaleSync(scale, setScale)
 *   return null
 * }
 * ```
 */
export function useScaleSync(
  currentScale: number,
  setScale: (scale: number) => void
) {
  const windowLabel = useWindowLabel()
  const [lastBroadcastedScale, setLastBroadcastedScale] = useState(currentScale)

  // ─── Broadcast Local Changes ─────────────────────────────────────────────

  useEffect(() => {
    // Only broadcast if scale changed locally (not from another window)
    if (currentScale !== lastBroadcastedScale) {
      Effect.runPromise(broadcastScaleChange(currentScale, windowLabel))
      setLastBroadcastedScale(currentScale)
    }
  }, [currentScale, lastBroadcastedScale, windowLabel])

  // ─── Receive Remote Changes ──────────────────────────────────────────────

  useEffect(() => {
    let cleanup: (() => void) | undefined

    const handleRemoteScaleChange = (payload: ScaleSyncPayload) => {
      // Update local scale without re-broadcasting
      setLastBroadcastedScale(payload.scale)
      setScale(payload.scale)
    }

    subscribeToScaleChanges(handleRemoteScaleChange, windowLabel).then(
      (unlisten) => {
        cleanup = unlisten
      }
    )

    return () => {
      cleanup?.()
    }
  }, [setScale, windowLabel])
}
