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
import { openPopover, closePopover, BAR_WIDTH, SURFACE_WIDTH } from './atoms'
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

  // ── Close when modal opens (cross-system dismiss) ──
  useEffect(() => {
    if (!isOpen) return
    const handler = () => close()
    window.addEventListener('tmnl:close-all-popovers', handler)
    return () => window.removeEventListener('tmnl:close-all-popovers', handler)
  }, [isOpen, close])

  // Click-outside is handled by the Backdrop component in Content.
  // The Backdrop fills the entire overlay zone (SURFACE_WIDTH × viewport)
  // and the input region is expanded to full surface when popovers are open,
  // so the compositor delivers ALL pointer events to the WebView.

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
        <>
          {/* Backdrop: covers the ENTIRE surface so clicks outside
              the popover are caught by the WebView (not swallowed by
              the compositor). Clicking it dismisses. */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation()
              close()
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: SURFACE_WIDTH,
              height: '100vh',
              zIndex: 999,
              // Fully transparent — just an event catcher
              background: 'transparent',
              cursor: 'default',
            }}
          />
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
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Compound Exports ───────────────────────────────────────────────────────

Popover.Trigger = Trigger
Popover.Content = Content
