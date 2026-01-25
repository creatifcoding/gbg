/**
 * BufferProvider
 *
 * React context provider for the buffer system.
 * Sets up GC intervals and exposes buffer operations.
 *
 * NOTE: Uses the shared overlayRegistry (aliased as bufferRegistry)
 * so buffer atoms integrate with the existing overlay system.
 *
 * @module lib/buffer/components/BufferProvider
 */

import * as React from 'react'
import { createContext, useContext, useEffect, useRef, useMemo, useCallback } from 'react'
import { RegistryContext } from '@effect-atom/atom-react'
import { Effect, Runtime, Layer } from 'effect'
import { bufferRegistry } from '../atoms'
import {
  BufferService,
  BufferServiceLive,
  type BufferServiceShape,
} from '../services/BufferService'
import { CollaborationService } from '@/lib/editor/v3/services/CollaborationService'
import type { BufferId, BufferState, BufferType, WindowId, WindowState } from '../schemas'

// =============================================================================
// Configuration
// =============================================================================

export interface BufferProviderConfig {
  /**
   * GC interval in milliseconds.
   * How often to run garbage collection for unreferenced buffers.
   * Default: 30000 (30 seconds)
   */
  gcIntervalMs?: number

  /**
   * Enable debug logging.
   * Default: false (true in DEV)
   */
  debug?: boolean
}

// =============================================================================
// Context Types
// =============================================================================

export interface BufferContextValue {
  /**
   * Create a new buffer.
   */
  createBuffer: (
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
  ) => Promise<BufferState>

  /**
   * Get or create a buffer by URI.
   * Idempotent — returns existing buffer if already open.
   */
  getOrCreateBuffer: (
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
  ) => Promise<BufferState>

  /**
   * Open an existing buffer (increment refCount).
   */
  openBuffer: (bufferId: BufferId) => Promise<BufferState>

  /**
   * Close a buffer (decrement refCount).
   */
  closeBuffer: (bufferId: BufferId) => Promise<void>

  /**
   * Get buffer by ID.
   */
  getBuffer: (bufferId: BufferId) => Promise<BufferState | null>

  /**
   * Get buffer by URI.
   */
  getBufferByUri: (uri: string) => Promise<BufferState | null>

  /**
   * Create a window for a buffer.
   */
  createWindow: (bufferId: BufferId, majorMode?: string) => Promise<WindowState>

  /**
   * Close a window.
   */
  closeWindow: (windowId: WindowId) => Promise<void>

  /**
   * Mark buffer as dirty.
   */
  markDirty: (bufferId: BufferId) => Promise<void>

  /**
   * Mark buffer as clean.
   */
  markClean: (bufferId: BufferId) => Promise<void>

  /**
   * Force garbage collection.
   */
  gc: () => Promise<number>

  /**
   * Whether the buffer system is ready.
   */
  isReady: boolean
}

// =============================================================================
// Context
// =============================================================================

const BufferContext = createContext<BufferContextValue | null>(null)

// =============================================================================
// Provider Component
// =============================================================================

export interface BufferProviderProps {
  children: React.ReactNode
  config?: BufferProviderConfig
}

export function BufferProvider({ children, config }: BufferProviderProps) {
  const gcIntervalMs = config?.gcIntervalMs ?? 30000
  const debug = config?.debug ?? import.meta.env.DEV

  // Build runtime once
  const runtimeRef = useRef<Runtime.Runtime<BufferService> | null>(null)
  const [isReady, setIsReady] = React.useState(false)

  // Initialize runtime
  useEffect(() => {
    const layer = Layer.mergeAll(BufferServiceLive, CollaborationService.Default)

    Effect.runPromise(
      Layer.toRuntime(layer).pipe(Effect.scoped, Effect.map((rt) => rt))
    )
      .then((rt) => {
        runtimeRef.current = rt as any
        setIsReady(true)
        if (debug) {
          console.log('[BufferProvider] Runtime initialized')
        }
      })
      .catch((err) => {
        console.error('[BufferProvider] Failed to initialize runtime:', err)
      })

    return () => {
      // Cleanup runtime on unmount
      runtimeRef.current = null
      setIsReady(false)
    }
  }, [debug])

  // GC interval
  useEffect(() => {
    if (!isReady || !runtimeRef.current) return

    const interval = setInterval(() => {
      const runtime = runtimeRef.current
      if (!runtime) return

      Effect.runPromise(
        Effect.gen(function* () {
          const service = yield* BufferService
          return yield* service.gc()
        }).pipe(Effect.provide(runtime as any))
      )
        .then((collected) => {
          if (debug && collected > 0) {
            console.log('[BufferProvider] GC collected', collected, 'buffers')
          }
        })
        .catch((err) => {
          console.error('[BufferProvider] GC error:', err)
        })
    }, gcIntervalMs)

    return () => clearInterval(interval)
  }, [isReady, gcIntervalMs, debug])

  // Helper to run effects
  const runEffect = useCallback(
    <A, E>(effect: Effect.Effect<A, E, BufferService>): Promise<A> => {
      const runtime = runtimeRef.current
      if (!runtime) {
        return Promise.reject(new Error('Buffer runtime not initialized'))
      }
      return Effect.runPromise(effect.pipe(Effect.provide(runtime as any)))
    },
    []
  )

  // Context value
  const contextValue = useMemo<BufferContextValue>(
    () => ({
      createBuffer: (type, name, uri, options) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            return yield* service.create(type, name, uri, options)
          })
        ),

      getOrCreateBuffer: (type, name, uri, options) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            return yield* service.getOrCreate(type, name, uri, options)
          })
        ),

      openBuffer: (bufferId) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            return yield* service.open(bufferId)
          })
        ),

      closeBuffer: (bufferId) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            yield* service.close(bufferId)
          })
        ),

      getBuffer: (bufferId) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            return yield* service.get(bufferId)
          })
        ).catch(() => null),

      getBufferByUri: (uri) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            return yield* service.getByUri(uri)
          })
        ),

      createWindow: (bufferId, majorMode) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            return yield* service.createWindow(bufferId, majorMode)
          })
        ),

      closeWindow: (windowId) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            yield* service.closeWindow(windowId)
          })
        ),

      markDirty: (bufferId) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            yield* service.markDirty(bufferId)
          })
        ),

      markClean: (bufferId) =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            yield* service.markClean(bufferId)
          })
        ),

      gc: () =>
        runEffect(
          Effect.gen(function* () {
            const service = yield* BufferService
            return yield* service.gc()
          })
        ),

      isReady,
    }),
    [runEffect, isReady]
  )

  return (
    <RegistryContext.Provider value={bufferRegistry}>
      <BufferContext.Provider value={contextValue}>{children}</BufferContext.Provider>
    </RegistryContext.Provider>
  )
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access the buffer context.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const buffer = useBufferContext()
 *
 *   const handleOpen = async () => {
 *     const state = await buffer.getOrCreateBuffer('document', 'untitled', 'ydoc://new')
 *     console.log('Opened buffer:', state.meta.id)
 *   }
 * }
 * ```
 */
export function useBufferContext(): BufferContextValue {
  const context = useContext(BufferContext)
  if (!context) {
    throw new Error('useBufferContext must be used within a BufferProvider')
  }
  return context
}

/**
 * Check if buffer system is ready.
 */
export function useBufferReady(): boolean {
  const context = useContext(BufferContext)
  return context?.isReady ?? false
}
