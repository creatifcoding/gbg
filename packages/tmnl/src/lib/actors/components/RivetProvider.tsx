/**
 * RivetProvider
 *
 * React context provider for RivetKit actors.
 * Initializes the actor server and provides typed hooks.
 *
 * @module lib/actors/components/RivetProvider
 */

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createClient, createRivetKit } from '@rivetkit/react'
import { actorRegistry, type ActorRegistry } from '../registry'

// =============================================================================
// Types
// =============================================================================

export interface RivetProviderProps {
  children: React.ReactNode
  /** Server URL for production (optional, uses local filesystem in dev) */
  serverUrl?: string
}

export interface RivetContextValue {
  /** Whether the Rivet system is ready */
  isReady: boolean
  /** Typed useActor hook */
  useActor: ReturnType<typeof createRivetKit<ActorRegistry>>['useActor']
  /** Client for direct actor access */
  client: ReturnType<typeof createClient<ActorRegistry>> | null
}

// =============================================================================
// Context
// =============================================================================

const RivetContext = createContext<RivetContextValue | null>(null)

/**
 * Get Rivet context. Throws if used outside RivetProvider.
 */
export function useRivetContext(): RivetContextValue {
  const ctx = useContext(RivetContext)
  if (!ctx) {
    throw new Error('useRivetContext must be used within RivetProvider')
  }
  return ctx
}

/**
 * Check if Rivet system is ready.
 */
export function useRivetReady(): boolean {
  const ctx = useContext(RivetContext)
  return ctx?.isReady ?? false
}

// =============================================================================
// Provider
// =============================================================================

// Lazy-initialized client and hooks
let _client: ReturnType<typeof createClient<ActorRegistry>> | null = null
let _rivetKit: ReturnType<typeof createRivetKit<ActorRegistry>> | null = null

function getOrCreateClient(serverUrl?: string) {
  if (!_client) {
    // In development, filesystem driver is used automatically
    // In production, connect to Rivet Engine via serverUrl
    // Vite uses import.meta.env (prefixed with VITE_)
    const url = serverUrl ?? import.meta.env.VITE_RIVET_ENGINE ?? 'http://localhost:6420'
    _client = createClient<ActorRegistry>(url)
  }
  return _client
}

function getOrCreateRivetKit(client: ReturnType<typeof createClient<ActorRegistry>>) {
  if (!_rivetKit) {
    _rivetKit = createRivetKit(client)
  }
  return _rivetKit
}

/**
 * Rivet actor system provider.
 *
 * Wraps children with actor registry access.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <RivetProvider>
 *       <BufferProvider>
 *         <AppShell>...</AppShell>
 *       </BufferProvider>
 *     </RivetProvider>
 *   )
 * }
 * ```
 */
export function RivetProvider({ children, serverUrl }: RivetProviderProps) {
  const [isReady, setIsReady] = useState(false)

  // Initialize client and kit
  const client = useMemo(() => getOrCreateClient(serverUrl), [serverUrl])
  const rivetKit = useMemo(() => getOrCreateRivetKit(client), [client])

  // Mark ready once client is initialized
  useEffect(() => {
    // Client is created synchronously, but we delay ready state
    // to allow for any async initialization if needed
    const timer = setTimeout(() => {
      setIsReady(true)
    }, 0)

    return () => clearTimeout(timer)
  }, [client])

  // Context value
  const contextValue = useMemo<RivetContextValue>(
    () => ({
      isReady,
      useActor: rivetKit.useActor,
      client,
    }),
    [isReady, rivetKit, client]
  )

  return <RivetContext.Provider value={contextValue}>{children}</RivetContext.Provider>
}

// Re-export useActor for convenience
export { createRivetKit }
