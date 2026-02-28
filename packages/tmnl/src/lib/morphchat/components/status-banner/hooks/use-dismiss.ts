/**
 * Toast dismiss lifecycle — timers, GC, auto-dismiss.
 *
 * Rules:
 * - Errors NEVER auto-dismiss.
 * - Info/warn auto-dismiss at 30s.
 * - Dismissed IDs GC'd when source rows change.
 *
 * @module morphchat/components/status-banner/hooks/use-dismiss
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { StatusRowLike } from '../types'

export interface DismissState {
  dismissedIds: ReadonlySet<string>
  dismissToast: (id: string) => void
}

export function useDismiss(
  toastRows: ReadonlyArray<StatusRowLike>,
  cancelledToastId: string | null,
): DismissState {
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const [dismissedIds, setDismissedIds] = useState<ReadonlySet<string>>(new Set())

  const dismissToast = useCallback((id: string) => {
    setDismissedIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    const timer = timersRef.current.get(id)
    if (timer) { clearTimeout(timer); timersRef.current.delete(id) }
  }, [])

  // GC dismissed IDs when source rows change
  useEffect(() => {
    const knownIds = new Set(toastRows.map(r => r.id))
    if (cancelledToastId) knownIds.add(cancelledToastId)
    setDismissedIds(prev => {
      let changed = false
      const next = new Set<string>()
      for (const id of prev) { if (knownIds.has(id)) next.add(id); else changed = true }
      return changed ? next : prev
    })
    for (const [id, timer] of timersRef.current.entries()) {
      if (!knownIds.has(id)) { clearTimeout(timer); timersRef.current.delete(id) }
    }
  }, [toastRows, cancelledToastId])

  // Auto-dismiss: errors persist, everything else 30s
  useEffect(() => {
    for (const row of toastRows) {
      if (dismissedIds.has(row.id) || timersRef.current.has(row.id)) continue
      if (row.tone === 'error') continue
      const timer = setTimeout(() => dismissToast(row.id), 30_000)
      timersRef.current.set(row.id, timer)
    }
  }, [toastRows, dismissedIds, dismissToast])

  // Cleanup on unmount
  useEffect(() => () => {
    for (const timer of timersRef.current.values()) clearTimeout(timer)
    timersRef.current.clear()
  }, [])

  return { dismissedIds, dismissToast }
}
