/**
 * MorphChat Surface Context
 *
 * React context for the MorphChat surface. All child components
 * access spec, adapter, and machine through this context.
 *
 * @module morphchat/components/surface-context
 */

import { createContext, useContext } from 'react'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'
import type { MorphChatAdapter } from '../schemas/adapter-types'
import type { SurfaceId } from '../atoms/surface-atoms'
import type { SurfaceActor } from '../machines/surface-stx'

// =============================================================================
// Context Value
// =============================================================================

export interface MorphChatContextValue {
  /** Surface instance ID */
  readonly surfaceId: SurfaceId

  /** Active surface spec (reactive — changes on morph) */
  readonly spec: ChatSurfaceSpec

  /** Data adapter */
  readonly adapter: MorphChatAdapter

  /** XState machine actor */
  readonly actor: SurfaceActor

  /** Whether surface is currently morphing between specs */
  readonly isMorphing: boolean

  /** Previous spec (for transition animation context) */
  readonly previousSpec: ChatSurfaceSpec | null

  /** Request a morph to a different spec */
  readonly requestMorph: (targetSpec: ChatSurfaceSpec, trigger?: string) => void

  /** Request disconnect */
  readonly requestDisconnect: () => void
}

// =============================================================================
// Context
// =============================================================================

export const MorphChatContext = createContext<MorphChatContextValue | null>(null)
MorphChatContext.displayName = 'MorphChatContext'

// =============================================================================
// Hook
// =============================================================================

/**
 * Access MorphChat surface context from any child component.
 *
 * Throws if used outside a `<MorphChat.Surface>` provider.
 */
export function useMorphChatContext(): MorphChatContextValue {
  const ctx = useContext(MorphChatContext)
  if (!ctx) {
    throw new Error(
      'useMorphChatContext must be used within a <MorphChat.Surface> provider',
    )
  }
  return ctx
}
