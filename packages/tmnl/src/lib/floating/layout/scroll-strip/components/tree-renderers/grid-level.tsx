/**
 * Recursive grid-level renderer for ScrollStrip tree mode.
 *
 * @module floating/layout/scroll-strip/components/tree-renderers/grid-level
 */

import { memo, type ReactNode } from 'react'
import { PANEL } from '../../../../tokens'
import { getFloatingStx } from '../../../../stx/instance'
import { WORKSPACE_SENTINEL } from '../../../../stx/constants'
import type { SplitNode, SplitBranch } from '../../../split-tree/types'
import { isLeaf } from '../../../split-tree/types'
import { flattenSameDirection } from '../../../split-tree'
import { CollapsedPanelStrip, CollapsedBranchStrip } from './collapsed-strips'
import {
  computeItemFractions,
  summarizeCollapsedItems,
  buildTrackTemplate,
  firstLeafId,
  isItemCollapsed,
} from './layout-math'
import { IntraColumnSeparator } from './intra-separator'

export const ColumnGridLevel = memo(function ColumnGridLevel({
  node,
  renderPanel,
  focusedPanelId,
  columnIndex,
  onResize,
  collapsedPanels,
  path,
}: {
  node: SplitBranch
  renderPanel: (panelId: string) => ReactNode
  focusedPanelId: string | null
  columnIndex: number
  onResize: (panelId: string, delta: number, totalSize: number) => void
  collapsedPanels: Set<string>
  path: string
}) {
  const isRow = node.direction === 'horizontal'
  const items = flattenSameDirection(node)
  const fracs = computeItemFractions(node)
  const { collapsedFlags, hasAnyCollapsed, allCollapsed } = summarizeCollapsedItems(
    items,
    collapsedPanels,
  )
  const template = buildTrackTemplate(fracs, collapsedFlags, hasAnyCollapsed, allCollapsed)

  return (
    <div
      data-column-grid
      data-column-grid-direction={node.direction}
      style={{
        display: 'grid',
        ...(isRow
          ? { gridTemplateColumns: template, gridTemplateRows: '1fr' }
          : { gridTemplateRows: template, gridTemplateColumns: '1fr' }),
        overflow: 'hidden',
        width: '100%',
        height: '100%',
        minWidth: 0,
        minHeight: 0,
        transition: isRow
          ? 'grid-template-columns 150ms ease-out'
          : 'grid-template-rows 150ms ease-out',
      }}
    >
      {items.flatMap((item, i) => {
        const elements: ReactNode[] = []

        if (i > 0) {
          const prevLeaf = firstLeafId(items[i - 1])
          elements.push(
            <IntraColumnSeparator
              key={`sep-${path}-${i}`}
              isRow={isRow}
              panelIdBefore={prevLeaf}
              onResize={onResize}
            />,
          )
        }

        if (isLeaf(item)) {
          if (item.panelId === WORKSPACE_SENTINEL) {
            elements.push(<div key={`sentinel-${i}`} />)
          } else {
            const isFocused = item.panelId === focusedPanelId
            const isCollapsed = collapsedPanels.has(item.panelId)

            if (isCollapsed) {
              elements.push(
                <CollapsedPanelStrip
                  key={item.panelId}
                  panelId={item.panelId}
                  isFocused={isFocused}
                  isRow={isRow}
                  allSiblingsCollapsed={allCollapsed}
                />,
              )
            } else {
              elements.push(
                <div
                  key={item.panelId}
                  data-panel-reticle={isFocused || undefined}
                  style={{
                    overflow: 'hidden',
                    position: 'relative',
                    minWidth: 0,
                    minHeight: 0,
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
                  {renderPanel(item.panelId)}
                </div>,
              )
            }
          }
        } else {
          const branchCollapsed = isItemCollapsed(item, collapsedPanels)
          if (branchCollapsed) {
            elements.push(
              <CollapsedBranchStrip
                key={`branch-collapsed-${path}-${i}`}
                node={item as SplitBranch}
                isRow={isRow}
                focusedPanelId={focusedPanelId}
              />,
            )
          } else {
            elements.push(
              <ColumnGridLevel
                key={`branch-${path}-${i}`}
                node={item as SplitBranch}
                renderPanel={renderPanel}
                focusedPanelId={focusedPanelId}
                columnIndex={columnIndex}
                onResize={onResize}
                collapsedPanels={collapsedPanels}
                path={`${path}-${i}`}
              />,
            )
          }
        }

        return elements
      })}
    </div>
  )
})
