/**
 * Recursive collapsed branch strip renderer.
 *
 * @module floating/layout/scroll-strip/components/tree-renderers/collapsed-branch-strip
 */

import { memo, type ReactNode } from 'react'
import type { SplitNode, SplitBranch } from '../../../split-tree/types'
import { isLeaf } from '../../../split-tree/types'
import { CollapsedPanelStrip } from './collapsed-panel-strip'

/** Recursive collapsed-branch strip preserving tree structure. */
export const CollapsedBranchStrip = memo(function CollapsedBranchStrip({
  node,
  isRow,
  focusedPanelId,
  useVerticalText,
}: {
  node: SplitBranch
  isRow: boolean
  focusedPanelId: string | null
  useVerticalText?: boolean
}) {
  const verticalText = useVerticalText ?? isRow
  const isHorizontalBranch = node.direction === 'horizontal'
  const childCount = 2
  const gridTemplate = Array(childCount).fill('1fr').join(' ')

  const renderChild = (child: SplitNode, key: string): ReactNode => {
    if (isLeaf(child)) {
      return (
        <CollapsedPanelStrip
          key={key}
          panelId={child.panelId}
          isFocused={child.panelId === focusedPanelId}
          isRow={isHorizontalBranch}
          allSiblingsCollapsed={true}
          forceVerticalText={verticalText}
        />
      )
    }

    return (
      <CollapsedBranchStrip
        key={key}
        node={child as SplitBranch}
        isRow={isHorizontalBranch}
        focusedPanelId={focusedPanelId}
        useVerticalText={verticalText}
      />
    )
  }

  return (
    <div
      data-collapsed-branch
      style={{
        display: 'grid',
        ...(isHorizontalBranch
          ? { gridTemplateColumns: gridTemplate, gridTemplateRows: '1fr' }
          : { gridTemplateRows: gridTemplate, gridTemplateColumns: '1fr' }),
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
      }}
    >
      {renderChild(node.children[0], 'child-0')}
      {renderChild(node.children[1], 'child-1')}
    </div>
  )
})
