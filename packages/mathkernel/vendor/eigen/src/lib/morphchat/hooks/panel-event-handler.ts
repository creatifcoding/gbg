import type { PanelEvent } from '@/lib/genifer/harness/panel-events'

export interface PanelEventHandlerDeps {
  registerGeniferPanelVisitor: () => void
  setGeniferPanelSurface: (surfaceId: string, surface: unknown) => void
  spawnPanel: (visitorId: string, opts: {
    mode?: 'floating' | 'tiled'
    title?: string
    data?: unknown
    accent?: string
  }) => string | null
  closePanel: (panelId: string) => void
  remoteToLocalPanelIds: Map<string, string>
}

export function applyRemotePanelEvent(
  event: PanelEvent & { surface?: unknown },
  deps: PanelEventHandlerDeps,
): void {
  if (event._tag === 'panel:spawned') {
    if (!event.surfaceId || !event.panelId) return

    deps.registerGeniferPanelVisitor()

    if (event.surface) {
      deps.setGeniferPanelSurface(event.surfaceId, event.surface)
    }

    const localPanelId = deps.spawnPanel('genifer:surface', {
      mode: event.mode ?? 'floating',
      title: event.title,
      data: {
        surfaceId: event.surfaceId,
        prompt: event.prompt,
        threadId: event.threadId,
      },
      accent: '#22d3ee',
    })

    if (localPanelId) {
      deps.remoteToLocalPanelIds.set(event.panelId, localPanelId)
    }
    return
  }

  if (event._tag === 'panel:closed') {
    if (!event.panelId) return
    const localId = deps.remoteToLocalPanelIds.get(event.panelId) ?? event.panelId
    deps.closePanel(localId)
    deps.remoteToLocalPanelIds.delete(event.panelId)
    return
  }

  if (event._tag === 'panel:surface_updated') {
    if (!event.surfaceId || !event.surface) return
    deps.setGeniferPanelSurface(event.surfaceId, event.surface)
  }
}
