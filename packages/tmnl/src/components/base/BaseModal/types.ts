/**
 * BaseModal Type Definitions
 *
 * Visitor contracts and modal state types.
 */

import type { ReactNode } from 'react'

// =============================================================================
// MODAL ACTIONS
// =============================================================================

export interface ModalActions {
  /** Close the modal */
  close: () => void
  /** Update modal data (for dynamic content) */
  setData: <T>(data: T) => void
}

// =============================================================================
// VISITOR CONTRACT
// =============================================================================

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

/**
 * Visitor Contract - defines how a specific data shape renders in the modal
 *
 * @template TData The shape of data this visitor accepts
 */
export interface VisitorContract<TData = unknown> {
  /** Unique identifier for this visitor type */
  id: string
  /** Render function: data → ReactNode */
  render: (data: TData, actions: ModalActions) => ReactNode
  /** Optional: custom header renderer */
  header?: (data: TData, actions: ModalActions) => ReactNode
  /** Optional: custom footer renderer */
  footer?: (data: TData, actions: ModalActions) => ReactNode
  /** Optional: modal size preset */
  size?: ModalSize
  /** Optional: custom class for content container */
  className?: string
  /** Optional: disable overlay click to close */
  disableOverlayClose?: boolean
  /** Optional: disable escape key to close */
  disableEscapeClose?: boolean
}

// =============================================================================
// MODAL STATE
// =============================================================================

export interface ModalState {
  /** Whether modal is open */
  isOpen: boolean
  /** Currently active visitor ID */
  visitorId: string | null
  /** Current data being displayed */
  data: unknown
}

// =============================================================================
// CONTEXT VALUE
// =============================================================================

export interface ModalContextValue extends ModalState {
  /** Open modal with specific visitor and data */
  open: <T>(visitorId: string, data: T) => void
  /** Close modal */
  close: () => void
  /** Update current data */
  setData: <T>(data: T) => void
  /** Get visitor by ID */
  getVisitor: (id: string) => VisitorContract | undefined
  /** Portal root element */
  portalRoot: HTMLElement | null
}

// =============================================================================
// COMPOUND COMPONENT PROPS
// =============================================================================

export interface ModalRootProps {
  children: ReactNode
  /** Default open state */
  defaultOpen?: boolean
  /** Controlled open state */
  open?: boolean
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void
}

export interface ModalTriggerProps {
  children: ReactNode
  /** Render as child element (passes onClick) */
  asChild?: boolean
}

export interface ModalPortalProps {
  children: ReactNode
  /** Custom container element */
  container?: HTMLElement
}

export interface ModalOverlayProps {
  /** Custom class name */
  className?: string
  /** Click handler (default: close modal) */
  onClick?: () => void
}

export interface ModalContentProps<TData = unknown> {
  children?: ReactNode
  /** Visitor contract for rendering */
  visitor?: VisitorContract<TData>
  /** Data to pass to visitor */
  data?: TData
  /** Custom class name */
  className?: string
}

export interface ModalHeaderProps {
  children?: ReactNode
  /** Custom class name */
  className?: string
  /** Show close button */
  showClose?: boolean
}

export interface ModalBodyProps {
  children?: ReactNode
  /** Custom class name */
  className?: string
}

export interface ModalFooterProps {
  children?: ReactNode
  /** Custom class name */
  className?: string
}

export interface ModalCloseProps {
  children?: ReactNode
  /** Render as child element */
  asChild?: boolean
  /** Custom class name */
  className?: string
}

// =============================================================================
// PROVIDER PROPS
// =============================================================================

export interface ModalProviderProps {
  children: ReactNode
  /** Array of visitor contracts to register */
  visitors?: VisitorContract[]
}
