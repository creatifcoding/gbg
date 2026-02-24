/**
 * ColumnTreeRenderer entry surface.
 *
 * @module floating/layout/scroll-strip/components/tree-renderers/column-tree-renderer
 */

import { memo, type ReactNode } from 'react'
import { PANEL } from '../../../../tokens'
import { WORKSPACE_SENTINEL } from '../../../../stx/constants'
import type { SplitNode } from '../../../split-tree/types'
import { isLeaf } from '../../../split-tree/types'
import { ColumnGridLevel } from './grid-level'

export const ColumnTreeRenderer = memo(function ColumnTreeRenderer({
  tree,
  renderPanel,
  focusedPanelId,
  columnIndex,
  onResize,
  collapsedPanels,
}: {
  tree: SplitNode
  renderPanel: (panelId: string) => ReactNode
  focusedPanelId: string | null
  columnIndex: number
  onResize: (panelId: string, delta: number, totalSize: number) => void
  collapsedPanels: Set<string>
}) {
  if (isLeaf(tree)) {
    if (tree.panelId === WORKSPACE_SENTINEL) return null
    const isFocused = tree.panelId === focusedPanelId
    return (
      <div
        data-panel-reticle={isFocused || undefined}
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          boxShadow: isFocused ? PANEL.reticleGlow : PANEL.reticleNone,
          transition: PANEL.reticleTransition,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            background: isFocused ? PANEL.reticleAccent : 'transparent',
            transition: 'opacity 200ms ease-out',
            opacity: isFocused ? 1 : 0,
            zIndex: 2,
          }}
        />
        {renderPanel(tree.panelId)}
      </div>
    )
  }

  return (
    <ColumnGridLevel
      node={tree}
      renderPanel={renderPanel}
      focusedPanelId={focusedPanelId}
      columnIndex={columnIndex}
      onResize={onResize}
      collapsedPanels={collapsedPanels}
      path="col"
    />
  )
})
