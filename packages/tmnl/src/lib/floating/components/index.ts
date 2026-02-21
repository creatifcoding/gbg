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
