/**
 * ActorProvider
 *
 * React context provider for Effect-based actor services.
 * Replaces RivetKit with pure Effect persistence via @effect/sql-sqlite-wasm.
 *
 * @module lib/actors/components/ActorProvider
 */

import * as React from 'react'
import { createContext, useContext, useEffect, useRef, useMemo, useCallback, useState } from 'react'
import { Effect, Layer, ManagedRuntime } from 'effect'
import {
  WorkspaceService,
  WorkspaceServiceLive,
  SessionServiceFactory,
  SessionServiceFactoryLive,
  ActorPersistenceLayer,
  type WorkspaceServiceShape,
  type SessionServiceShape,
} from '../services'
import type { UserId } from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface ActorProviderProps {
  children: React.ReactNode
  /** Enable debug logging */
  debug?: boolean
}

export interface ActorContextValue {
  /** Whether the actor system is ready */
  isReady: boolean
  /** Workspace service for shared buffer registry */
  workspace: WorkspaceServiceShape | null
  /** Get session service for a specific user */
  getSession: (userId: UserId) => Promise<SessionServiceShape>
}

// =============================================================================
// Context
// =============================================================================

const ActorContext = createContext<ActorContextValue | null>(null)

// =============================================================================
// Layer Composition
// =============================================================================

/** Full service layer with all dependencies */
const ActorServicesLayer = Layer.mergeAll(
  WorkspaceServiceLive,
  SessionServiceFactoryLive
).pipe(Layer.provide(ActorPersistenceLayer))

type ActorServices = WorkspaceService | SessionServiceFactory

// =============================================================================
// Provider Component
// =============================================================================

export function ActorProvider({ children, debug = import.meta.env.DEV }: ActorProviderProps) {
  const [isReady, setIsReady] = useState(false)
  const [workspace, setWorkspace] = useState<WorkspaceServiceShape | null>(null)
  const runtimeRef = useRef<ManagedRuntime.ManagedRuntime<ActorServices, never> | null>(null)
  const sessionFactoryRef = useRef<SessionServiceFactory['Type'] | null>(null)

  // Initialize runtime
  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        // Create managed runtime
        const managedRuntime = ManagedRuntime.make(ActorServicesLayer)
        runtimeRef.current = managedRuntime

        // Get services
        const [ws, sf] = await managedRuntime.runPromise(
          Effect.all([
            Effect.gen(function* () {
              return yield* WorkspaceService
            }),
            Effect.gen(function* () {
              return yield* SessionServiceFactory
            }),
          ])
        )

        if (mounted) {
          setWorkspace(ws)
          sessionFactoryRef.current = sf
          setIsReady(true)
          if (debug) {
            console.log('[ActorProvider] Services initialized (Effect + SQLite WASM)')
          }
        }
      } catch (err) {
        console.error('[ActorProvider] Failed to initialize:', err)
      }
    }

    init()

    return () => {
      mounted = false
      // Dispose managed runtime
      const runtime = runtimeRef.current
      runtimeRef.current = null
      if (runtime) {
        // dispose() returns Promise<void>, not Effect
        runtime.dispose().catch((e) => {
          console.error('[ActorProvider] Dispose error:', e)
        })
      }
      setIsReady(false)
      setWorkspace(null)
    }
  }, [debug])

  // Get session for user
  const getSession = useCallback(
    async (userId: UserId): Promise<SessionServiceShape> => {
      const factory = sessionFactoryRef.current
      const runtime = runtimeRef.current

      if (!factory || !runtime) {
        throw new Error('Actor system not initialized')
      }

      return runtime.runPromise(factory.forUser(userId))
    },
    []
  )

  // Context value
  const contextValue = useMemo<ActorContextValue>(
    () => ({
      isReady,
      workspace,
      getSession,
    }),
    [isReady, workspace, getSession]
  )

  return <ActorContext.Provider value={contextValue}>{children}</ActorContext.Provider>
}

// =============================================================================
// Hooks
// =============================================================================

/**
 * Access the actor context.
 *
 * @throws Error if used outside ActorProvider
 */
export function useActorContext(): ActorContextValue {
  const ctx = useContext(ActorContext)
  if (!ctx) {
    throw new Error('useActorContext must be used within ActorProvider')
  }
  return ctx
}

/**
 * Check if actor system is ready.
 */
export function useActorReady(): boolean {
  const ctx = useContext(ActorContext)
  return ctx?.isReady ?? false
}

/**
 * Access workspace service directly.
 *
 * @throws Error if workspace is not ready
 */
export function useWorkspaceService(): WorkspaceServiceShape {
  const ctx = useActorContext()
  if (!ctx.workspace) {
    throw new Error('Workspace service not ready')
  }
  return ctx.workspace
}
