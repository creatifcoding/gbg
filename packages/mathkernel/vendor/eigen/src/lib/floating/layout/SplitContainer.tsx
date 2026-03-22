/**
 * SplitContainer — recursive CSS Grid renderer for the panel tree
 *
 * Each split level becomes a CSS Grid:
 *   - horizontal → grid-template-columns
 *   - vertical   → grid-template-rows
 *
 * Same-direction children are flattened into a single grid
 * (no nesting for consecutive horizontal or vertical splits).
 * Direction changes create nested grids.
 *
 * Collapsed panels → fixed 36px track
 * Expanded panels  → 1fr track
 * Separators       → 0px grid tracks with grab-zone overlay
 *
 * `grid-template-columns` and `grid-template-rows` are natively
 * animatable in modern browsers, so collapse/expand transitions
 * are smooth CSS-only.
 *
 * SM reference: §4.1 Panel Tree, §4.2 Split Containers, §3.8 Collapse
 *
 * @module
 */

import { memo, useContext, useMemo, type ReactNode } from 'react'
// Framer Motion layout removed — CSS Grid transitions handle swap animation natively.
// layout="position" + layoutId forced getBoundingClientRect on ALL leaves per swap.
import { useSelector } from '@/lib/stx'
import { getFloatingStx } from '../floating-stx'
import {
  type SplitNode,
  type SplitBranch,
  isLeaf,
  collectPanelIds,
  flattenSameDirection,
} from './split-tree'
import { Separator } from './Separator'
import { PANEL } from '../tokens'
import { WORKSPACE_SENTINEL } from '../stx/constants'
import {
  SplitDirectionContext,
  AllSiblingsCollapsedContext,
  ConstrainedAxisContext,
} from './split-contexts'

// Re-export contexts for backward compat
export {
  SplitDirectionContext,
  AllSiblingsCollapsedContext,
  ConstrainedAxisContext,
  useSplitDirection,
  useAllSiblingsCollapsed,
  useConstrainedAxis,
} from './split-contexts'

// =============================================================================
// Constants
// =============================================================================

const COLLAPSED_TRACK = '36px'
const EXPANDED_TRACK = '1fr'
const SEPARATOR_TRACK = '0px'

// =============================================================================
// Track size: computed as a selector, not a hook in a loop
// =============================================================================

/**
 * Compute grid track size for a node within its parent context.
 *
 * Key behavior: when ALL sibling items are collapsed, each gets `1fr`
 * (equal share of available space). When some are expanded and some
 * collapsed, collapsed ones get fixed `36px` to make room.
 *
 * This is computed per-item with awareness of siblings via the
 * `allSiblingsCollapsed` flag passed from GridLevel.
 */
function getTrackSize(node: SplitNode, allSiblingsCollapsed: boolean): string {
  const stx = getFloatingStx()

  if (isLeaf(node)) {
    if (node.panelId === WORKSPACE_SENTINEL) return EXPANDED_TRACK
    const collapsed = stx.data.panels.get(node.panelId)?.isCollapsed.get() ?? false
    if (!collapsed) return EXPANDED_TRACK
    // Collapsed: if all siblings also collapsed → equal share; else fixed strip
    return allSiblingsCollapsed ? EXPANDED_TRACK : COLLAPSED_TRACK
  }

  // Branch: check if ALL descendant leaves are collapsed
  const ids = collectPanelIds(node).filter(id => id !== WORKSPACE_SENTINEL)
  const branchAllCollapsed = ids.length > 0 && ids.every(id =>
    stx.data.panels.get(id)?.isCollapsed.get() ?? false
  )
  if (!branchAllCollapsed) return EXPANDED_TRACK
  // All collapsed in this branch: same logic — share if all siblings also collapsed
  return allSiblingsCollapsed ? EXPANDED_TRACK : COLLAPSED_TRACK
}

// =============================================================================
// Recursive GridNode
// =============================================================================

interface GridNodeProps {
  node: SplitNode
  renderPanel: (panelId: string) => ReactNode
  path: string
}

const GridNode = memo(function GridNode({
  node,
  renderPanel,
  path,
}: GridNodeProps) {
  if (isLeaf(node)) {
    if (node.panelId === WORKSPACE_SENTINEL) {
      return <div data-workspace-zone data-base-spacer style={{ minWidth: 0, minHeight: 0 }} />
    }
    return <>{renderPanel(node.panelId)}</>
  }

  const branch = node as SplitBranch
  const flatChildren = useMemo(() => flattenSameDirection(branch), [branch])

  return (
    <GridLevel
      direction={branch.direction}
      items={flatChildren}
      renderPanel={renderPanel}
      path={path}
    />
  )
})

// =============================================================================
// GridLevel — single CSS Grid for one direction
//
// Track template is built inside ONE useSelector so hook count is stable.
// =============================================================================

