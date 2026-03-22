/**
 * Modal System — Public API.
 *
 * Full-overlay modals within the same layer-shell surface.
 * Same pattern as Popover, but fills the overlay zone.
 *
 * @example Compound component
 * ```tsx
 * import { Modal } from '@/lib/getbyshell/modal'
 *
 * <Modal id="chronicle" entrance="holographic">
 *   <Modal.Content>
 *     <ChronicleView />
 *   </Modal.Content>
 * </Modal>
 * ```
 *
 * @example Imperative
 * ```ts
 * import { openModal, closeModal } from '@/lib/getbyshell/modal'
 *
 * openModal('chronicle', { dayId: '2026-02-20' }, 'holographic')
 * closeModal()
 * ```
 */

export { Modal, useModal } from './Modal'
export {
  openModal,
  closeModal,
  subscribeModal,
  getModalSnapshot,
} from './atoms'
export type { ModalEntrance, ModalRect, ModalEntry } from './types'
