/**
 * Harness adapter panel replay — replay-safe remote panel event handling.
 *
 * Guarantees:
 * - Duplicate/replayed panel:spawned events do not spawn duplicate local panels.
 * - Stale remote->local mappings are pruned when local panels disappear.
 * - panel:surface_updated remains idempotent and does not affect spawn lifecycle.
 *
 * Depends on: types.ts (type-only)
 *
 * @module morphchat/hooks/harness-adapter/panel-replay
 */

import type { PanelEvent } from '@/lib/genifer/harness/panel-events'
import { applyRemotePanelEvent } from '../panel-event-handler'
import type { ReplaySafePanelEventDeps } from './types'

// ─── Module-Scoped Panel Maps ─────────────────────────────────────────────────

export const remoteToLocalPanelIds = new Map<string, string>()
export const remotePanelSurfaceIds = new Map<string, string>()
export const surfaceToLocalPanelIds = new Map<string, string>()
export const pendingDisposeTimers = new Map<string, ReturnType<typeof setTimeout>>()

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function dropPanelMapping(
  remotePanelId: string,
  remoteToLocal: Map<string, string>,
  remoteToSurface: Map<string, string>,
  surfaceToLocal: Map<string, string>,
): { localId?: string; surfaceId?: string } {
  const localId = remoteToLocal.get(remotePanelId)
  const surfaceId = remoteToSurface.get(remotePanelId)
  remoteToLocal.delete(remotePanelId)
  remoteToSurface.delete(remotePanelId)

  if (surfaceId && localId && surfaceToLocal.get(surfaceId) === localId) {
    surfaceToLocal.delete(surfaceId)
  }

  return { localId, surfaceId }
}

function prunePanelLifecycleMaps(
  remoteToLocal: Map<string, string>,
  remoteToSurface: Map<string, string>,
  surfaceToLocal: Map<string, string>,
  panelExists: (panelId: string) => boolean,
): void {
  for (const [remoteId, localId] of remoteToLocal.entries()) {
    if (panelExists(localId)) continue
    dropPanelMapping(remoteId, remoteToLocal, remoteToSurface, surfaceToLocal)
  }

  for (const [surfaceId, localId] of surfaceToLocal.entries()) {
    if (!panelExists(localId)) surfaceToLocal.delete(surfaceId)
  }
}

function dropAliasesForLocalPanel(
  localPanelId: string,
  keepRemoteId: string | null,
  remoteToLocal: Map<string, string>,
  remoteToSurface: Map<string, string>,
  surfaceToLocal: Map<string, string>,
): void {
  for (const [remoteId, candidateLocalId] of remoteToLocal.entries()) {
    if (candidateLocalId !== localPanelId) continue
    if (keepRemoteId != null && remoteId === keepRemoteId) continue
    dropPanelMapping(remoteId, remoteToLocal, remoteToSurface, surfaceToLocal)
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function applyReplaySafeRemotePanelEvent(
  event: PanelEvent & { surface?: unknown },
  deps: ReplaySafePanelEventDeps,
): void {
  const panelExists = deps.panelExists ?? (() => true)
  const remoteToLocal = deps.remoteToLocalPanelIds
  const remoteToSurface = deps.remotePanelSurfaceIds ?? new Map<string, string>()
  const surfaceToLocal = deps.surfaceToLocalPanelIds ?? new Map<string, string>()

  prunePanelLifecycleMaps(remoteToLocal, remoteToSurface, surfaceToLocal, panelExists)

  if (event._tag === 'panel:spawned') {
    if (!event.panelId || !event.surfaceId) return

    const existingLocalId = remoteToLocal.get(event.panelId)
    if (existingLocalId && panelExists(existingLocalId)) {
      remoteToSurface.set(event.panelId, event.surfaceId)
      surfaceToLocal.set(event.surfaceId, existingLocalId)
      if (event.surface) deps.setGeniferPanelSurface(event.surfaceId, event.surface)
      return
    }

    if (existingLocalId) {
      dropPanelMapping(event.panelId, remoteToLocal, remoteToSurface, surfaceToLocal)
    }

    const reusedLocalId = surfaceToLocal.get(event.surfaceId)
    if (reusedLocalId && panelExists(reusedLocalId)) {
      remoteToLocal.set(event.panelId, reusedLocalId)
      remoteToSurface.set(event.panelId, event.surfaceId)
      if (event.surface) deps.setGeniferPanelSurface(event.surfaceId, event.surface)
      return
    }

    if (reusedLocalId && !panelExists(reusedLocalId)) {
      surfaceToLocal.delete(event.surfaceId)
    }

    applyRemotePanelEvent(event, {
      registerGeniferPanelVisitor: deps.registerGeniferPanelVisitor,
      setGeniferPanelSurface: deps.setGeniferPanelSurface,
      spawnPanel: deps.spawnPanel,
      closePanel: deps.closePanel,
      remoteToLocalPanelIds: remoteToLocal,
    })

    const localPanelId = remoteToLocal.get(event.panelId)
    if (localPanelId) {
      remoteToSurface.set(event.panelId, event.surfaceId)
      surfaceToLocal.set(event.surfaceId, localPanelId)
    }
    return
  }

  if (event._tag === 'panel:closed') {
    if (!event.panelId) return

    const mappedLocalId = remoteToLocal.get(event.panelId)
    const directLocalId = panelExists(event.panelId) ? event.panelId : undefined
    const localPanelId = mappedLocalId ?? directLocalId

    if (!localPanelId) {
      dropPanelMapping(event.panelId, remoteToLocal, remoteToSurface, surfaceToLocal)
      return
    }

    deps.closePanel(localPanelId)
    dropPanelMapping(event.panelId, remoteToLocal, remoteToSurface, surfaceToLocal)
    dropAliasesForLocalPanel(localPanelId, null, remoteToLocal, remoteToSurface, surfaceToLocal)
    return
  }

  if (event._tag === 'panel:surface_updated') {
    if (!event.surfaceId || event.surface == null) return

    const localPanelId = surfaceToLocal.get(event.surfaceId)
    if (localPanelId && !panelExists(localPanelId)) {
      surfaceToLocal.delete(event.surfaceId)
    }

    applyRemotePanelEvent(event, {
      registerGeniferPanelVisitor: deps.registerGeniferPanelVisitor,
      setGeniferPanelSurface: deps.setGeniferPanelSurface,
      spawnPanel: deps.spawnPanel,
      closePanel: deps.closePanel,
      remoteToLocalPanelIds: remoteToLocal,
    })
  }
}
