/**
 * BufferService
 *
 * Effect.Service for buffer lifecycle management.
 * Wraps CollaborationService for Y.Doc integration.
 *
 * Responsibilities:
 * - Buffer creation, opening, closing
 * - Reference counting for garbage collection
 * - Y.Doc lifecycle for CRDT-backed buffers
 * - Atom state synchronization
 *
 * NOTE: State lives in ATOMS (Atom-as-State pattern).
 * This service mutates atoms via registry.set().
 *
 * @module lib/buffer/services/BufferService
 */

import { Effect, Layer, Context, Data } from 'effect'
import * as Y from 'yjs'
import type { ClientToken } from '@y-sweet/sdk'
import { CollaborationService } from '@/lib/editor/v3/services/CollaborationService'
import {
  type BufferId,
  type BufferState,
  type BufferType,
  type BufferMeta,
  type WindowId,
  type WindowState,
  generateBufferId,
  createBufferMeta,
  createBufferState,
  createWindowState,
} from '../schemas'
import {
  bufferRegistry,
  buffersAtom,
  windowsAtom,
  addBuffer,
  updateBuffer,
  removeBuffer,
  addWindow,
  removeWindow,
} from '../atoms'

// =============================================================================
// Errors
// =============================================================================

export class BufferNotFoundError extends Data.TaggedError('BufferNotFoundError')<{
  readonly bufferId: BufferId
}> {
  get message() {
    return `Buffer not found: ${this.bufferId}`
  }
}

export class BufferConnectionError extends Data.TaggedError('BufferConnectionError')<{
  readonly bufferId: BufferId
  readonly cause: string
}> {
  get message() {
    return `Buffer connection error for ${this.bufferId}: ${this.cause}`
  }
}

export class BufferAlreadyExistsError extends Data.TaggedError('BufferAlreadyExistsError')<{
  readonly uri: string
}> {
  get message() {
    return `Buffer already exists for URI: ${this.uri}`
  }
}

// =============================================================================
// Configuration
// =============================================================================

export interface BufferServiceConfig {
  /**
   * Time in ms before garbage collecting unreferenced buffers.
   * Default: 60000 (1 minute)
   */
  readonly gcDelayMs: number

  /**
   * Auto-save interval in ms for dirty buffers.
   * Default: 5000 (5 seconds)
   */
  readonly autoSaveIntervalMs: number
}

export class BufferServiceConfigTag extends Context.Tag('tmnl/buffer/BufferServiceConfig')<
  BufferServiceConfigTag,
  BufferServiceConfig
>() {
  static readonly Default = Layer.succeed(this, {
    gcDelayMs: 60000,
    autoSaveIntervalMs: 5000,
  })

  static readonly Custom = (config: BufferServiceConfig) => Layer.succeed(this, config)
}

// =============================================================================
// Service Interface
// =============================================================================

export interface BufferServiceShape {
  /**
   * Create a new buffer.
   *
   * For CRDT-backed types (document, canvas), creates Y.Doc.
   * For lightweight types (terminal, webview, widget), creates metadata only.
   */
  readonly create: (
    type: BufferType,
    name: string,
    uri: string,
    options?: {
      ysweetDocId?: string
      documentId?: string
      filePath?: string
      mimeType?: string
      metadata?: Record<string, unknown>
    }
  ) => Effect.Effect<BufferState, BufferAlreadyExistsError | BufferConnectionError>

  /**
   * Open an existing buffer by ID.
   * Increments reference count.
   */
  readonly open: (bufferId: BufferId) => Effect.Effect<BufferState, BufferNotFoundError>

  /**
   * Close a buffer.
   * Decrements reference count. GC'd when refCount reaches 0.
   */
  readonly close: (bufferId: BufferId) => Effect.Effect<void, BufferNotFoundError>

  /**
   * Get buffer state by ID.
   */
  readonly get: (bufferId: BufferId) => Effect.Effect<BufferState, BufferNotFoundError>

  /**
   * Get buffer by URI (if it exists).
   */
  readonly getByUri: (uri: string) => Effect.Effect<BufferState | null, never>

  /**
   * Get Y.Doc for a buffer (for CRDT-backed buffers only).
   */
  readonly getDoc: (bufferId: BufferId) => Effect.Effect<Y.Doc | null, BufferNotFoundError>

  /**
   * Get or create buffer by URI.
   * Idempotent — returns existing buffer if already open.
   */
  readonly getOrCreate: (
    type: BufferType,
    name: string,
    uri: string,
    options?: {
      ysweetDocId?: string
      documentId?: string
      filePath?: string
      mimeType?: string
      metadata?: Record<string, unknown>
    }
  ) => Effect.Effect<BufferState, BufferConnectionError>

