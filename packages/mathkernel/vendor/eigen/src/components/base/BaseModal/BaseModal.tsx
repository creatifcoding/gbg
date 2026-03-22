/**
 * BaseModal - Higher Order Provider Compound Component
 *
 * Implements visitor contracts for arbitrary content shapes.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  forwardRef,
  cloneElement,
  isValidElement,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react'
import { createPortal } from 'react-dom'
import type {
  ModalContextValue,
  ModalProviderProps,
  ModalRootProps,
  ModalTriggerProps,
  ModalPortalProps,
  ModalOverlayProps,
  ModalContentProps,
  ModalHeaderProps,
  ModalBodyProps,
  ModalFooterProps,
  ModalCloseProps,
  VisitorContract,
  ModalSize,
  ModalActions,
} from './types'

// =============================================================================
// CONSTANTS
// =============================================================================

const MODAL_SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-4xl',
  full: 'max-w-[90vw] max-h-[90vh]',
}

const MODAL_Z_INDEX = 9999

// =============================================================================
// CONTEXT
// =============================================================================

const ModalContext = createContext<ModalContextValue | null>(null)

export function useModal() {
  const ctx = useContext(ModalContext)
  if (!ctx) {
    throw new Error('useModal must be used within ModalProvider')
  }
  return ctx
}

// Optional: use without throwing (for conditional usage)
export function useModalOptional() {
  return useContext(ModalContext)
}

// =============================================================================
// PROVIDER
// =============================================================================

export function ModalProvider({ children, visitors = [] }: ModalProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [visitorId, setVisitorId] = useState<string | null>(null)
  const [data, setDataState] = useState<unknown>(null)
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null)

  const visitorsRef = useRef<Map<string, VisitorContract>>(new Map())

  // Register visitors
  useEffect(() => {
    visitorsRef.current.clear()
    for (const visitor of visitors) {
      visitorsRef.current.set(visitor.id, visitor)
    }
  }, [visitors])

  const open = useCallback(<T,>(id: string, newData: T) => {
    setVisitorId(id)
    setDataState(newData)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    // Delay clearing data to allow exit animations
    setTimeout(() => {
      setVisitorId(null)
      setDataState(null)
    }, 200)
  }, [])

  const setData = useCallback(<T,>(newData: T) => {
    setDataState(newData)
  }, [])

  const getVisitor = useCallback((id: string) => {
    return visitorsRef.current.get(id)
  }, [])

  const value: ModalContextValue = {
    isOpen,
    visitorId,
    data,
    open,
    close,
    setData,
    getVisitor,
    portalRoot,
  }

  return (
    <ModalContext.Provider value={value}>
      {children}
      <div ref={setPortalRoot} id="modal-portal-root" />
    </ModalContext.Provider>
  )
}

// =============================================================================
// LOCAL MODAL CONTEXT (for compound component pattern)
// =============================================================================

interface LocalModalContextValue {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  contentRef: React.RefObject<HTMLDivElement>
  triggerRef: React.RefObject<HTMLButtonElement>
}

const LocalModalContext = createContext<LocalModalContextValue | null>(null)

function useLocalModal() {
  const ctx = useContext(LocalModalContext)
  if (!ctx) {
    throw new Error('Modal.* components must be used within Modal.Root')
  }
  return ctx
}

// =============================================================================
// COMPOUND COMPONENTS
// =============================================================================

/**
 * Modal.Root - Context boundary for a single modal instance
 */
function ModalRoot({ children, defaultOpen = false, open, onOpenChange }: ModalRootProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const isOpen = open ?? internalOpen
  const setIsOpen = useCallback(
    (newOpen: boolean) => {
      if (open === undefined) {
        setInternalOpen(newOpen)
      }
      onOpenChange?.(newOpen)
    },
    [open, onOpenChange]
  )

  // Return focus to trigger on close
  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      triggerRef.current.focus()
    }
  }, [isOpen])

  return (
    <LocalModalContext.Provider value={{ isOpen, setIsOpen, contentRef, triggerRef }}>
      {children}
    </LocalModalContext.Provider>
  )
}

/**
 * Modal.Trigger - Element that opens the modal
 */
function ModalTrigger({ children, asChild }: ModalTriggerProps) {
  const { setIsOpen, triggerRef } = useLocalModal()

  const handleClick = () => setIsOpen(true)

  if (asChild && isValidElement(children)) {
    // Clone child and inject onClick
    const child = children as ReactElement<{ onClick?: (e: MouseEvent) => void }>
    return cloneElement(child, {
      ...child.props,
      onClick: (e: MouseEvent) => {
        child.props.onClick?.(e)
        handleClick()
      },
      ref: triggerRef,
    } as React.HTMLAttributes<HTMLElement>)
  }

  return (
    <button ref={triggerRef} onClick={handleClick} type="button">
      {children}
    </button>
  )
}

/**
 * Modal.Portal - Renders children into portal root
 */
function ModalPortal({ children, container }: ModalPortalProps) {
  const { isOpen } = useLocalModal()
  const globalModal = useModalOptional()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isOpen || !mounted) return null

  const portalContainer = container ?? globalModal?.portalRoot ?? document.body

  return createPortal(children, portalContainer)
}

