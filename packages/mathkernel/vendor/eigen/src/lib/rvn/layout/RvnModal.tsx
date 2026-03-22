/**
 * RvnModal - Compound Modal Component
 *
 * Brutalist modal wrapping Base UI Dialog with dark overlay and centered content panel.
 * Follows components.build composition pattern.
 *
 * @example
 * ```tsx
 * <RvnModal.Root open={isOpen} onOpenChange={setIsOpen}>
 *   <RvnModal.Trigger>
 *     <button>Open Modal</button>
 *   </RvnModal.Trigger>
 *   <RvnModal.Portal>
 *     <RvnModal.Backdrop />
 *     <RvnModal.Content>
 *       <RvnModal.Header>
 *         <RvnModal.Title>Unit Details</RvnModal.Title>
 *         <RvnModal.Close>
 *           <button>X</button>
 *         </RvnModal.Close>
 *       </RvnModal.Header>
 *       <RvnModal.Body>
 *         <p>Modal content...</p>
 *       </RvnModal.Body>
 *       <RvnModal.Footer>
 *         <button onClick={() => setIsOpen(false)}>CLOSE</button>
 *       </RvnModal.Footer>
 *     </RvnModal.Content>
 *   </RvnModal.Portal>
 * </RvnModal.Root>
 * ```
 */

import * as React from 'react'
import { Dialog } from '@base-ui-components/react/dialog'
import {
  RVN_COLORS,
  RVN_BORDERS,
  RVN_FONTS,
  RVN_FONT_SIZES,
  RVN_FONT_WEIGHTS,
  RVN_SPACING,
} from '../tokens'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface RvnModalRootProps extends React.ComponentProps<typeof Dialog.Root> {}

export interface RvnModalTriggerProps extends React.ComponentProps<typeof Dialog.Trigger> {}

export interface RvnModalPortalProps extends React.ComponentProps<typeof Dialog.Portal> {}

export interface RvnModalBackdropProps extends React.ComponentProps<typeof Dialog.Backdrop> {}

export interface RvnModalContentProps extends React.ComponentProps<typeof Dialog.Popup> {
  /** Max width of modal (default: 600px) */
  maxWidth?: string
}

export interface RvnModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export interface RvnModalTitleProps extends React.ComponentProps<typeof Dialog.Title> {}

export interface RvnModalDescriptionProps extends React.ComponentProps<typeof Dialog.Description> {}

export interface RvnModalCloseProps extends React.ComponentProps<typeof Dialog.Close> {}

export interface RvnModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export interface RvnModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    zIndex: 1000,
  },
  content: {
    position: 'fixed' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: RVN_COLORS.surface,
    border: RVN_BORDERS.primary,
    borderRadius: RVN_BORDERS.radius,
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 1001,
  },
  header: {
    borderBottom: `1px solid ${RVN_COLORS.borderMuted}`,
    padding: RVN_SPACING.m,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: RVN_FONTS.mono,
    fontSize: '24px',
    fontWeight: RVN_FONT_WEIGHTS.black,
    textTransform: 'uppercase' as const,
    letterSpacing: '-0.02em',
    margin: 0,
    color: RVN_COLORS.textMain,
  },
  description: {
    fontFamily: RVN_FONTS.sans,
    fontSize: RVN_FONT_SIZES.body,
    color: RVN_COLORS.textMuted,
    margin: `${RVN_SPACING.xs} 0 0`,
  },
  body: {
    padding: RVN_SPACING.m,
    flex: 1,
  },
  footer: {
    borderTop: `1px solid ${RVN_COLORS.borderMuted}`,
    padding: RVN_SPACING.m,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: RVN_SPACING.s,
  },
} as const

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/**
 * Modal root - manages open state via Base UI Dialog
 */
const Root = React.forwardRef<HTMLDivElement, RvnModalRootProps>(
  (props, ref) => <Dialog.Root {...props} />
)
Root.displayName = 'RvnModal.Root'

/**
 * Modal trigger - opens the modal when clicked
 */
