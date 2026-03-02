/**
 * Session Drawer Bridge — maps v2 local sessions to SessionListItem shape.
 *
 * Provides a type-compatible local session source for the session drawer.
 * Server sessions remain authoritative; this enriches with local data
 * and provides a fallback when server is unreachable.
 *
 * @module harness/session/v2/session-drawer-bridge
 */

import type { SessionListItem } from '@/lib/harness/HarnessRuntime'
import type { SessionMetadata } from './metadata'
import { sessionRegistry, sessionList$ } from './atoms'
import { getSessionV2Map } from './facade'

/**
 * Convert a v2 SessionMetadata to a SessionListItem (drawer-compatible shape).
 */
export function sessionMetadataToListItem(meta: SessionMetadata): SessionListItem {
  return {
    sessionId: meta.sessionId,
    name: '',
    autoTitle: meta.preview
      ? meta.preview.slice(0, 60) + (meta.preview.length > 60 ? '…' : '')
      : 'Local session',
    tags: [],
    status: meta.status === 'disposed' ? 'archived' : 'active',
    starred: false,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    messageCount: meta.messageCount,
    modelId: meta.model ?? 'unknown',
    provider: 'local',
    previewSnippet: meta.preview ?? '',
    nodeId: '',
    role: meta.role ?? 'coder',
  }
}

/**
 * Get all v2 local sessions as SessionListItem[].
 *
 * Reads from the v2 sessionList$ atom in the session registry.
 */
export function getLocalSessionListItems(): ReadonlyArray<SessionListItem> {
  const metas = sessionRegistry.get(sessionList$)
  return metas.map(sessionMetadataToListItem)
}

/**
 * Enrich server session list with v2 local data.
 *
 * Strategy:
 *   - Server sessions are authoritative (identity, name, tags, starred, status)
 *   - V2 local data enriches: accurate messageCount from tree, preview from actual content
 *   - Local-only sessions (not on server) are appended with provider:'local' marker
 *
 * @returns Merged array: server sessions (enriched) + local-only sessions
 */
export function mergeSessionSources(
  serverSessions: ReadonlyArray<SessionListItem>,
): ReadonlyArray<SessionListItem> {
  const v2Map = getSessionV2Map()
  const localItems = getLocalSessionListItems()

  if (localItems.length === 0) return serverSessions

  // Build a lookup from v2 session IDs to local items
  const localById = new Map<string, SessionListItem>()
  for (const item of localItems) {
    localById.set(item.sessionId, item)
  }

  // Enrich server sessions with local data where available
  const enriched = serverSessions.map((server) => {
    const local = localById.get(server.sessionId)
    if (!local) return server

    // Remove from local map — it's covered by server
    localById.delete(server.sessionId)

    return {
      ...server,
      // Enrich: use local messageCount if higher (server may be stale)
      messageCount: Math.max(server.messageCount, local.messageCount),
      // Enrich: use local preview if server's is empty
      previewSnippet: server.previewSnippet.trim() || local.previewSnippet,
    }
  })

  // Append local-only sessions (not on server)
  const localOnly = [...localById.values()]

  return [...enriched, ...localOnly]
}

/**
 * Get v2 diagnostics for the session drawer.
 */
export function getV2Diagnostics(): {
  readonly localSessionCount: number
  readonly wiredInstanceCount: number
  readonly wiredInstances: ReadonlyArray<string>
} {
  const metas = sessionRegistry.get(sessionList$)
  const v2Map = getSessionV2Map()

  return {
    localSessionCount: metas.length,
    wiredInstanceCount: v2Map.size,
    wiredInstances: [...v2Map.keys()],
  }
}
