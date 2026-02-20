/**
 * MorphChat Surface Context
 *
 * React context for the MorphChat surface. All child components
 * access spec, adapter, and machine through this context.
 *
 * @module morphchat/components/surface-context
 */

import { createContext, useContext, useMemo } from 'react'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'
import type { ContentViewSpec } from '../schemas/content-view-spec'
import { deriveContentViewSpec } from '../schemas/content-view-spec'
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

  /** Content view spec — derived from surface spec, drives compound density/adaptation */
  readonly contentView: ContentViewSpec

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

/**
 * Read the ContentViewSpec derived from the current surface spec.
 *
 * Compounds use this to self-adapt density, interactivity, animation, etc.
 *
 * ```tsx
 * const { density, interactivity } = useContentViewSpec()
 * if (density === 'pill') return <PillView />
 * ```
 */
export function useContentViewSpec(): ContentViewSpec {
  const { contentView } = useMorphChatContext()
  return contentView
}

/**
 * Get the effective density for a specific block type,
 * accounting for per-block overrides.
 */
export function useBlockDensity(
  blockType: 'thinking' | 'tool' | 'code' | 'tokenUsage' | 'fileAttachment',
): ContentViewSpec['density'] {
  const { contentView } = useMorphChatContext()
  return contentView.blockOverrides?.[blockType] ?? contentView.density
}