interface GridLevelProps {
  direction: 'horizontal' | 'vertical'
  items: SplitNode[]
  renderPanel: (panelId: string) => ReactNode
  path: string
}

const GridLevel = memo(function GridLevel({
  direction,
  items,
  renderPanel,
  path,
}: GridLevelProps) {
  const isRow = direction === 'horizontal'

  // Are ALL items in this grid level collapsed?
  const allCollapsed = useSelector(() => {
    const stx = getFloatingStx()
    return items.every(item => {
      if (isLeaf(item)) {
        if (item.panelId === WORKSPACE_SENTINEL) return false
        return stx.data.panels.get(item.panelId)?.isCollapsed.get() ?? false
      }
      const ids = collectPanelIds(item).filter(id => id !== WORKSPACE_SENTINEL)
      return ids.length > 0 && ids.every(id =>
        stx.data.panels.get(id)?.isCollapsed.get() ?? false
      )
    })
  })

  // Grid template string — stable hook count
  const template = useSelector(() => {
    return items
      .map((item, i) => {
        const size = getTrackSize(item, allCollapsed)
        return i < items.length - 1 ? `${size} ${SEPARATOR_TRACK}` : size
      })
      .join(' ')
  })

  // Build children: [Item, Sep, Item, Sep, ..., Item]
  // Leaves get motion.div with layoutId for FLIP swap animation.
  // Read existing constrained axis from ancestor
  const ancestorConstraint = useContext(ConstrainedAxisContext)

  const gridChildren: ReactNode[] = []
  items.forEach((item, i) => {
    const leafId = isLeaf(item) ? item.panelId : undefined
    const child = (
      <GridNode node={item} renderPanel={renderPanel} path={`${path}-${i}`} />
    )

    // Determine if this item gets a 36px track (collapsed in mixed context)
    // If so, set the constrained axis for descendants.
    const itemTrackSize = getTrackSize(item, allCollapsed)
    const isItemCollapsed = itemTrackSize === COLLAPSED_TRACK
    // Constrained axis: inherit from ancestor, or set from this level
    // vertical parent → 36px row → height constrained
    // horizontal parent → 36px column → width constrained
    const constrainedAxis = ancestorConstraint ?? (isItemCollapsed ? (isRow ? 'width' : 'height') : null)

    // All leaves rendered as plain divs — CSS Grid `transition: grid-template-columns`
    // handles the visual swap animation natively (150ms ease-out, GPU-composited).
    gridChildren.push(
      <ConstrainedAxisContext.Provider key={leafId ?? `item-${i}`} value={constrainedAxis}>
        <div
          data-split-leaf={leafId}
          style={{ overflow: 'hidden', position: 'relative', minWidth: 0, minHeight: 0 }}
        >
          {child}
        </div>
      </ConstrainedAxisContext.Provider>
    )

    if (i < items.length - 1) {
      gridChildren.push(
        <Separator
          key={`sep-${i}`}
          direction={direction}
          splitPath={`${path}-sep-${i}`}
        />
      )
    }
  })

  return (
    <SplitDirectionContext.Provider value={direction}>
    <AllSiblingsCollapsedContext.Provider value={allCollapsed}>
      <div
        data-split-grid
        data-split-direction={direction}
        style={{
          display: 'grid',
          ...(isRow
            ? { gridTemplateColumns: template, gridTemplateRows: '1fr' }
            : { gridTemplateRows: template, gridTemplateColumns: '1fr' }
          ),
          overflow: 'hidden',
          minWidth: 0,
          minHeight: 0,
          width: '100%',
          height: '100%',
          transition: isRow
            ? 'grid-template-columns 150ms ease-out'
            : 'grid-template-rows 150ms ease-out',
        }}
      >
        {gridChildren}
      </div>
    </AllSiblingsCollapsedContext.Provider>
    </SplitDirectionContext.Provider>
  )
})

// =============================================================================
// Props
// =============================================================================

export interface SplitContainerProps {
  renderPanel: (panelId: string) => ReactNode
  className?: string
}

// =============================================================================
// Public
// =============================================================================

export const SplitContainer = memo(function SplitContainer({
  renderPanel,
  className = '',
}: SplitContainerProps) {
  const panelTree = useSelector(() => getFloatingStx().data.panelTree.get()) as SplitNode | null

  if (!panelTree) {
    return (
      <div
        data-base-layer
        data-base-spacer
        className={className}
        style={{
          flex: '1 1 0%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: PANEL.bg,
          color: PANEL.text,
          fontSize: 'var(--tmnl-text-sm, 14px)',
        }}
      />
    )
  }

  return (
    <div
      data-base-layer
      className={className}
      style={{ flex: '1 1 0%', overflow: 'hidden', background: PANEL.bg }}
    >
      <GridNode node={panelTree} renderPanel={renderPanel} path="root" />
    </div>
  )
})
