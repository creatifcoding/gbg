/**
 * ScrollStrip column cell components.
 *
 * @module floating/layout/scroll-strip/components/column-cell
 */

import { memo, useCallback, type ReactNode } from 'react'
import { PANEL } from '../../../tokens'
import { getFloatingStx } from '../../../stx/instance'
import { useSelector } from '@/lib/stx'
import type { Column } from '../../../types/strip'
import { getColumnPanelIds, COLLAPSED_COLUMN_WIDTH } from '../../../types/strip'
import type { SplitBranch } from '../../split-tree/types'
import { isLeaf } from '../../split-tree/types'
import { moveSeparator } from '../../split-tree'
import {
  ColumnTreeRenderer,
  CollapsedPanelStrip,
  CollapsedBranchStrip,
} from './tree-renderers'

const CollapsedColumnStrip = memo(function CollapsedColumnStrip({
  column,
  index,
  isFocused,
  onExpand,
}: {
  column: Column
  index: number
  isFocused: boolean
  onExpand: () => void
}) {
  const panelIds = getColumnPanelIds(column)
  const accent = useSelector(() => {
    const panel = getFloatingStx().data.panels.get(panelIds[0])?.get()
    return panel?.accent
  })

  return (
    <div
      data-strip-column-index={index}
      data-strip-column-collapsed
      data-strip-column-focused={isFocused || undefined}
      onClick={onExpand}
      style={{
        width: COLLAPSED_COLUMN_WIDTH,
        height: '100%',
        background: PANEL.bg,
        borderRight: `1px solid ${PANEL.border}`,
        borderLeft: accent ? `2px solid ${accent}` : `1px solid ${PANEL.border}`,
        cursor: 'pointer',
        overflow: 'hidden',
        boxShadow: isFocused ? PANEL.reticleGlow : PANEL.reticleNone,
        transition: `background 150ms ease-out, ${PANEL.reticleTransition}`,
      }}
      title={`Expand column (${panelIds.length} panels)`}
    >
      {isLeaf(column.tree) ? (
        <CollapsedPanelStrip
          panelId={column.tree.panelId}
          isFocused={isFocused}
          isRow={false}
          allSiblingsCollapsed={true}
          forceVerticalText={true}
        />
      ) : (
        <CollapsedBranchStrip
          node={column.tree as SplitBranch}
          isRow={false}
          focusedPanelId={null}
          useVerticalText={true}
        />
      )}
    </div>
  )
})

export const StripColumnCell = memo(function StripColumnCell({
  column,
  index,
  isFocused,
  focusedPanelId,
  renderPanel,
  onToggleCollapse,
}: {
  column: Column
  index: number
  isFocused: boolean
  focusedPanelId: string | null
  renderPanel: (panelId: string) => ReactNode
  onToggleCollapse: (index: number) => void
}) {
  const handleExpand = useCallback(() => onToggleCollapse(index), [onToggleCollapse, index])

  const collapsedPanels = useSelector(() => {
    const stx = getFloatingStx()
    const ids = getColumnPanelIds(column)
    const set = new Set<string>()
    for (const id of ids) {
      if (stx.data.panels.get(id)?.isCollapsed.get()) set.add(id)
    }
    return set
  })

  const handleResize = useCallback((panelId: string, delta: number, totalSize: number) => {
    const stx = getFloatingStx()
    const strip = stx.data.strip.peek()
    if (index < 0 || index >= strip.columns.length) return

    const col = strip.columns[index]
    const newTree = moveSeparator(col.tree, panelId, delta, totalSize)

    if (newTree !== col.tree) {
      const cols = [...strip.columns]
      cols[index] = { ...col, tree: newTree }
      stx.data.strip.set({ ...strip, columns: cols })
    }
  }, [index])

  if (column.isCollapsed) {
    return (
      <CollapsedColumnStrip
        column={column}
        index={index}
        isFocused={isFocused}
        onExpand={handleExpand}
      />
    )
  }

  const tree = column.tree
  const isSingleLeaf = isLeaf(tree)

  return (
    <div
      data-strip-column-index={index}
      data-strip-column-width={column.width}
      data-strip-column-focused={isFocused || undefined}
      data-strip-column-type={isSingleLeaf ? 'single' : 'tree'}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: PANEL.bg,
        borderRight: `1px solid ${PANEL.border}`,
        borderLeft: index === 0 ? `1px solid ${PANEL.border}` : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 0,
          contentVisibility: isFocused ? 'visible' : 'auto',
          containIntrinsicSize: 'auto 500px',
        } as React.CSSProperties}
      >
        <ColumnTreeRenderer
          tree={tree}
          renderPanel={renderPanel}
          focusedPanelId={focusedPanelId}
          columnIndex={index}
          onResize={handleResize}
          collapsedPanels={collapsedPanels}
        />
      </div>
    </div>
  )
})
