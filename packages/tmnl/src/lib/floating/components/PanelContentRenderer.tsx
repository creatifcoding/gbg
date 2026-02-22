/**
 * PanelContentRenderer — renders registered panel content by visitorId.
 *
 * Tab-aware: if the host panel's activeTabId points to a ghost (tabbed)
 * panel, renders that ghost panel's visitorId content. Otherwise renders
 * the host panel's own visitorId content. Falls back to children.
 *
 * @module floating/components/PanelContentRenderer
 */

import { memo, Suspense, type ReactNode } from 'react'
import { useSelector } from '@/lib/stx'
import { getFloatingStx } from '../floating-stx'
import { panelRegistry } from '../panel-registry'
import { PANEL } from '../tokens'

export interface PanelContentRendererProps {
  panelId: string
  children?: ReactNode
}

export const PanelContentRenderer = memo(function PanelContentRenderer({
  panelId,
  children,
}: PanelContentRendererProps) {
  // Resolve which panel's content to render:
  // If activeTabId is set and differs from panelId, render the ghost panel's content
  const resolved = useSelector(() => {
    const stx = getFloatingStx()
    const host = stx.data.panels.get(panelId)?.get()
    if (!host) return null

    const activeTabId = host.activeTabId
    // If active tab is a ghost panel (not the host itself)
    if (activeTabId && activeTabId !== panelId) {
      const ghost = stx.data.panels.get(activeTabId)?.get()
      if (ghost?.visitorId) {
        return { visitorId: ghost.visitorId, visitorData: ghost.visitorData, contentPanelId: activeTabId }
      }
    }

    // Default: render host panel's own content
    return host.visitorId
      ? { visitorId: host.visitorId, visitorData: host.visitorData, contentPanelId: panelId }
      : null
  })

  // No visitor content → render fallback children
  if (!resolved) return <>{children}</>

  const entry = panelRegistry.get(resolved.visitorId)
  if (!entry) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: PANEL.textMuted,
          fontFamily: 'monospace',
          fontSize: 'var(--tmnl-text-xs, 12px)',
        }}
      >
        Unknown visitor: {resolved.visitorId}
      </div>
    )
  }

  const Component = entry.component

  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: PANEL.text,
            fontFamily: 'monospace',
            fontSize: 'var(--tmnl-text-xs, 12px)',
          }}
        >
          Loading {entry.label}…
        </div>
      }
    >
      <Component panelId={resolved.contentPanelId} data={resolved.visitorData} />
    </Suspense>
  )
})
