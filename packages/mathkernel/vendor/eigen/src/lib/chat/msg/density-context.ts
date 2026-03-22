/**
 * Block Density Context
 *
 * Optional context for content block compounds to read their density tier.
 * When rendered inside MorphChat, the surface provides density via this context.
 * When rendered standalone, compounds default to 'full'.
 *
 * This avoids a circular dependency between chat/ and morphchat/:
 * - chat/ defines the context
 * - morphchat/ provides the value
 * - compounds read from this context
 *
 * @module chat/msg/density-context
 */

import { createContext, useContext } from 'react'

export type BlockDensity = 'full' | 'compact' | 'pill'

export interface BlockDensityContextValue {
  /** Surface-level density tier */
  readonly density: BlockDensity
  /** Per-block overrides */
  readonly overrides?: Partial<Record<string, BlockDensity>>
  /** Interactivity flags */
  readonly interactivity?: {
    readonly expandCollapse?: boolean
    readonly copyButton?: boolean
    readonly approvalActions?: boolean
    readonly footerActions?: boolean
  }
}

const BlockDensityContext = createContext<BlockDensityContextValue | null>(null)
BlockDensityContext.displayName = 'BlockDensityContext'

export const BlockDensityProvider = BlockDensityContext.Provider

/**
 * Read density for a specific block type.
 * Falls back to surface density, then to 'full'.
 */
export function useBlockDensity(blockType?: string): BlockDensity {
  const ctx = useContext(BlockDensityContext)
  if (!ctx) return 'full'
  if (blockType && ctx.overrides?.[blockType]) {
    return ctx.overrides[blockType]!
  }
  return ctx.density
}

/**
 * Read interactivity flags. Defaults to all-enabled when no context.
 */
export function useBlockInteractivity() {
  const ctx = useContext(BlockDensityContext)
  return ctx?.interactivity ?? {
    expandCollapse: true,
    copyButton: true,
    approvalActions: true,
    footerActions: true,
  }
}
