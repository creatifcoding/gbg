/**
 * Layout module — split tree data structure, components, and operations
 *
 * @module
 */

export {
  // Types
  type SplitNode,
  type SplitLeaf,
  type SplitBranch,

  // Constructors
  leaf,
  split,

  // Type guards
  isLeaf,
  isSplit,

  // Queries
  collectPanelIds,
  countLeaves,
  findPath,
  getAtPath,
  findParent,
  findAdjacentPanel,

  // Mutations (immutable)
  insertBySplit,
  removePanel,
  replacePanel,
  swapPanels,
  setSplitRatio,
  moveSeparator,

  // Serialization
  serialize,
  deserialize,
} from './split-tree'

// Components
export { SplitContainer, type SplitContainerProps, SplitDirectionContext, useSplitDirection, AllSiblingsCollapsedContext, useAllSiblingsCollapsed } from './SplitContainer'
export { Separator, type SeparatorProps } from './Separator'
export { TiledPanel, type TiledPanelProps } from './TiledPanel'
export { EdgeDropZoneOverlay, type EdgeDropZoneOverlayProps, type EdgeDropZoneProps } from './EdgeDropZone'
export { getColumns, getColumnWidths, getColumnCount, type Column } from './columns'
export { TabBar, type TabBarProps, type Tab } from './TabBar'
export { SortableTabItem, type SortableTabItemProps } from './SortableTabItem'
export { TabDragGhost, type TabDragGhostProps } from './TabDragGhost'
