/**
 * RVN Base UI Overlay Components
 *
 * Brutalist-styled wrappers for Base UI overlay components.
 * All components follow the RVN design system:
 * - 3px black borders
 * - 70% black overlay backdrops
 * - Monospace typography
 * - No border radius
 * - 4px box shadows
 *
 * @example
 * ```tsx
 * import { RvnDialog, RvnTooltip, RvnMenu } from '@/lib/rvn/baseui/overlays'
 * ```
 */

// -----------------------------------------------------------------------------
// Alert Dialog
// -----------------------------------------------------------------------------

export {
  RvnAlertDialog,
  type BackdropProps as RvnAlertDialogBackdropProps,
  type PopupProps as RvnAlertDialogPopupProps,
  type TitleProps as RvnAlertDialogTitleProps,
  type DescriptionProps as RvnAlertDialogDescriptionProps,
  type ActionsProps as RvnAlertDialogActionsProps,
  type CancelProps as RvnAlertDialogCancelProps,
  type ConfirmProps as RvnAlertDialogConfirmProps,
} from './RvnAlertDialog'

// -----------------------------------------------------------------------------
// Context Menu
// -----------------------------------------------------------------------------

export {
  RvnContextMenu,
  type PopupProps as RvnContextMenuPopupProps,
  type ItemProps as RvnContextMenuItemProps,
  type SeparatorProps as RvnContextMenuSeparatorProps,
  type LabelProps as RvnContextMenuLabelProps,
} from './RvnContextMenu'

// -----------------------------------------------------------------------------
// Dialog
// -----------------------------------------------------------------------------

export {
  RvnDialog,
  type BackdropProps as RvnDialogBackdropProps,
  type PopupProps as RvnDialogPopupProps,
  type HeaderProps as RvnDialogHeaderProps,
  type TitleProps as RvnDialogTitleProps,
  type CloseProps as RvnDialogCloseProps,
  type BodyProps as RvnDialogBodyProps,
  type FooterProps as RvnDialogFooterProps,
} from './RvnDialog'

// -----------------------------------------------------------------------------
// Menu
// -----------------------------------------------------------------------------

export {
  RvnMenu,
  type PopupProps as RvnMenuPopupProps,
  type ItemProps as RvnMenuItemProps,
  type SeparatorProps as RvnMenuSeparatorProps,
  type LabelProps as RvnMenuLabelProps,
  type CheckboxItemProps as RvnMenuCheckboxItemProps,
  type RadioGroupProps as RvnMenuRadioGroupProps,
  type RadioItemProps as RvnMenuRadioItemProps,
} from './RvnMenu'

// -----------------------------------------------------------------------------
// Popover
// -----------------------------------------------------------------------------

export {
  RvnPopover,
  type PopupProps as RvnPopoverPopupProps,
  type ArrowProps as RvnPopoverArrowProps,
  type TitleProps as RvnPopoverTitleProps,
  type DescriptionProps as RvnPopoverDescriptionProps,
  type BodyProps as RvnPopoverBodyProps,
  type CloseProps as RvnPopoverCloseProps,
} from './RvnPopover'

// -----------------------------------------------------------------------------
// Preview Card
// -----------------------------------------------------------------------------

export {
  RvnPreviewCard,
  type PopupProps as RvnPreviewCardPopupProps,
  type HeaderProps as RvnPreviewCardHeaderProps,
  type TitleProps as RvnPreviewCardTitleProps,
  type BodyProps as RvnPreviewCardBodyProps,
  type FooterProps as RvnPreviewCardFooterProps,
  type ImageProps as RvnPreviewCardImageProps,
} from './RvnPreviewCard'

// -----------------------------------------------------------------------------
// Toast
// -----------------------------------------------------------------------------

export {
  RvnToast,
  useRvnToast,
  type RvnToastVariant,
  type RootProps as RvnToastRootProps,
  type ViewportProps as RvnToastViewportProps,
  type TitleProps as RvnToastTitleProps,
  type DescriptionProps as RvnToastDescriptionProps,
  type CloseProps as RvnToastCloseProps,
  type ActionProps as RvnToastActionProps,
} from './RvnToast'

// -----------------------------------------------------------------------------
// Tooltip
// -----------------------------------------------------------------------------

export {
  RvnTooltip,
  type PopupProps as RvnTooltipPopupProps,
  type ArrowProps as RvnTooltipArrowProps,
} from './RvnTooltip'
