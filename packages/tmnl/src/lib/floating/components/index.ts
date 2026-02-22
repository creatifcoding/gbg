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

// Collapsed strip (minimize → accordion stack)
export { CollapsedStrip, type CollapsedStripProps, STRIP_HEIGHT, STRIP_GAP, STRIP_BOTTOM_OFFSET } from './CollapsedStrip'
export { CollapsedStripStack } from './CollapsedStripStack'

// Accordion sub-panels
export { AccordionPanel, type AccordionPanelProps, type AccordionSectionProps } from './AccordionPanel'

// Tab bar (wired to stx, ghost panel model)
export { PanelTabBar, type PanelTabBarProps } from './PanelTabBar'
// Visitor palette (cmdk picker for "+")
export { VisitorPalette, type VisitorPaletteProps } from './VisitorPalette'

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

// Context menu
export { PanelContextMenu, usePanelContextMenu, type PanelContextMenuProps } from './PanelContextMenu'

// SM Migration icons
export { FloatIcon, DockIcon } from './PanelIcons'
export { PanelContentRenderer } from "./PanelContentRenderer"
