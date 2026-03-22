/**
 * RvnDrawer - Compound Drawer Component
 *
 * Brutalist sliding panel wrapping Base UI Dialog with drawer positioning.
 * Follows components.build composition pattern.
 *
 * @example
 * ```tsx
 * <RvnDrawer.Root open={isOpen} onOpenChange={setIsOpen}>
 *   <RvnDrawer.Trigger>
 *     <button>Open Drawer</button>
 *   </RvnDrawer.Trigger>
 *   <RvnDrawer.Portal>
 *     <RvnDrawer.Backdrop />
 *     <RvnDrawer.Content position="right">
 *       <RvnDrawer.Header>
 *         <RvnDrawer.Title>Panel Title</RvnDrawer.Title>
 *       </RvnDrawer.Header>
 *       <RvnDrawer.Body>
 *         Content here...
 *       </RvnDrawer.Body>
 *       <RvnDrawer.Footer>
 *         <RvnButton onClick={() => setIsOpen(false)}>CLOSE</RvnButton>
 *       </RvnDrawer.Footer>
 *     </RvnDrawer.Content>
 *   </RvnDrawer.Portal>
 * </RvnDrawer.Root>
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

type DrawerPosition = 'left' | 'right' | 'top' | 'bottom'

export interface RvnDrawerRootProps extends React.ComponentProps<typeof Dialog.Root> {}

export interface RvnDrawerTriggerProps extends React.ComponentProps<typeof Dialog.Trigger> {}

export interface RvnDrawerPortalProps extends React.ComponentProps<typeof Dialog.Portal> {}

export interface RvnDrawerBackdropProps extends React.ComponentProps<typeof Dialog.Backdrop> {}

export interface RvnDrawerContentProps extends React.ComponentProps<typeof Dialog.Popup> {
  /** Position of the drawer (default: 'right') */
  position?: DrawerPosition
  /** Width for left/right drawers (default: '400px') */
  width?: string
  /** Height for top/bottom drawers (default: '50vh') */
  height?: string
}

export interface RvnDrawerHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export interface RvnDrawerTitleProps extends React.ComponentProps<typeof Dialog.Title> {}

export interface RvnDrawerDescriptionProps extends React.ComponentProps<typeof Dialog.Description> {}

export interface RvnDrawerCloseProps extends React.ComponentProps<typeof Dialog.Close> {}

export interface RvnDrawerBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export interface RvnDrawerFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = {
  backdrop: {
    position: 'fixed' as const,
    inset: 0,
    background: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  contentBase: {
    position: 'fixed' as const,
    background: RVN_COLORS.surface,
    display: 'flex',
    flexDirection: 'column' as const,
    zIndex: 1001,
  },
  header: {
    background: RVN_COLORS.black,
    color: RVN_COLORS.textInverse,
    padding: RVN_SPACING.m,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontFamily: RVN_FONTS.mono,
    fontSize: RVN_FONT_SIZES.heading,
    fontWeight: RVN_FONT_WEIGHTS.bold,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    margin: 0,
    color: RVN_COLORS.textInverse,
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
    overflowY: 'auto' as const,
  },
  footer: {
    borderTop: `1px solid ${RVN_COLORS.borderMuted}`,
    padding: RVN_SPACING.m,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: RVN_SPACING.s,
  },
} as const

/**
 * Get position-specific styles for the content panel
 */
function getPositionStyles(position: DrawerPosition, width: string, height: string): React.CSSProperties {
  const borderWidth = '3px'
  const borderColor = RVN_COLORS.border

  switch (position) {
    case 'left':
      return {
        top: 0,
        left: 0,
        bottom: 0,
        width,
        borderRight: `${borderWidth} solid ${borderColor}`,
      }
    case 'right':
      return {
        top: 0,
        right: 0,
        bottom: 0,
        width,
        borderLeft: `${borderWidth} solid ${borderColor}`,
      }
    case 'top':
      return {
        top: 0,
        left: 0,
        right: 0,
        height,
        borderBottom: `${borderWidth} solid ${borderColor}`,
      }
    case 'bottom':
      return {
        bottom: 0,
        left: 0,
        right: 0,
        height,
        borderTop: `${borderWidth} solid ${borderColor}`,
      }
  }
}

// -----------------------------------------------------------------------------
// Components
// -----------------------------------------------------------------------------

/**
 * Drawer root - manages open state via Base UI Dialog
 */
const Root = React.forwardRef<HTMLDivElement, RvnDrawerRootProps>(
  (props, ref) => <Dialog.Root {...props} />
)
Root.displayName = 'RvnDrawer.Root'

/**
 * Drawer trigger - opens the drawer when clicked
 */
const Trigger = React.forwardRef<HTMLButtonElement, RvnDrawerTriggerProps>(
  (props, ref) => <Dialog.Trigger ref={ref} {...props} />
)
Trigger.displayName = 'RvnDrawer.Trigger'

/**
 * Drawer portal - renders content in a portal
 */
const Portal = (props: RvnDrawerPortalProps) => <Dialog.Portal {...props} />
Portal.displayName = 'RvnDrawer.Portal'

/**
 * Drawer backdrop - dark overlay behind drawer
 */
const Backdrop = React.forwardRef<HTMLDivElement, RvnDrawerBackdropProps>(
  ({ style, ...props }, ref) => (
    <Dialog.Backdrop
      ref={ref}
      style={{ ...styles.backdrop, ...style }}
      {...props}
    />
  )
)
Backdrop.displayName = 'RvnDrawer.Backdrop'

/**
 * Drawer content container - the sliding panel
 */
const Content = React.forwardRef<HTMLDivElement, RvnDrawerContentProps>(
  ({ position = 'right', width = '400px', height = '50vh', style, children, ...props }, ref) => {
    const positionStyles = getPositionStyles(position, width, height)

    return (
      <Dialog.Popup
        ref={ref}
        style={{
          ...styles.contentBase,
          ...positionStyles,
          ...style,
        }}
        data-position={position}
        {...props}
      >
        {children}
      </Dialog.Popup>
    )
  }
)
Content.displayName = 'RvnDrawer.Content'

/**
 * Drawer header with black background
 */
const Header = React.forwardRef<HTMLDivElement, RvnDrawerHeaderProps>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ ...styles.header, ...style }}
      data-rvn-drawer-header=""
      {...props}
    >
      {children}
    </div>
  )
)
Header.displayName = 'RvnDrawer.Header'

