/**
 * BaseModal - Higher Order Provider Compound Component
 *
 * A modal system implementing visitor contracts for arbitrary content shapes.
 */

export { Modal, ModalProvider, useModal, useModalOptional, createVisitor } from './BaseModal'
export type {
  VisitorContract,
  ModalActions,
  ModalSize,
  ModalState,
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
} from './types'
