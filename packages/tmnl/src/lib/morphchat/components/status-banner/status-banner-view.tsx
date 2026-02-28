/**
 * Status Banner View — compact card-stack toasts (orchestrator).
 *
 * Thin shell: wires hooks to ToastCard components + error details modal.
 * All logic lives in hooks/ and sub-components.
 *
 * @module morphchat/components/status-banner/status-banner-view
 */

import { useState, useCallback, useRef, useEffect, useMemo, useDeferredValue, useTransition } from 'react'
import { Effect } from 'effect'
import { AnimatePresence } from 'motion/react'
import { ChatErrorDetailsModal } from '@/lib/chat/status'
import { useMorphChatContext } from '../surface-context'
import type { StatusRowLike } from './types'
import { TOAST_NARROW_PX } from './constants'
import { ToastCard } from './toast-card'
import { useStatusRows, useDismiss } from './hooks'

export function StatusBannerView() {
  const { adapter } = useMorphChatContext()

  // ── Data ────────────────────────────────────────────────────────────────
  const { toastRows, cancelledToastId, showRecoveryActions } = useStatusRows(adapter)
  const { dismissedIds, dismissToast } = useDismiss(toastRows, cancelledToastId)
  const [activeRow, setActiveRow] = useState<StatusRowLike | null>(null)

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
  const [expanded, setExpanded] = useState(false)
  const deferredExpanded = useDeferredValue(expanded)
  const [, startTransition] = useTransition()

  const handleMouseEnter = useCallback(() => {
    containerRef.current?.setAttribute('data-expanded', 'true')
    startTransition(() => setExpanded(true))
  }, [startTransition])

  const handleMouseLeave = useCallback(() => {
    containerRef.current?.setAttribute('data-expanded', 'false')
    startTransition(() => setExpanded(false))
  }, [startTransition])

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
    <>
      <div
        ref={containerRef}
        data-slot="morphchat-status-toasts"
        data-expanded={expanded}
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
              expanded={deferredExpanded}
              narrow={narrow}
              showRecoveryActions={showRecoveryActions}
              onExpand={setActiveRow}
              onDismiss={dismissToast}
              onReconnect={() => Effect.runPromise(adapter.reconnect()).catch(() => {})}
            />
          ))}
        </AnimatePresence>
      </div>

      <ChatErrorDetailsModal
        open={activeRow != null}
        onOpenChange={open => { if (!open) setActiveRow(null) }}
        title={activeRow?.code ? `Harness Error [${activeRow.code}]` : 'Harness Error'}
        summary={activeRow?.text ?? ''}
        details={activeRow?.details ?? activeRow?.text ?? ''}
        severity={(activeRow?.tone ?? 'error') as 'info' | 'warn' | 'error'}
        viewVariant="surface"
        adapterVariant={activeRow?.source === 'mock' ? 'mock' : activeRow?.source === 'harness' ? 'harness' : 'generic'}
        onReconnect={() => Effect.runPromise(adapter.reconnect()).catch(() => {})}
      />
    </>
  )
}

StatusBannerView.displayName = 'MorphChat.StatusBannerView'
