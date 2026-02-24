/**
 * Overscan policy for ScrollStrip virtualization.
 *
 * @module floating/layout/scroll-strip/hooks/useStripOverscan
 */

import { useMemo } from 'react'
import { getFloatingStx } from '../../../stx/instance'
import { getColumnPanelId, type Column } from '../../../types/strip'
import { panelRegistry } from '../../../panel-registry'

export function useStripOverscan(columns: ReadonlyArray<Column>): number {
  const hasFullTierPanels = useMemo(() => {
    for (let i = 0; i < columns.length; i++) {
      const panelId = getColumnPanelId(columns[i])
      const panel = getFloatingStx().data.panels.get(panelId)?.peek()
      if (!panel?.visitorId) continue
      const entry = panelRegistry.get(panel.visitorId)
      if (entry?.stateTier === 'full') return true
    }
    return false
  }, [columns])

  return hasFullTierPanels ? 99999 : 400
}