/**
 * Modal.Overlay - Semi-transparent backdrop
 */
function ModalOverlay({ className = '', onClick }: ModalOverlayProps) {
  const { setIsOpen } = useLocalModal()

  const handleClick = () => {
    onClick?.()
    setIsOpen(false)
  }

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 ${className}`}
      style={{ zIndex: MODAL_Z_INDEX }}
      onClick={handleClick}
      aria-hidden="true"
    />
  )
}

/**
 * Detach icon (pop-out arrow)
 */
function DetachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1h5v5M13 1L6 8M5 3H2a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1V9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Modal.Content - Main content container
 */
const ModalContent = forwardRef<HTMLDivElement, ModalContentProps>(function ModalContent(
  { children, visitor, data, className = '', onDetach },
  ref
) {
  const { isOpen, setIsOpen, contentRef } = useLocalModal()
  const internalRef = useRef<HTMLDivElement>(null)
  const resolvedRef = (ref as React.RefObject<HTMLDivElement>) ?? contentRef ?? internalRef

  const size = visitor?.size ?? 'md'
  const sizeClass = MODAL_SIZES[size]

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape' && !visitor?.disableEscapeClose) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setIsOpen, visitor?.disableEscapeClose])

  // Focus trap (basic)
  useEffect(() => {
    if (!isOpen || !resolvedRef.current) return

    const focusableElements = resolvedRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    firstElement?.focus()

    const handleTab = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [isOpen, resolvedRef])

  const handleDetach = () => {
    if (visitor?.detachable && data !== undefined && onDetach) {
      setIsOpen(false)
      onDetach(visitor, data)
    }
  }

  const actions: ModalActions = {
    close: () => setIsOpen(false),
    setData: () => {}, // Local modals don't support setData
    detach: handleDetach,
  }

  // Stop propagation to prevent overlay click
  const handleContentClick = (e: MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div
      ref={resolvedRef}
      role="dialog"
      aria-modal="true"
      className={`fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full ${sizeClass} bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl animate-in zoom-in-95 fade-in duration-200 ${visitor?.className ?? ''} ${className}`}
      style={{ zIndex: MODAL_Z_INDEX + 1 }}
      onClick={handleContentClick}
    >
      {/* Visitor-based rendering */}
      {visitor && data !== undefined ? (
        <>
          {visitor.header && (
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              {visitor.header(data, actions)}
              <div className="flex items-center gap-1">
                {visitor.detachable && onDetach && (
                  <button
                    onClick={handleDetach}
                    className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-800 text-neutral-500 hover:text-cyan-400 transition-colors"
                    type="button"
                    aria-label="Detach to floating panel"
                    title="Detach to floating panel"
                  >
                    <DetachIcon />
                  </button>
                )}
                <ModalCloseButton />
              </div>
            </div>
          )}
          <div className="p-4 max-h-[70vh] overflow-y-auto">
            {visitor.render(data, actions)}
          </div>
          {visitor.footer && (
            <div className="px-4 py-3 border-t border-neutral-800">
              {visitor.footer(data, actions)}
            </div>
          )}
        </>
      ) : (
        children
      )}
    </div>
  )
})

/**
 * Modal.Header - Header slot
 */
function ModalHeader({ children, className = '', showClose = true }: ModalHeaderProps) {
  return (
    <div className={`px-4 py-3 border-b border-neutral-800 flex items-center justify-between ${className}`}>
      <div>{children}</div>
      {showClose && <ModalCloseButton />}
    </div>
  )
}

/**
 * Modal.Body - Main body slot
 */
function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={`p-4 max-h-[70vh] overflow-y-auto ${className}`}>
      {children}
    </div>
  )
}

/**
 * Modal.Footer - Footer slot
 */
function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`px-4 py-3 border-t border-neutral-800 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Modal.Close - Close button
 */
function ModalClose({ children, asChild, className = '' }: ModalCloseProps) {
  const { setIsOpen } = useLocalModal()

  const handleClick = () => setIsOpen(false)

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ onClick?: (e: MouseEvent) => void }>
    return cloneElement(child, {
      ...child.props,
      onClick: (e: MouseEvent) => {
        child.props.onClick?.(e)
        handleClick()
      },
    } as React.HTMLAttributes<HTMLElement>)
  }

  return (
    <button onClick={handleClick} className={className} type="button">
      {children ?? '×'}
    </button>
  )
}

/**
 * Internal close button with default styling
 */
function ModalCloseButton() {
  const { setIsOpen } = useLocalModal()

  return (
    <button
      onClick={() => setIsOpen(false)}
      className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
      type="button"
      aria-label="Close modal"
    >
      ×
    </button>
  )
}

// =============================================================================
// VISITOR FACTORY
// =============================================================================

/**
 * Create a typed visitor contract
 */
export function createVisitor<TData>(contract: VisitorContract<TData>): VisitorContract<TData> {
  return contract
}

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

export const Modal = {
  Root: ModalRoot,
  Trigger: ModalTrigger,
  Portal: ModalPortal,
  Overlay: ModalOverlay,
  Content: ModalContent,
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
  Close: ModalClose,
}

export default Modal
