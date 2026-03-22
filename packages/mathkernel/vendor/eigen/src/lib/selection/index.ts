/**
 * Selection System
 *
 * Marquee selection + grouping for card-based UI.
 *
 * ## Quick Start
 *
 * ```tsx
 * import { SelectionOverlay, useSelection, useSelectable } from '@/lib/selection'
 *
 * function Canvas() {
 *   const containerRef = useRef<HTMLDivElement>(null)
 *   const { selectedIds } = useSelection()
 *
 *   return (
 *     <div ref={containerRef} className="relative">
 *       <SelectionOverlay
 *         containerRef={containerRef}
 *         onSelectionChange={(ids) => console.log(ids)}
 *       />
 *       <SelectableCard id="card-1" />
 *       <SelectableCard id="card-2" />
 *     </div>
 *   )
 * }
 *
 * function SelectableCard({ id }) {
 *   const { selectableProps, isSelected } = useSelectable(id)
 *
 *   return (
 *     <div {...selectableProps} className="relative">
 *       <SelectionRing selected={isSelected} />
 *       Card content
 *     </div>
 *   )
 * }
 * ```
 *
 * ## Hotkeys
 *
 * | Key | Action |
 * |-----|--------|
 * | Escape | Deselect all |
 * | Ctrl+A | Select all |
 * | Shift+G | Group selected |
 * | Shift+U | Ungroup selected |
 * | Delete | Delete selected (requires onDelete callback) |
 *
 * ## Selection Modes
 *
 * - **Click**: Replace selection
 * - **Shift+Click**: Add to selection
 * - **Ctrl/Cmd+Click**: Toggle in selection
 * - **Drag**: Marquee selection (replaces)
 * - **Shift+Drag**: Marquee add to selection
 *
 * @module
 */

// Types
export * from './types'

// State management
export {
  selectionState$,
  getSelectedIds,
  isSelected,
  getMarqueeRect,
  isSelecting,
  getModifiers,
  getGroup,
  getItemGroup,
  getGroupForItem,
  getSelectedCount,
  hasSelection,
  startMarquee,
  updateMarquee,
  endMarquee,
  cancelMarquee,
  selectItem,
  selectItems,
  deselectItem,
  deselectAll,
  selectAll,
  updateModifiers,
  groupSelected,
  ungroupSelected,
  subscribeToSelection,
  subscribeToGroups,
  resetSelection,
} from './selection-stx'

// Components
export { SelectionOverlay } from './SelectionOverlay'
export type { SelectionOverlayProps } from './SelectionOverlay'

export { SelectionMarquee } from './SelectionMarquee'
export type {
  SelectionMarqueeProps,
  SelectionMode as MarqueeSelectionMode,
  CollisionDetector,
} from './SelectionMarquee'

// Hooks
export { useSelection, useSelectable } from './useSelection'
export type { UseSelectionReturn, UseSelectableReturn } from './useSelection'

// 3D Utilities
export {
  createFrustumCollisionDetector,
  useFrustumCollisionDetector,
} from './frustumSelect'
export type { Entity3D, ViewportSize } from './frustumSelect'

// Modifier Key Tracking (Stream-backed)
export {
  modifierState$,
  altPressed$,
  runModifierTracking,
  startModifierTracking,
  stopModifierTracking,
} from './modifierKeys'
export type { ModifierState } from './modifierKeys'
