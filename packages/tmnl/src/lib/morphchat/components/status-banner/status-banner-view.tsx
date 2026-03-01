/**
 * Status Banner View — compact card-stack toasts (orchestrator).
 *
 * Thin shell: wires hooks to ToastCard components.
 * Inline expansion replaces the modal — the toast IS the detail view.
 *
 * @module morphchat/components/status-banner/status-banner-view
 */

import { useState, useCallback, useRef, useEffect, useMemo, useDeferredValue, useTransition } from 'react'
import { Atom } from '@effect-atom/atom'
import { useAtomValue } from '@effect-atom/atom-react'
import { Effect } from 'effect'
import { AnimatePresence } from 'motion/react'
import { useMorphChatContext } from '../surface-context'
import type { StatusRowLike } from './types'
import { TOAST_NARROW_PX } from './constants'
import { ToastCard } from './toast-card'
import { useStatusRows, useDismiss } from './hooks'

const NULL_SESSION = Atom.make<string | null>(null)

export function StatusBannerView() {
  const { adapter } = useMorphChatContext()
  const sessionId = useAtomValue(adapter.sessionId$ ?? NULL_SESSION)

  // ── Data ────────────────────────────────────────────────────────────────
  const { toastRows, cancelledToastId, showRecoveryActions } = useStatusRows(adapter)
  const { dismissedIds, dismissToast } = useDismiss(toastRows, cancelledToastId)

  // ── Narrow detection ────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setNarrow(entry.contentRect.width < TOAST_NARROW_PX)
    })
    ro.observe(el)
    setNarrow(el.clientWidth < TOAST_NARROW_PX)
    return () => ro.disconnect()
  }, [])

  // ── Stack expand (hover) ────────────────────────────────────────────────
  const [stackExpanded, setStackExpanded] = useState(false)
  const deferredStackExpanded = useDeferredValue(stackExpanded)
  const [, startTransition] = useTransition()

  const handleMouseEnter = useCallback(() => {
    containerRef.current?.setAttribute('data-expanded', 'true')
    startTransition(() => setStackExpanded(true))
  }, [startTransition])

  const handleMouseLeave = useCallback(() => {
    containerRef.current?.setAttribute('data-expanded', 'false')
    startTransition(() => setStackExpanded(false))
  }, [startTransition])

  // ── Inline expansion (one card at a time) ──────────────────────────────
  const [inlineExpandedId, setInlineExpandedId] = useState<string | null>(null)

  const handleInlineExpand = useCallback((id: string | null) => {
    setInlineExpandedId(id)
    // Auto-expand stack when a card is inline-expanded
    if (id) startTransition(() => setStackExpanded(true))
  }, [startTransition])

  // ── Adapter actions ────────────────────────────────────────────────────
  const handleReconnect = useCallback(
    () => Effect.runPromise(adapter.reconnect()).catch(() => {}),
    [adapter],
  )

  // newSession: not yet on adapter interface — reconnect as fallback
  const handleNewSession = useCallback(
    () => Effect.runPromise(adapter.reconnect()).catch(() => {}),
    [adapter],
  )

  // ── Visible items ───────────────────────────────────────────────────────
  const allItems = useMemo<StatusRowLike[]>(() => {
    const items: StatusRowLike[] = []
    if (cancelledToastId && !dismissedIds.has(cancelledToastId)) {
      items.push({ id: cancelledToastId, tone: 'info', text: 'Cancelled', source: 'harness' })
    }
    for (const row of toastRows) {
      if (!dismissedIds.has(row.id)) items.push(row)
    }
    return items
  }, [toastRows, cancelledToastId, dismissedIds])

  if (allItems.length === 0) return null

  return (
    <div
      ref={containerRef}
      data-slot="morphchat-status-toasts"
      data-expanded={stackExpanded}
      data-count={allItems.length}
      className="relative flex flex-col"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence mode="popLayout">
        {allItems.map((item, index) => (
          <ToastCard
            key={item.id}
            item={item}
            index={index}
            totalCount={allItems.length}
            isCancelled={item.id === cancelledToastId}
            stackExpanded={deferredStackExpanded}
            narrow={narrow}
            showRecoveryActions={showRecoveryActions}
            inlineExpandedId={inlineExpandedId}
            onInlineExpand={handleInlineExpand}
            onDismiss={dismissToast}
            onReconnect={handleReconnect}
            onNewSession={handleNewSession}
            sessionId={sessionId}
            allItems={allItems}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

StatusBannerView.displayName = 'MorphChat.StatusBannerView'
