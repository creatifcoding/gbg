/**
 * Overscan policy for ScrollStrip virtualization.
 *
 * @module floating/layout/scroll-strip/hooks/useStripOverscan
 */

import { useMemo } from 'react'
import { getFloatingStx } from '../../../stx/instance'
import { getColumnPanelIds, type Column } from '../../../types/strip'
import { panelRegistry } from '../../../panel-registry'

export function stripHasFullTierPanels(columns: ReadonlyArray<Column>): boolean {
  for (let i = 0; i < columns.length; i++) {
    for (const panelId of getColumnPanelIds(columns[i])) {
      const panel = getFloatingStx().data.panels.get(panelId)?.peek()
      if (!panel?.visitorId) continue
      const entry = panelRegistry.get(panel.visitorId)
      if (entry?.stateTier === 'full') return true
    }
  }
  return false
}

export function useStripOverscan(columns: ReadonlyArray<Column>): number {
  const hasFullTierPanels = useMemo(() => stripHasFullTierPanels(columns), [columns])

  return hasFullTierPanels ? 99999 : 400
}
