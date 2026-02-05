/**
 * RVN Layout Components
 *
 * Brutalist layout components for panels, cards, modals, and drawers.
 * Modal and Drawer wrap Base UI Dialog with brutalist styling.
 * All components follow the components.build compound component pattern.
 */

// Panel - Pure styled div compound component
export { RvnPanel } from './RvnPanel'
export {
  RvnPanelRoot,
  RvnPanelHeader,
  RvnPanelTitle,
  RvnPanelSubtitle,
  RvnPanelContent,
  RvnPanelFooter,
} from './RvnPanel'
export type {
  RvnPanelRootProps,
  RvnPanelHeaderProps,
  RvnPanelTitleProps,
  RvnPanelSubtitleProps,
  RvnPanelContentProps,
  RvnPanelFooterProps,
} from './RvnPanel'

// Card - Simple styled component (DEPRECATED: use RvnCard from cards/ instead)
// The compound component in cards/RvnCard.tsx replaces this
export { RvnCard as RvnCardSimple } from './RvnCard'
export type { RvnCardProps as RvnCardSimpleProps } from './RvnCard'

// Modal - Wraps Base UI Dialog
export { RvnModal, useRvnModal } from './RvnModal'
export {
  RvnModalRoot,
  RvnModalTrigger,
  RvnModalPortal,
  RvnModalBackdrop,
  RvnModalContent,
  RvnModalHeader,
  RvnModalTitle,
  RvnModalDescription,
  RvnModalClose,
  RvnModalBody,
  RvnModalFooter,
} from './RvnModal'
export type {
  RvnModalRootProps,
  RvnModalTriggerProps,
  RvnModalPortalProps,
  RvnModalBackdropProps,
  RvnModalContentProps,
  RvnModalHeaderProps,
  RvnModalTitleProps,
  RvnModalDescriptionProps,
  RvnModalCloseProps,
  RvnModalBodyProps,
  RvnModalFooterProps,
} from './RvnModal'

// Drawer - Wraps Base UI Dialog with drawer positioning
export { RvnDrawer, useRvnDrawer } from './RvnDrawer'
export {
  RvnDrawerRoot,
  RvnDrawerTrigger,
  RvnDrawerPortal,
  RvnDrawerBackdrop,
  RvnDrawerContent,
  RvnDrawerHeader,
  RvnDrawerTitle,
  RvnDrawerDescription,
  RvnDrawerClose,
  RvnDrawerBody,
  RvnDrawerFooter,
} from './RvnDrawer'
export type {
  RvnDrawerRootProps,
  RvnDrawerTriggerProps,
  RvnDrawerPortalProps,
  RvnDrawerBackdropProps,
  RvnDrawerContentProps,
  RvnDrawerHeaderProps,
  RvnDrawerTitleProps,
  RvnDrawerDescriptionProps,
  RvnDrawerCloseProps,
  RvnDrawerBodyProps,
  RvnDrawerFooterProps,
} from './RvnDrawer'