const Trigger = React.forwardRef<HTMLButtonElement, RvnModalTriggerProps>(
  (props, ref) => <Dialog.Trigger ref={ref} {...props} />
)
Trigger.displayName = 'RvnModal.Trigger'

/**
 * Modal portal - renders content in a portal
 */
const Portal = (props: RvnModalPortalProps) => <Dialog.Portal {...props} />
Portal.displayName = 'RvnModal.Portal'

/**
 * Modal backdrop - dark overlay behind modal
 */
const Backdrop = React.forwardRef<HTMLDivElement, RvnModalBackdropProps>(
  ({ style, ...props }, ref) => (
    <Dialog.Backdrop
      ref={ref}
      style={{ ...styles.backdrop, ...style }}
      {...props}
    />
  )
)
Backdrop.displayName = 'RvnModal.Backdrop'

/**
 * Modal content container
 */
const Content = React.forwardRef<HTMLDivElement, RvnModalContentProps>(
  ({ maxWidth = '600px', style, children, ...props }, ref) => (
    <Dialog.Popup
      ref={ref}
      style={{
        ...styles.content,
        maxWidth,
        ...style,
      }}
      {...props}
    >
      {children}
    </Dialog.Popup>
  )
)
Content.displayName = 'RvnModal.Content'

/**
 * Modal header
 */
const Header = React.forwardRef<HTMLDivElement, RvnModalHeaderProps>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ ...styles.header, ...style }}
      data-rvn-modal-header=""
      {...props}
    >
      {children}
    </div>
  )
)
Header.displayName = 'RvnModal.Header'

/**
 * Modal title
 */
const Title = React.forwardRef<HTMLHeadingElement, RvnModalTitleProps>(
  ({ style, ...props }, ref) => (
    <Dialog.Title
      ref={ref}
      style={{ ...styles.title, ...style }}
      {...props}
    />
  )
)
Title.displayName = 'RvnModal.Title'

/**
 * Modal description
 */
const Description = React.forwardRef<HTMLParagraphElement, RvnModalDescriptionProps>(
  ({ style, ...props }, ref) => (
    <Dialog.Description
      ref={ref}
      style={{ ...styles.description, ...style }}
      {...props}
    />
  )
)
Description.displayName = 'RvnModal.Description'

/**
 * Modal close button wrapper
 */
const Close = React.forwardRef<HTMLButtonElement, RvnModalCloseProps>(
  (props, ref) => <Dialog.Close ref={ref} {...props} />
)
Close.displayName = 'RvnModal.Close'

/**
 * Modal body/content area
 */
const Body = React.forwardRef<HTMLDivElement, RvnModalBodyProps>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ ...styles.body, ...style }}
      data-rvn-modal-body=""
      {...props}
    >
      {children}
    </div>
  )
)
Body.displayName = 'RvnModal.Body'

/**
 * Modal footer with action buttons
 */
const Footer = React.forwardRef<HTMLDivElement, RvnModalFooterProps>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ ...styles.footer, ...style }}
      data-rvn-modal-footer=""
      {...props}
    >
      {children}
    </div>
  )
)
Footer.displayName = 'RvnModal.Footer'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnModal = {
  Root,
  Trigger,
  Portal,
  Backdrop,
  Content,
  Header,
  Title,
  Description,
  Close,
  Body,
  Footer,
}

// Also export individual components for tree-shaking
export {
  Root as RvnModalRoot,
  Trigger as RvnModalTrigger,
  Portal as RvnModalPortal,
  Backdrop as RvnModalBackdrop,
  Content as RvnModalContent,
  Header as RvnModalHeader,
  Title as RvnModalTitle,
  Description as RvnModalDescription,
  Close as RvnModalClose,
  Body as RvnModalBody,
  Footer as RvnModalFooter,
}

// Hook is no longer needed - Base UI Dialog handles context internally
// Kept for backwards compatibility but deprecated
/** @deprecated Use Base UI Dialog's built-in context instead */
export function useRvnModal() {
  console.warn('useRvnModal is deprecated. Base UI Dialog handles context internally.')
  return { open: false, onClose: () => {} }
}