/**
 * Drawer title
 */
const Title = React.forwardRef<HTMLHeadingElement, RvnDrawerTitleProps>(
  ({ style, ...props }, ref) => (
    <Dialog.Title
      ref={ref}
      style={{ ...styles.title, ...style }}
      {...props}
    />
  )
)
Title.displayName = 'RvnDrawer.Title'

/**
 * Drawer description
 */
const Description = React.forwardRef<HTMLParagraphElement, RvnDrawerDescriptionProps>(
  ({ style, ...props }, ref) => (
    <Dialog.Description
      ref={ref}
      style={{ ...styles.description, ...style }}
      {...props}
    />
  )
)
Description.displayName = 'RvnDrawer.Description'

/**
 * Drawer close button wrapper
 */
const Close = React.forwardRef<HTMLButtonElement, RvnDrawerCloseProps>(
  (props, ref) => <Dialog.Close ref={ref} {...props} />
)
Close.displayName = 'RvnDrawer.Close'

/**
 * Drawer body/content area - scrollable
 */
const Body = React.forwardRef<HTMLDivElement, RvnDrawerBodyProps>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ ...styles.body, ...style }}
      data-rvn-drawer-body=""
      {...props}
    >
      {children}
    </div>
  )
)
Body.displayName = 'RvnDrawer.Body'

/**
 * Drawer footer with action buttons
 */
const Footer = React.forwardRef<HTMLDivElement, RvnDrawerFooterProps>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{ ...styles.footer, ...style }}
      data-rvn-drawer-footer=""
      {...props}
    >
      {children}
    </div>
  )
)
Footer.displayName = 'RvnDrawer.Footer'

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const RvnDrawer = {
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
  Root as RvnDrawerRoot,
  Trigger as RvnDrawerTrigger,
  Portal as RvnDrawerPortal,
  Backdrop as RvnDrawerBackdrop,
  Content as RvnDrawerContent,
  Header as RvnDrawerHeader,
  Title as RvnDrawerTitle,
  Description as RvnDrawerDescription,
  Close as RvnDrawerClose,
  Body as RvnDrawerBody,
  Footer as RvnDrawerFooter,
}

// Hook is no longer needed - Base UI Dialog handles context internally
// Kept for backwards compatibility but deprecated
/** @deprecated Use Base UI Dialog's built-in context instead */
export function useRvnDrawer() {
  console.warn('useRvnDrawer is deprecated. Base UI Dialog handles context internally.')
  return { open: false, onClose: () => {}, position: 'right' as DrawerPosition }
}