  /**
   * List all loaded buffer IDs.
   */
  readonly list: () => Effect.Effect<readonly BufferId[], never>

  /**
   * List all loaded buffer states.
   */
  readonly listStates: () => Effect.Effect<readonly BufferState[], never>

  /**
   * Update buffer metadata.
   */
  readonly updateMeta: (
    bufferId: BufferId,
    updates: Partial<Pick<BufferMeta, 'name' | 'mimeType' | 'metadata'>>
  ) => Effect.Effect<BufferState, BufferNotFoundError>

  /**
   * Mark buffer as dirty (has unsaved changes).
   */
  readonly markDirty: (bufferId: BufferId) => Effect.Effect<void, BufferNotFoundError>

  /**
   * Mark buffer as clean (saved).
   */
  readonly markClean: (bufferId: BufferId) => Effect.Effect<void, BufferNotFoundError>

  /**
   * Force garbage collection of unreferenced buffers.
   * Returns count of collected buffers.
   */
  readonly gc: () => Effect.Effect<number, never>

  /**
   * Create a window for a buffer.
   */
  readonly createWindow: (
    bufferId: BufferId,
    majorMode?: string
  ) => Effect.Effect<WindowState, BufferNotFoundError>

  /**
   * Close a window.
   * Decrements buffer refCount.
   */
  readonly closeWindow: (windowId: WindowId) => Effect.Effect<void, never>

  /**
   * Get Y-Sweet client token for a buffer.
   * For CRDT-backed buffers only.
   */
  readonly getClientToken: (
    bufferId: BufferId
  ) => Effect.Effect<ClientToken | null, BufferNotFoundError | BufferConnectionError>
}

// =============================================================================
// Service Implementation
// =============================================================================

