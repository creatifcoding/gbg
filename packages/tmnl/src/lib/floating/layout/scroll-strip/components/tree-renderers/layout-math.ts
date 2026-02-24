/**
 * Layout math utilities for ScrollStrip tree renderers.
 *
 * @module floating/layout/scroll-strip/components/tree-renderers/layout-math
 */

import { WORKSPACE_SENTINEL } from '../../../../stx/constants'
import {
  collectPanelIds,
} from '../../../split-tree'
import type { SplitNode, SplitBranch } from '../../../split-tree/types'
import { isLeaf } from '../../../split-tree/types'

interface CollapsedSummary {
  collapsedFlags: boolean[]
  hasAnyCollapsed: boolean
  allCollapsed: boolean
}

/** Compute effective fractional widths from nested split ratios. */
export function computeItemFractions(node: SplitBranch): number[] {
  const fracs: number[] = []

  function walk(n: SplitNode, weight: number) {
    if (isLeaf(n)) {
      fracs.push(weight)
      return
    }

    const b = n as SplitBranch
    if (b.direction === node.direction) {
      walk(b.children[0], weight * b.ratio)
      walk(b.children[1], weight * (1 - b.ratio))
      return
    }

    fracs.push(weight)
  }

  walk(node.children[0], node.ratio)
  walk(node.children[1], 1 - node.ratio)
  return fracs
}

export function isItemCollapsed(item: SplitNode, collapsedPanels: Set<string>): boolean {
  if (isLeaf(item)) return collapsedPanels.has(item.panelId)
  const ids = collectPanelIds(item).filter((id) => id !== WORKSPACE_SENTINEL)
  return ids.length > 0 && ids.every((id) => collapsedPanels.has(id))
}

export function summarizeCollapsedItems(
  items: ReadonlyArray<SplitNode>,
  collapsedPanels: Set<string>,
): CollapsedSummary {
  const collapsedFlags = new Array<boolean>(items.length)
  let collapsedCount = 0

  for (let i = 0; i < items.length; i++) {
    const collapsed = isItemCollapsed(items[i], collapsedPanels)
    collapsedFlags[i] = collapsed
    if (collapsed) collapsedCount += 1
  }

  return {
    collapsedFlags,
    hasAnyCollapsed: collapsedCount > 0,
    allCollapsed: collapsedCount === items.length,
  }
}

export function buildTrackTemplate(
  fracs: ReadonlyArray<number>,
  collapsedFlags: ReadonlyArray<boolean>,
  hasAnyCollapsed: boolean,
  allCollapsed: boolean,
): string {
  const tracks: string[] = []
  for (let i = 0; i < fracs.length; i++) {
    if (i > 0) tracks.push('0px')
    if (!hasAnyCollapsed) {
      tracks.push(`${fracs[i]}fr`)
      continue
    }
    if (allCollapsed) {
      tracks.push('1fr')
      continue
    }
    tracks.push(collapsedFlags[i] ? '36px' : '1fr')
  }

  return tracks.join(' ')
}

export function firstLeafId(node: SplitNode): string {
  if (isLeaf(node)) return node.panelId
  return firstLeafId((node as SplitBranch).children[0])
}
