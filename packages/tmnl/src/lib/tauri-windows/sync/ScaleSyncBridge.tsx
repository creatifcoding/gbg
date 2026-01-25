/**
 * ScaleSyncBridge
 *
 * React component that bridges ScaleProvider with cross-window sync.
 * Renders nothing - just sets up listeners and broadcasts.
 *
 * Usage:
 * ```tsx
 * <ScaleProvider>
 *   <ScaleSyncBridge />
 *   <App />
 * </ScaleProvider>
 * ```
 *
 * @module
 */

import { useScale } from '@/lib/scale'
import { useScaleSync } from './hooks'

/**
 * Bridge component that syncs scale across Tauri windows.
 *
 * Must be rendered inside ScaleProvider.
 * Renders null - no visual output.
 */
export function ScaleSyncBridge() {
  const { scale, setScale } = useScale()
  useScaleSync(scale, setScale)
  return null
}

export default ScaleSyncBridge