export class BufferService extends Effect.Service<BufferService>()('tmnl/buffer/BufferService', {
  effect: Effect.gen(function* () {
    const config = yield* BufferServiceConfigTag
    const collaboration = yield* CollaborationService

    // In-memory buffer → Y.Doc mapping
    const docs = new Map<BufferId, Y.Doc>()

    // URI → BufferId index for deduplication
    const uriIndex = new Map<string, BufferId>()

    // GC queue: buffers pending garbage collection
    const gcQueue = new Map<BufferId, number>() // bufferId → timestamp when refCount hit 0

    // ==========================================================================
    // Internal Helpers
    // ==========================================================================

    const isCrdtBackedType = (type: BufferType): boolean =>
      type === 'document' || type === 'canvas'

    const getCurrentBuffers = (): ReadonlyMap<BufferId, BufferState> =>
      bufferRegistry.get(buffersAtom)

    const getCurrentWindows = (): ReadonlyMap<WindowId, WindowState> =>
      bufferRegistry.get(windowsAtom)

    // ==========================================================================
    // Service Methods
    // ==========================================================================

    const create: BufferServiceShape['create'] = (type, name, uri, options) =>
      Effect.gen(function* () {
        // Check for existing buffer with same URI
        const existing = uriIndex.get(uri)
        if (existing) {
          return yield* Effect.fail(new BufferAlreadyExistsError({ uri }))
        }

        // Create metadata
        const meta = createBufferMeta(type, name, uri, options)
        const state = createBufferState(meta)

        // For CRDT-backed buffers, get token and create Y.Doc
        if (isCrdtBackedType(type)) {
          const docId = options?.ysweetDocId ?? meta.id

          // Update connection state
          const connectingState: BufferState = {
            ...state,
            connectionState: 'connecting',
          }

          try {
            // Get token from y-sweet
            const token = yield* collaboration.getClientToken(docId).pipe(
              Effect.mapError(
                (err) =>
                  new BufferConnectionError({
                    bufferId: meta.id,
                    cause: err.message,
                  })
              )
            )

            // Create Y.Doc
            const doc = yield* collaboration.createDoc()
            docs.set(meta.id, doc)

            // Update state to synced
            const syncedState: BufferState = {
              ...state,
              meta: { ...meta, ysweetDocId: docId },
              connectionState: 'synced',
              lastSync: Date.now(),
            }

            // Update atoms
            bufferRegistry.set(buffersAtom, addBuffer(getCurrentBuffers(), syncedState))
            uriIndex.set(uri, meta.id)

            console.log('[BufferService] Created CRDT buffer:', meta.id, uri)
            return syncedState
          } catch (err) {
            // Connection failed
            const errorState: BufferState = {
              ...state,
              connectionState: 'error',
              error: err instanceof Error ? err.message : String(err),
            }
            bufferRegistry.set(buffersAtom, addBuffer(getCurrentBuffers(), errorState))
            uriIndex.set(uri, meta.id)
            return errorState
          }
        }

        // Lightweight buffer (no Y.Doc)
        bufferRegistry.set(buffersAtom, addBuffer(getCurrentBuffers(), state))
        uriIndex.set(uri, meta.id)

        console.log('[BufferService] Created lightweight buffer:', meta.id, uri)
        return state
      })

    const open: BufferServiceShape['open'] = (bufferId) =>
      Effect.gen(function* () {
        const buffers = getCurrentBuffers()
        const buffer = buffers.get(bufferId)

        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }

        // Increment refCount
        const updated: BufferState = {
          ...buffer,
          refCount: buffer.refCount + 1,
        }

        bufferRegistry.set(buffersAtom, updateBuffer(buffers, bufferId, () => updated))

        // Remove from GC queue if present
        gcQueue.delete(bufferId)

        console.log('[BufferService] Opened buffer:', bufferId, 'refCount:', updated.refCount)
        return updated
      })

    const close: BufferServiceShape['close'] = (bufferId) =>
      Effect.gen(function* () {
        const buffers = getCurrentBuffers()
        const buffer = buffers.get(bufferId)

        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }

        // Decrement refCount
        const newRefCount = Math.max(0, buffer.refCount - 1)
        const updated: BufferState = {
          ...buffer,
          refCount: newRefCount,
        }

        bufferRegistry.set(buffersAtom, updateBuffer(buffers, bufferId, () => updated))

        // Schedule for GC if refCount is 0
        if (newRefCount === 0) {
          gcQueue.set(bufferId, Date.now())
          console.log('[BufferService] Buffer scheduled for GC:', bufferId)
        }

        console.log('[BufferService] Closed buffer:', bufferId, 'refCount:', newRefCount)
      })

    const get: BufferServiceShape['get'] = (bufferId) =>
      Effect.gen(function* () {
        const buffer = getCurrentBuffers().get(bufferId)
        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }
        return buffer
      })

    const getByUri: BufferServiceShape['getByUri'] = (uri) =>
      Effect.sync(() => {
        const bufferId = uriIndex.get(uri)
        if (!bufferId) return null
        return getCurrentBuffers().get(bufferId) ?? null
      })

    const getDoc: BufferServiceShape['getDoc'] = (bufferId) =>
      Effect.gen(function* () {
        const buffer = getCurrentBuffers().get(bufferId)
        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }
        return docs.get(bufferId) ?? null
      })

    const getOrCreate: BufferServiceShape['getOrCreate'] = (type, name, uri, options) =>
      Effect.gen(function* () {
        // Check for existing
        const existing = uriIndex.get(uri)
        if (existing) {
          const buffer = getCurrentBuffers().get(existing)
          if (buffer) {
            // Increment refCount
            yield* open(existing)
            return buffer
          }
        }

        // Create new
        const result = yield* create(type, name, uri, options).pipe(
          Effect.catchTag('BufferAlreadyExistsError', () =>
            // Race condition: another create succeeded between check and create
            Effect.gen(function* () {
              const bufferId = uriIndex.get(uri)!
              return yield* open(bufferId)
            })
          )
        )
        return result
      })

    const list: BufferServiceShape['list'] = () =>
      Effect.sync(() => Array.from(getCurrentBuffers().keys()))

    const listStates: BufferServiceShape['listStates'] = () =>
      Effect.sync(() => Array.from(getCurrentBuffers().values()))

    const updateMeta: BufferServiceShape['updateMeta'] = (bufferId, updates) =>
      Effect.gen(function* () {
        const buffers = getCurrentBuffers()
        const buffer = buffers.get(bufferId)

        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }

        const updated: BufferState = {
          ...buffer,
          meta: {
            ...buffer.meta,
            ...updates,
            modifiedAt: new Date().toISOString() as any,
          },
        }

        bufferRegistry.set(buffersAtom, updateBuffer(buffers, bufferId, () => updated))
        return updated
      })

    const markDirty: BufferServiceShape['markDirty'] = (bufferId) =>
      Effect.gen(function* () {
        const buffers = getCurrentBuffers()
        const buffer = buffers.get(bufferId)

        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }

        bufferRegistry.set(
          buffersAtom,
          updateBuffer(buffers, bufferId, (b) => ({
            ...b,
            isDirty: true,
            pendingChanges: b.pendingChanges + 1,
          }))
        )
      })

    const markClean: BufferServiceShape['markClean'] = (bufferId) =>
      Effect.gen(function* () {
        const buffers = getCurrentBuffers()
        const buffer = buffers.get(bufferId)

        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }

        bufferRegistry.set(
          buffersAtom,
          updateBuffer(buffers, bufferId, (b) => ({
            ...b,
            isDirty: false,
            pendingChanges: 0,
            lastSync: Date.now(),
          }))
        )
      })

    const gc: BufferServiceShape['gc'] = () =>
      Effect.sync(() => {
        const now = Date.now()
        let collected = 0

        for (const [bufferId, timestamp] of gcQueue.entries()) {
          if (now - timestamp >= config.gcDelayMs) {
            const buffer = getCurrentBuffers().get(bufferId)

            // Only GC if still unreferenced
            if (buffer && buffer.refCount === 0) {
              // Destroy Y.Doc if present
              const doc = docs.get(bufferId)
              if (doc) {
                doc.destroy()
                docs.delete(bufferId)
              }

              // Remove from URI index
              uriIndex.delete(buffer.meta.uri)

              // Remove from atom state
              bufferRegistry.set(buffersAtom, removeBuffer(getCurrentBuffers(), bufferId))

              console.log('[BufferService] GC collected buffer:', bufferId)
              collected++
            }

            gcQueue.delete(bufferId)
          }
        }

        if (collected > 0) {
          console.log('[BufferService] GC complete, collected:', collected, 'buffers')
        }

        return collected
      })

    const createWindow: BufferServiceShape['createWindow'] = (bufferId, majorMode) =>
      Effect.gen(function* () {
        // Verify buffer exists
        const buffer = getCurrentBuffers().get(bufferId)
        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }

        // Determine major mode from buffer type if not specified
        const mode = majorMode ?? getMajorModeForBufferType(buffer.meta.type)

        // Create window state
        const window = createWindowState(bufferId, mode)

        // Increment buffer refCount
        yield* open(bufferId)

        // Add window to atom state
        bufferRegistry.set(windowsAtom, addWindow(getCurrentWindows(), window))

        console.log('[BufferService] Created window:', window.id, 'for buffer:', bufferId)
        return window
      })

    const closeWindow: BufferServiceShape['closeWindow'] = (windowId) =>
      Effect.gen(function* () {
        const windows = getCurrentWindows()
        const window = windows.get(windowId)

        if (!window) {
          // Window already closed, no-op
          return
        }

        // Decrement buffer refCount
        yield* close(window.bufferId).pipe(Effect.catchAll(() => Effect.void))

        // Remove window from atom state
        bufferRegistry.set(windowsAtom, removeWindow(windows, windowId))

        console.log('[BufferService] Closed window:', windowId)
      })

    const getClientToken: BufferServiceShape['getClientToken'] = (bufferId) =>
      Effect.gen(function* () {
        const buffer = getCurrentBuffers().get(bufferId)
        if (!buffer) {
          return yield* Effect.fail(new BufferNotFoundError({ bufferId }))
        }

        if (!isCrdtBackedType(buffer.meta.type) || !buffer.meta.ysweetDocId) {
          return null
        }

        const token = yield* collaboration.getClientToken(buffer.meta.ysweetDocId).pipe(
          Effect.mapError(
            (err) =>
              new BufferConnectionError({
                bufferId,
                cause: err.message,
              })
          )
        )

        return token
      })

    return {
      create,
      open,
      close,
      get,
      getByUri,
      getDoc,
      getOrCreate,
      list,
      listStates,
      updateMeta,
      markDirty,
      markClean,
      gc,
      createWindow,
      closeWindow,
      getClientToken,
    } satisfies BufferServiceShape
  }),
  dependencies: [BufferServiceConfigTag.Default, CollaborationService.Default],
}) {}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get default major mode for a buffer type.
 */
function getMajorModeForBufferType(type: BufferType): string {
  switch (type) {
    case 'document':
      return 'markdown'
    case 'canvas':
      return 'canvas'
    case 'terminal':
      return 'shell'
    case 'webview':
      return 'web'
    case 'widget':
      return 'widget'
    case 'file':
      return 'fundamental'
    default:
      return 'fundamental'
  }
}

// =============================================================================
// Layer Exports
// =============================================================================

export const BufferServiceLive = BufferService.Default

export const BufferServiceCustom = (config: BufferServiceConfig) =>
  BufferService.Default.pipe(Layer.provide(BufferServiceConfigTag.Custom(config)))
