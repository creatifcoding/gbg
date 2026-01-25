/**
 * WorkspaceService
 *
 * Shared buffer registry with real-time sync.
 * Manages buffer lifecycle: create, open (ref++), close (ref--, GC when 0).
 *
 * @module lib/actors/services/WorkspaceService
 */

import { Context, Effect, Layer, PubSub, Schema, Stream, Ref } from 'effect'
import { Atom } from '@effect-atom/atom-react'
import {
  type BufferId,
  type BufferMeta,
  type BufferType,
  type BufferEntry,
  type UserId,
  type WorkspaceState,
  type WorkspaceEvent,
  BufferId as BufferIdSchema,
  UserId as UserIdSchema,
  BufferMeta as BufferMetaSchema,
} from '../schemas'
import { ActorPersistence } from './ActorPersistence'

// =============================================================================
// Types
// =============================================================================

export interface CreateBufferOptions {
  ysweetDocId?: string
  documentId?: string
  filePath?: string
  mimeType?: string
}

export interface WorkspaceServiceShape {
  /** Create a new buffer */
  readonly createBuffer: (
    userId: UserId,
    type: BufferType,
    name: string,
    uri: string,
    options?: CreateBufferOptions
  ) => Effect.Effect<BufferMeta>

  /** Open an existing buffer (increment ref count) */
  readonly openBuffer: (userId: UserId, bufferId: BufferId) => Effect.Effect<BufferMeta>

  /** Close a buffer (decrement ref count, GC when 0) */
  readonly closeBuffer: (userId: UserId, bufferId: BufferId) => Effect.Effect<void>

  /** Get a buffer by ID */
  readonly getBuffer: (bufferId: BufferId) => Effect.Effect<BufferMeta | null>

  /** Get a buffer by URI */
  readonly getByUri: (uri: string) => Effect.Effect<BufferMeta | null>

  /** List all buffers */
  readonly listBuffers: Effect.Effect<readonly BufferMeta[]>

  /** Get buffer stats */
  readonly getStats: Effect.Effect<{ total: number; byType: Record<string, number> }>

  /** Subscribe to workspace events */
  readonly events: Stream.Stream<WorkspaceEvent>

  /** Current state atom (for React integration) */
  readonly stateAtom: Atom.Atom<WorkspaceState>
}

// =============================================================================
// Service Tag
// =============================================================================

export class WorkspaceService extends Context.Tag('WorkspaceService')<
  WorkspaceService,
  WorkspaceServiceShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const generateBufferId = (): BufferId =>
  `buffer-${crypto.randomUUID().slice(0, 8)}` as BufferId

const initialState: WorkspaceState = { buffers: {} as Record<BufferId, BufferEntry> }

const make = Effect.gen(function* () {
  const persistence = yield* ActorPersistence

  // Initialize persistence
  yield* persistence.initialize

  // Load persisted state or use initial
  const persisted = yield* persistence.loadWorkspace
  const initial = persisted ?? initialState

  // State management via Ref
  const stateRef = yield* Ref.make(initial)

  // State atom for React integration
  const stateAtom = Atom.make(initial)

  // Event pub/sub
  const eventHub = yield* PubSub.unbounded<WorkspaceEvent>()

  // Helper to sync state to atom and persistence
  const syncState = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    yield* Atom.set(stateAtom, state)
    yield* persistence.saveWorkspace(state)
  })

  const createBuffer: WorkspaceServiceShape['createBuffer'] = (
    userId,
    type,
    name,
    uri,
    options
  ) =>
    Effect.gen(function* () {
      const id = generateBufferId()
      const now = new Date().toISOString()

      const meta: BufferMeta = {
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

      const entry: BufferEntry = {
        meta,
        refCount: 1,
        openedBy: [userId],
      }

      yield* Ref.update(stateRef, (state) => ({
        ...state,
        buffers: { ...state.buffers, [id]: entry },
      }))

      yield* syncState
      yield* PubSub.publish(eventHub, {
        _tag: 'BufferCreated',
        bufferId: id,
        meta,
        userId,
      })

      return meta
    })

  const openBuffer: WorkspaceServiceShape['openBuffer'] = (userId, bufferId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const entry = state.buffers[bufferId]

      if (!entry) {
        return yield* Effect.fail(new Error(`Buffer not found: ${bufferId}`))
      }

      const updatedEntry: BufferEntry = {
        ...entry,
        refCount: entry.refCount + 1,
        openedBy: entry.openedBy.includes(userId)
          ? entry.openedBy
          : [...entry.openedBy, userId],
      }

      yield* Ref.update(stateRef, (s) => ({
        ...s,
        buffers: { ...s.buffers, [bufferId]: updatedEntry },
      }))

      yield* syncState
      yield* PubSub.publish(eventHub, {
        _tag: 'BufferOpened',
        bufferId,
        userId,
      })

      return updatedEntry.meta
    })

  const closeBuffer: WorkspaceServiceShape['closeBuffer'] = (userId, bufferId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const entry = state.buffers[bufferId]

      if (!entry) return

      const newRefCount = Math.max(0, entry.refCount - 1)

      if (newRefCount === 0) {
        // GC: remove buffer entirely
        yield* Ref.update(stateRef, (s) => {
          const { [bufferId]: _, ...rest } = s.buffers
          return { ...s, buffers: rest }
        })
        yield* PubSub.publish(eventHub, { _tag: 'BufferClosed', bufferId })
      } else {
        yield* Ref.update(stateRef, (s) => ({
          ...s,
          buffers: {
            ...s.buffers,
            [bufferId]: {
              ...entry,
              refCount: newRefCount,
              openedBy: entry.openedBy.filter((id) => id !== userId),
            },
          },
        }))
      }

      yield* syncState
    })

  const getBuffer: WorkspaceServiceShape['getBuffer'] = (bufferId) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      return state.buffers[bufferId]?.meta ?? null
    })

  const getByUri: WorkspaceServiceShape['getByUri'] = (uri) =>
    Effect.gen(function* () {
      const state = yield* Ref.get(stateRef)
      const entry = Object.values(state.buffers).find((b) => b.meta.uri === uri)
      return entry?.meta ?? null
    })

  const listBuffers: WorkspaceServiceShape['listBuffers'] = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    return Object.values(state.buffers).map((b) => b.meta)
  })

  const getStats: WorkspaceServiceShape['getStats'] = Effect.gen(function* () {
    const state = yield* Ref.get(stateRef)
    const entries = Object.values(state.buffers)
    return {
      total: entries.length,
      byType: entries.reduce(
        (acc, b) => {
          acc[b.meta.type] = (acc[b.meta.type] || 0) + 1
          return acc
        },
        {} as Record<string, number>
      ),
    }
  })

  const events = Stream.fromPubSub(eventHub)

  return WorkspaceService.of({
    createBuffer,
    openBuffer,
    closeBuffer,
    getBuffer,
    getByUri,
    listBuffers,
    getStats,
    events,
    stateAtom,
  })
})

// =============================================================================
// Layer
// =============================================================================

export const WorkspaceServiceLive = Layer.effect(WorkspaceService, make)
