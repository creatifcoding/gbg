/**
 * MorphChat.Surface — Root Compound Component
 *
 * The top-level provider that wires together:
 * - Spec (active configuration)
 * - Adapter (data operations)
 * - Machine (lifecycle + morph transitions)
 * - Atom registry (state isolation)
 *
 * This is the only component consumers need to mount.
 *
 * ```tsx
 * <MorphChat.Surface
 *   spec={MorphChat.presets.Conductor}
 *   adapter={myChatAdapter}
 * />
 * ```
 *
 * @module morphchat/components/surface-root
 */

import * as React from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'
import type { MorphChatAdapter } from '../schemas/adapter-types'
import { MorphChatRegistryProvider } from '../atoms/registry'
import {
  surfaceId as createSurfaceId,
  activeSpecFamily,
  previousSpecFamily,
  isMorphingFamily,
} from '../atoms/surface-atoms'
import {
  getOrCreateSurfaceActor,
  sendSurfaceEvent,
  disposeSurfaceActor,
} from '../machines/surface-stx'
import { MorphChatContext, type MorphChatContextValue } from './surface-context'
import { SurfaceContent } from './surface-content'

// =============================================================================
// Props
// =============================================================================

export interface MorphChatSurfaceProps {
  /** Surface spec — defines what features are enabled and how */
  spec: ChatSurfaceSpec

  /** Data adapter — provides messages, connection, streaming state */
  adapter: MorphChatAdapter

  /** Unique instance ID (auto-generated if omitted) */
  surfaceId?: string

  /** Callback when morph starts */
  onMorph?: (from: ChatSurfaceSpec, to: ChatSurfaceSpec) => void

  /** Callback when surface errors */
  onError?: (error: string) => void

  /** Children — slot overrides for specific bands */
  children?: React.ReactNode

  /** Additional CSS class on outer wrapper */
  className?: string
}

// =============================================================================
// Stable ID counter
// =============================================================================

let idCounter = 0

// =============================================================================
// Inner Provider (inside registry)
// =============================================================================

function SurfaceProvider({
  spec,
  adapter,
  surfaceId: surfaceIdProp,
  onMorph,
  onError,
  children,
  className,
}: MorphChatSurfaceProps) {
  // Stable surface ID
  const surfId = React.useMemo(
    () => createSurfaceId(surfaceIdProp ?? `morphchat-${++idCounter}`),
    [surfaceIdProp],
  )

  // Create/get XState actor
  const actor = React.useMemo(
    () => getOrCreateSurfaceActor(surfId, spec),
    [surfId, spec],
  )

  // Connect on mount
  React.useEffect(() => {
    sendSurfaceEvent(surfId, { type: 'CONNECT' })
    return () => {
      disposeSurfaceActor(surfId)
    }
  }, [surfId])

  // Sync spec prop changes → MORPH events
  const specRef = React.useRef(spec)
  React.useEffect(() => {
    if (specRef.current._tag !== spec._tag) {
      onMorph?.(specRef.current, spec)
      sendSurfaceEvent(surfId, { type: 'MORPH', targetSpec: spec, trigger: 'prop-change' })
    }
    specRef.current = spec
  }, [spec, surfId, onMorph])

  // Read reactive atoms
  const activeSpec = useAtomValue(activeSpecFamily(surfId))
  const prevSpec = useAtomValue(previousSpecFamily(surfId))
  const isMorphing = useAtomValue(isMorphingFamily(surfId))

  // Resolve active spec: atom state (updated by machine) or prop fallback
  const resolvedSpec = activeSpec ?? spec

  // Morph request handler
  const requestMorph = React.useCallback(
    (targetSpec: ChatSurfaceSpec, trigger?: string) => {
      onMorph?.(resolvedSpec, targetSpec)
      sendSurfaceEvent(surfId, { type: 'MORPH', targetSpec, trigger })
    },
    [surfId, resolvedSpec, onMorph],
  )

  // Disconnect handler
  const requestDisconnect = React.useCallback(() => {
    sendSurfaceEvent(surfId, { type: 'DISCONNECT' })
  }, [surfId])

  // Build context value (stable reference when deps don't change)
  const contextValue = React.useMemo<MorphChatContextValue>(
    () => ({
      surfaceId: surfId,
      spec: resolvedSpec,
      adapter,
      actor,
      isMorphing,
      previousSpec: prevSpec,
      requestMorph,
      requestDisconnect,
    }),
    [surfId, resolvedSpec, adapter, actor, isMorphing, prevSpec, requestMorph, requestDisconnect],
  )

  return (
    <MorphChatContext.Provider value={contextValue}>
      <SurfaceContent className={className}>
        {children}
      </SurfaceContent>
    </MorphChatContext.Provider>
  )
}

// =============================================================================
// Public Surface Component (wraps in registry provider)
// =============================================================================

/**
 * MorphChat.Surface — mount a spec-driven chat surface.
 *
 * Wraps children in both the atom registry provider and the
 * MorphChat context provider. This is the only component
 * consumers need to render.
 */
export function MorphChatSurface(props: MorphChatSurfaceProps) {
  return (
    <MorphChatRegistryProvider>
      <SurfaceProvider {...props} />
    </MorphChatRegistryProvider>
  )
}

MorphChatSurface.displayName = 'MorphChat.Surface'
