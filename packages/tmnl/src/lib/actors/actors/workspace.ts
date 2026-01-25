/**
 * WorkspaceActor
 *
 * Shared buffer registry with real-time sync across all connected clients.
 * Manages buffer lifecycle: create, open (ref++), close (ref--, GC when 0).
 *
 * Uses Effect Schema-validated wrapper to prevent Zod errors from leaking.
 *
 * @module lib/actors/actors/workspace
 */

import { validatedActor } from '../wrappers/actor'

// =============================================================================
// Types
// =============================================================================

/** Buffer metadata stored in workspace */
export interface WorkspaceBufferMeta {
  id: string
  type: 'document' | 'terminal' | 'webview' | 'widget' | 'canvas'
  name: string
  uri: string
  ysweetDocId?: string
  documentId?: string
  filePath?: string
  mimeType?: string
  createdAt: string
  modifiedAt: string
}

/** Buffer entry with ref counting */
interface BufferEntry {
  meta: WorkspaceBufferMeta
  refCount: number
  openedBy: string[] // userIds
}

/** Workspace actor state */
interface WorkspaceState {
  buffers: Record<string, BufferEntry>
}

// =============================================================================
// Actor Definition
// =============================================================================

export const workspace = validatedActor({
  state: { buffers: {} } as WorkspaceState,

  actions: {
    /**
     * Create a new buffer in the workspace.
     */
    createBuffer: (
      c,
      userId: string,
      type: WorkspaceBufferMeta['type'],
      name: string,
      uri: string,
      options?: {
        ysweetDocId?: string
        documentId?: string
        filePath?: string
        mimeType?: string
      }
    ) => {
      const id = `buffer-${crypto.randomUUID().slice(0, 8)}`
      const now = new Date().toISOString()

      const meta: WorkspaceBufferMeta = {
        id,
        type,
        name,
        uri,
        ysweetDocId: options?.ysweetDocId,
        documentId: options?.documentId,
        filePath: options?.filePath,
        mimeType: options?.mimeType,
        createdAt: now,
        modifiedAt: now,
      }

      c.state.buffers[id] = { meta, refCount: 1, openedBy: [userId] }
      c.broadcast('bufferCreated', { bufferId: id, meta, userId })

      return meta
    },

    /**
     * Open an existing buffer (increment ref count).
     */
    openBuffer: (c, userId: string, bufferId: string) => {
      const buffer = c.state.buffers[bufferId]
      if (!buffer) {
        throw new Error(`Buffer not found: ${bufferId}`)
      }

      buffer.refCount++
      if (!buffer.openedBy.includes(userId)) {
        buffer.openedBy.push(userId)
      }

      c.broadcast('bufferOpened', { bufferId, userId })
      return buffer.meta
    },

    /**
     * Close a buffer (decrement ref count, GC when 0).
     */
    closeBuffer: (c, userId: string, bufferId: string) => {
      const buffer = c.state.buffers[bufferId]
      if (!buffer) return

      buffer.refCount = Math.max(0, buffer.refCount - 1)
      buffer.openedBy = buffer.openedBy.filter((id) => id !== userId)

      if (buffer.refCount === 0) {
        delete c.state.buffers[bufferId]
        c.broadcast('bufferClosed', { bufferId })
      }
    },

    /**
     * Get a buffer by ID.
     */
    getBuffer: (c, bufferId: string) => {
      return c.state.buffers[bufferId]?.meta ?? null
    },

    /**
     * Get a buffer by URI.
     */
    getByUri: (c, uri: string) => {
      const entry = Object.values(c.state.buffers).find((b) => b.meta.uri === uri)
      return entry?.meta ?? null
    },

    /**
     * List all buffers.
     */
    listBuffers: (c) => {
      return Object.values(c.state.buffers).map((b) => b.meta)
    },

    /**
     * Get buffer stats.
     */
    getStats: (c) => {
      const buffers = Object.values(c.state.buffers)
      return {
        total: buffers.length,
        byType: buffers.reduce(
          (acc, b) => {
            acc[b.meta.type] = (acc[b.meta.type] || 0) + 1
            return acc
          },
          {} as Record<string, number>
        ),
      }
    },
  },
})
