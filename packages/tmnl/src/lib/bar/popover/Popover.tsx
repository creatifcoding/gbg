/**
 * Popover — Compound component for bar floating panels.
 *
 * Usage:
 * ```tsx
 * <Popover id="calendar" placement="right-end">
 *   <Popover.Trigger>
 *     <ClockButton />
 *   </Popover.Trigger>
 *   <Popover.Content width={240} height={280}>
 *     <CalendarPanel />
 *   </Popover.Content>
 * </Popover>
 * ```
 *
 * The Trigger sits inside the 48px bar.
 * The Content renders in the overlay zone (right of bar).
 * Input region is synced to Rust on open/close.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { openPopover, closePopover, BAR_WIDTH } from './atoms'
import type { PopoverPlacement } from './types'

// ─── Context ────────────────────────────────────────────────────────────────

interface PopoverCtx {
  id: string
  isOpen: boolean
  placement: PopoverPlacement
  open: () => void
  close: () => void
  toggle: () => void
  triggerRef: React.RefObject<HTMLDivElement | null>
  contentRef: React.RefObject<HTMLDivElement | null>
}

const PopoverContext = createContext<PopoverCtx | null>(null)

function usePopoverCtx() {
  const ctx = useContext(PopoverContext)
  if (!ctx) throw new Error('Popover compound components must be inside <Popover>')
  return ctx
}

// ─── Root ───────────────────────────────────────────────────────────────────

interface PopoverProps {
  id: string
  placement?: PopoverPlacement
  children: ReactNode
}

export function Popover({ id, placement = 'right-end', children }: PopoverProps) {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Track if the current pointer event started on the trigger.
  // When it did we must NOT treat the paired mouseup as "click outside".
  const pointerStartedOnTrigger = useRef(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((p) => !p), [])

  // ── Escape key closes ──
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); e.stopPropagation() }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isOpen, close])

  // ── Click-outside dismiss ──
  // Strategy: listen on pointerdown (not mousedown) at capture phase.
  // If the event target is outside BOTH trigger and content, close.
  // We listen immediately — no setTimeout — and use a pointerdown guard
  // to avoid the toggle-click causing instant re-close.
  useEffect(() => {
    if (!isOpen) return

    // Skip the first frame so the opening click doesn't immediately close.
    let armed = false
    const raf = requestAnimationFrame(() => { armed = true })

    const onPointerDown = (e: PointerEvent) => {
      if (!armed) return
      const target = e.target as Node | null
      if (!target) return

      const content = contentRef.current
      const trigger = triggerRef.current

      const insideContent = content?.contains(target)
      const insideTrigger = trigger?.contains(target)

      if (insideTrigger) {
        // Mark that this pointer sequence started on the trigger.
        // The trigger's onClick will handle toggling.
        pointerStartedOnTrigger.current = true
        return
      }

      pointerStartedOnTrigger.current = false

      if (!insideContent && !insideTrigger) {
        close()
      }
    }

    window.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [isOpen, close])

  return (
    <PopoverContext.Provider
      value={{ id, isOpen, placement, open, close, toggle, triggerRef, contentRef }}
    >
      {children}
    </PopoverContext.Provider>
  )
}

// ─── Trigger ────────────────────────────────────────────────────────────────

function Trigger({ children }: { children: ReactNode }) {
  const { toggle, triggerRef } = usePopoverCtx()

  return (
    <div ref={triggerRef} onClick={toggle} style={{ cursor: 'pointer' }}>
      {children}
    </div>
  )
}

// ─── Content ────────────────────────────────────────────────────────────────

interface ContentProps {
  children: ReactNode
  width?: number
  height?: number | 'auto'
  /** Gap between bar edge and popover */
  offset?: number
}

function Content({ children, width = 240, height = 280, offset = 6 }: ContentProps) {
  const { id, isOpen, placement, close, triggerRef, contentRef } = usePopoverCtx()

  // Calculate position based on trigger element and placement
  const [position, setPosition] = useState({ x: BAR_WIDTH + offset, y: 0 })

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const x = BAR_WIDTH + offset
    const h = height === 'auto' ? 300 : height

    let y: number
    switch (placement) {
      case 'right-start':
        y = triggerRect.top
        break
      case 'right-center':
        y = triggerRect.top + triggerRect.height / 2 - h / 2
        break
      case 'right-end':
        y = triggerRect.bottom - h
        break
      default:
        y = triggerRect.bottom - h
    }

    // Clamp to viewport
    y = Math.max(8, Math.min(y, window.innerHeight - h - 8))

    setPosition({ x, y })

    // Sync input region to Rust
    openPopover(id, { x, y, w: width, h })

    return () => {
      closePopover(id)
    }
  }, [isOpen, placement, id, width, height, offset])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={contentRef}
          initial={{ opacity: 0, scale: 0.92, x: -8 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.95, x: -4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width,
            height: height === 'auto' ? 'auto' : height,
            zIndex: 1000,
            pointerEvents: 'auto',
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Compound Exports ───────────────────────────────────────────────────────

Popover.Trigger = Trigger
Popover.Content = Content
