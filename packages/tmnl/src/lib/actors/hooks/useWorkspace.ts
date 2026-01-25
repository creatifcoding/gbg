/**
 * useWorkspace Hook
 *
 * React hook for workspace service access.
 * Provides buffer management via Effect-based persistence.
 *
 * @module lib/actors/hooks/useWorkspace
 */

import { useMemo, useCallback } from 'react'
import { Effect } from 'effect'
import { useActorContext, useActorReady } from '../components/ActorProvider'
import type { BufferId, BufferMeta, BufferType, UserId } from '../schemas'
import type { CreateBufferOptions } from '../services'

// =============================================================================
// Types
// =============================================================================

export interface UseWorkspaceOptions {
  /** Workspace ID (currently unused, reserved for multi-workspace) */
  workspaceId?: string
}

export interface UseWorkspaceResult {
  /** Whether the workspace is ready */
  isReady: boolean
  /** Create a new buffer */
  createBuffer: (
    userId: UserId,
    type: BufferType,
    name: string,
    uri: string,
    options?: CreateBufferOptions
  ) => Promise<BufferMeta>
  /** Open an existing buffer */
  openBuffer: (userId: UserId, bufferId: BufferId) => Promise<BufferMeta>
  /** Close a buffer */
  closeBuffer: (userId: UserId, bufferId: BufferId) => Promise<void>
  /** Get buffer by ID */
  getBuffer: (bufferId: BufferId) => Promise<BufferMeta | null>
  /** Get buffer by URI */
  getByUri: (uri: string) => Promise<BufferMeta | null>
  /** List all buffers */
  listBuffers: () => Promise<readonly BufferMeta[]>
  /** Get buffer statistics */
  getStats: () => Promise<{ total: number; byType: Record<string, number> }>
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for workspace service access.
 *
 * Uses Effect-based persistence via @effect/sql-sqlite-wasm.
 *
 * @example
 * ```tsx
 * function BufferManager() {
 *   const { isReady, createBuffer, listBuffers } = useWorkspace()
 *
 *   const handleCreate = async () => {
 *     const buffer = await createBuffer('user-1' as UserId, 'document', 'Untitled', 'ydoc://new')
 *     console.log('Created:', buffer.id)
 *   }
 *
 *   return <button onClick={handleCreate} disabled={!isReady}>New</button>
 * }
 * ```
 */
export function useWorkspace(_options: UseWorkspaceOptions = {}): UseWorkspaceResult {
  const { isReady, workspace } = useActorContext()

  const createBuffer = useCallback(
    async (
      userId: UserId,
      type: BufferType,
      name: string,
      uri: string,
      options?: CreateBufferOptions
    ): Promise<BufferMeta> => {
      if (!workspace) throw new Error('Workspace not ready')
      return Effect.runPromise(workspace.createBuffer(userId, type, name, uri, options))
    },
    [workspace]
  )

  const openBuffer = useCallback(
    async (userId: UserId, bufferId: BufferId): Promise<BufferMeta> => {
      if (!workspace) throw new Error('Workspace not ready')
      return Effect.runPromise(workspace.openBuffer(userId, bufferId))
    },
    [workspace]
  )

  const closeBuffer = useCallback(
    async (userId: UserId, bufferId: BufferId): Promise<void> => {
      if (!workspace) throw new Error('Workspace not ready')
      return Effect.runPromise(workspace.closeBuffer(userId, bufferId))
    },
    [workspace]
  )

  const getBuffer = useCallback(
    async (bufferId: BufferId): Promise<BufferMeta | null> => {
      if (!workspace) throw new Error('Workspace not ready')
      return Effect.runPromise(workspace.getBuffer(bufferId))
    },
    [workspace]
  )

  const getByUri = useCallback(
    async (uri: string): Promise<BufferMeta | null> => {
      if (!workspace) throw new Error('Workspace not ready')
      return Effect.runPromise(workspace.getByUri(uri))
    },
    [workspace]
  )

  const listBuffers = useCallback(async (): Promise<readonly BufferMeta[]> => {
    if (!workspace) throw new Error('Workspace not ready')
    return Effect.runPromise(workspace.listBuffers)
  }, [workspace])

  const getStats = useCallback(async (): Promise<{ total: number; byType: Record<string, number> }> => {
    if (!workspace) throw new Error('Workspace not ready')
    return Effect.runPromise(workspace.getStats)
  }, [workspace])

  return useMemo(
    () => ({
      isReady,
      createBuffer,
      openBuffer,
      closeBuffer,
      getBuffer,
      getByUri,
      listBuffers,
      getStats,
    }),
    [isReady, createBuffer, openBuffer, closeBuffer, getBuffer, getByUri, listBuffers, getStats]
  )
}
