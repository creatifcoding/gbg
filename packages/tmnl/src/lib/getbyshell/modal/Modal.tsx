/**
 * Modal — Compound component for full-overlay panels.
 *
 * Same architecture as Popover but fills the entire overlay zone.
 * Renders in the same layer-shell surface — no separate Tauri window.
 *
 * Usage:
 * ```tsx
 * <Modal id="chronicle" entrance="holographic">
 *   <Modal.Trigger>
 *     <button>Open Chronicle</button>
 *   </Modal.Trigger>
 *   <Modal.Content>
 *     <ChronicleView />
 *   </Modal.Content>
 * </Modal>
 * ```
 *
 * Or imperative (from CalendarPanel):
 * ```ts
 * import { openModal } from '@/lib/getbyshell/modal'
 * openModal('chronicle', { dayId: '2026-02-20' }, 'holographic', originRect)
 * ```
 *
 * Content renders at x=BAR_WIDTH, y=0, fills to SURFACE_WIDTH × viewport height.
 * Input region expands to full surface when open (same Rust command as Popover).
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  subscribeModal,
  getModalSnapshot,
  openModal,
  closeModal,
  ensureSurfaceCollapsed,
  BAR_WIDTH,
  SURFACE_WIDTH,
} from './atoms'
import type { ModalEntrance } from './types'

// ─── Context ────────────────────────────────────────────────────────────────

interface ModalCtx {
  id: string
  isOpen: boolean
  payload: unknown
  entrance: ModalEntrance
  open: (payload?: unknown) => void
  close: () => void
}

const ModalContext = createContext<ModalCtx | null>(null)

function useModalCtx() {
  const ctx = useContext(ModalContext)
  if (!ctx) throw new Error('Modal compound components must be inside <Modal>')
  return ctx
}

/** Hook to read modal context from any descendant */
export function useModal() {
  return useModalCtx()
}

// ─── Root ───────────────────────────────────────────────────────────────────

interface ModalProps {
  id: string
  entrance?: ModalEntrance
  children: ReactNode
}

export function Modal({ id, entrance = 'slide-right', children }: ModalProps) {
  const snapshot = useSyncExternalStore(subscribeModal, getModalSnapshot, getModalSnapshot)
  const isOpen = snapshot.activeId === id
  const payload = snapshot.payload
  const currentEntrance = snapshot.entrance

  const open = useCallback(
    (p?: unknown) => openModal(id, p, entrance),
    [id, entrance],
  )

  const close = useCallback(() => closeModal(), [])

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isOpen, close])

  return (
    <ModalContext.Provider
      value={{ id, isOpen, payload, entrance: currentEntrance, open, close }}
    >
      {children}
    </ModalContext.Provider>
  )
}

// ─── Trigger ────────────────────────────────────────────────────────────────

interface TriggerProps {
  children: ReactNode
  payload?: unknown
  /** Capture origin rect for bloom animation */
  captureOrigin?: boolean
}

function Trigger({ children, payload, captureOrigin = false }: TriggerProps) {
  const { id, open } = useModalCtx()
  const ref = React.useRef<HTMLDivElement>(null)

  const handleClick = useCallback(() => {
    if (captureOrigin && ref.current) {
      const rect = ref.current.getBoundingClientRect()
      openModal(id, payload, 'holographic', {
        x: rect.left,
        y: rect.top,
        w: rect.width,
        h: rect.height,
      })
    } else {
      open(payload)
    }
  }, [id, open, payload, captureOrigin])

  return (
    <div ref={ref} onClick={handleClick} style={{ cursor: 'pointer' }}>
      {children}
    </div>
  )
}

// ─── Content ────────────────────────────────────────────────────────────────

interface ContentProps {
  children: ReactNode
  /** Horizontal padding inside the overlay zone */
  padding?: number
}

function Content({ children, padding = 0 }: ContentProps) {
  const { isOpen, entrance, close } = useModalCtx()
  const snapshot = useSyncExternalStore(subscribeModal, getModalSnapshot, getModalSnapshot)
  const originRect = snapshot.originRect

  // Entrance animation variants
  const variants = getEntranceVariants(entrance, originRect)

  // Defensive: when isOpen transitions false → ensure surface collapses.
  // Catches async race where syncModalSurface(true) resolved after (false).
  useEffect(() => {
    if (!isOpen) {
      ensureSurfaceCollapsed()
    }
  }, [isOpen])

  // Defensive: on unmount, always collapse surface.
  useEffect(() => {
    return () => { ensureSurfaceCollapsed() }
  }, [])

  // Defensive: when window regains focus, verify surface state.
  // Palette keyboard-exclusive mode causes bar to lose/regain focus —
  // if surface was stuck expanded, this catches it.
  useEffect(() => {
    const handleFocus = () => {
      if (!isOpen) ensureSurfaceCollapsed()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [isOpen])

  // The surface expands to full monitor width when modal opens.
  // Content fills everything right of the bar strip.
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — fills entire surface, click to dismiss */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) {
                e.stopPropagation()
                close()
              }
            }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              zIndex: 1999,
              background: '#000000',
              cursor: 'default',
            }}
          />

          {/* Modal content — fills from bar edge to screen edge */}
          <motion.div
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              position: 'fixed',
              left: BAR_WIDTH + padding,
              top: padding,
              right: padding,
              height: `calc(100vh - ${padding * 2}px)`,
              zIndex: 2000,
              pointerEvents: 'auto',
              overflow: 'hidden',
            }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Entrance Variants ──────────────────────────────────────────────────────

function getEntranceVariants(
  entrance: ModalEntrance,
  _originRect: { x: number; y: number; w: number; h: number } | null,
) {
  const spring = { type: 'spring' as const, stiffness: 400, damping: 30 }

  switch (entrance) {
    case 'fade':
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.25 } },
        exit: { opacity: 0, transition: { duration: 0.15 } },
      }
    case 'slide-right':
      return {
        initial: { opacity: 0, x: -24, scale: 0.97 },
        animate: { opacity: 1, x: 0, scale: 1, transition: spring },
        exit: { opacity: 0, x: -16, scale: 0.98, transition: { duration: 0.15 } },
      }
    case 'bloom':
      return {
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1, transition: spring },
        exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
      }
    case 'holographic':
      return {
        initial: { opacity: 0, scale: 0.85, x: -32, filter: 'blur(8px)' },
        animate: {
          opacity: 1,
          scale: 1,
          x: 0,
          filter: 'blur(0px)',
          transition: { ...spring, stiffness: 350, damping: 28 },
        },
        exit: {
          opacity: 0,
          scale: 0.92,
          x: -16,
          filter: 'blur(4px)',
          transition: { duration: 0.2 },
        },
      }
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
  }
}

// ─── Compound Exports ───────────────────────────────────────────────────────

Modal.Trigger = Trigger
Modal.Content = Content
