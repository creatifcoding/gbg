/**
 * Floating Panel Components barrel
 *
 * @module
 */

export { ChromeBtn, chromeBtnBase, type ChromeBtnProps } from './ChromeBtn'
export {
  MinimizeIcon,
  CollapseIcon,
  ExpandIcon,
  MaximizeIcon,
  RestoreIcon,
} from './PanelIcons'
export { DragGuideOverlay, type DragGuideOverlayProps } from './DragGuideOverlay'
export { PanelHeader, type PanelHeaderProps } from './PanelHeader'
export { PanelContent, type PanelContentProps } from './PanelContent'

// Atomic compound components
export {
  PanelTitle,
  PanelTabClose,
  PanelTitleTab,
  PanelModeToggle,
  PanelMaxToggle,
  PanelMinimize,
  PanelControls,
  PanelResize,
} from './atoms'
