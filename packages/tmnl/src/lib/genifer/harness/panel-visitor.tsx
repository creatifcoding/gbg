/**
 * Genifer Panel Visitor — Renders a Genifer surface inside a floating panel.
 *
 * Registered in panelRegistry as 'genifer:surface'. When spawned, receives
 * a surfaceId via panel data, hydrates the surface, and renders it.
 *
 * Agent flow:
 *   1. Agent calls genifer_generate with target: 'panel'
 *   2. Tool creates surface, calls spawnPanel('genifer:surface', { data: { surfaceId } })
 *   3. This visitor renders inside the floating panel
 *   4. Agent calls genifer_refine with surfaceId → panel updates reactively
 *
 * @module genifer/harness/panel-visitor
 */

import { type FC, useMemo } from 'react'
import { useAtomValue, Atom, Registry, RegistryContext } from '@effect-atom/atom-react'
import type { PanelContentProps } from '@/lib/floating/panel-registry'
import { panelRegistry } from '@/lib/floating/panel-registry'
import type { GeniferSurface } from './surface'
import { SurfaceRenderer } from '@/lib/genifer/react/SurfaceRenderer'
import { useIncrementalTree } from '@/lib/genifer/react/incremental-tree'

// ─────────────────────────────────────────────────────────────────────────────
// Panel data shape
// ─────────────────────────────────────────────────────────────────────────────

export interface GeniferPanelData {
  /** Surface ID to render */
  surfaceId: string
  /** Optional initial prompt (for display) */
  prompt?: string
  /** Thread ID for continuity */
  threadId?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface atom family — per-surfaceId reactive state
// ─────────────────────────────────────────────────────────────────────────────

/** Atom family keyed by surfaceId — holds the latest surface object */
export const geniferPanelSurfaces = Atom.family(
  (_surfaceId: string) => Atom.make<GeniferSurface | null>(null),
)

/**
 * Dedicated default registry for Genifer panel surfaces.
 *
 * Floating panels are often rendered under the panel overlay registry, while
 * MorphChat harness code mutates MorphChat's registry directly. The panel
 * visitor therefore must not rely on the nearest React RegistryContext; it
 * explicitly reads from the same registry that `setGeniferPanelSurface` writes.
 */
export const geniferPanelRegistry = Registry.make()

var _registry: Registry.Registry = geniferPanelRegistry

export function setGeniferPanelRegistry(registry: Registry.Registry): void {
  _registry = registry
}

export function getGeniferPanelRegistry(): Registry.Registry {
  return _registry
}

export function setGeniferPanelSurface(surfaceId: string, surface: GeniferSurface): void {
  getGeniferPanelRegistry().set(geniferPanelSurfaces(surfaceId), surface)
}

// ─────────────────────────────────────────────────────────────────────────────
// Visitor Component
// ─────────────────────────────────────────────────────────────────────────────

export const GeniferPanelVisitor: FC<PanelContentProps> = ({ panelId, data }) => {
  const panelData = data as GeniferPanelData | undefined

  if (!panelData?.surfaceId) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 font-mono"
           style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}>
        No surface ID provided
      </div>
    )
  }

  return (
    <RegistryContext.Provider value={getGeniferPanelRegistry()}>
      <GeniferPanelContent surfaceId={panelData.surfaceId} prompt={panelData.prompt} />
    </RegistryContext.Provider>
  )
}

GeniferPanelVisitor.displayName = 'GeniferPanelVisitor'

// ─────────────────────────────────────────────────────────────────────────────
// Inner content — reads surface atom, renders tree
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Progressive panel content — three rendering phases:
 *
 *   1. **Skeleton** — surface is null (allocateStreamingSurface not yet called,
 *      or atom hasn't propagated). Shows animated placeholder.
 *
 *   2. **Partial tree** — surface exists with status:'streaming'. The
 *      GeniferSurfaceRenderer feeds incremental patches via useIncrementalTree
 *      into SurfaceRenderer with loading=true. Elements render as they arrive.
 *      No bindings yet (empty dataBindings/actionBindings), BehaviorProvider
 *      walks the partial tree.
 *
 *   3. **Full render** — surface promoted to status:'complete'. Full tree with
 *      materialized bindings, BehaviorProvider resolves all sigils, no loading
 *      state.
 */
const GeniferPanelContent: FC<{ surfaceId: string; prompt?: string }> = ({ surfaceId, prompt }) => {
  const surface$ = useMemo(() => geniferPanelSurfaces(surfaceId), [surfaceId])
  const surface = useAtomValue(surface$)

  // Phase 1: Skeleton — no surface yet
  if (!surface) {
    return <StreamingSkeleton prompt={prompt} phase="allocating" />
  }

  // Phase 2 & 3: Surface exists — delegate to GeniferSurfaceRenderer
  // which handles the streaming→complete transition via useIncrementalTree
  return (
    <div
      data-genifer-panel
      data-surface-id={surfaceId}
      data-surface-status={surface.status}
      className="h-full overflow-auto p-3"
    >
      <GeniferSurfaceRenderer surface={surface} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming Skeleton — animated placeholder during allocation/early streaming
// ─────────────────────────────────────────────────────────────────────────────

const StreamingSkeleton: FC<{ prompt?: string; phase: 'allocating' | 'streaming' }> = ({ prompt, phase }) => (
  <div className="flex flex-col items-center justify-center h-full gap-3 p-4">
    {/* Scanning bar */}
    <div className="w-full max-w-[200px] h-[2px] overflow-hidden rounded-full bg-neutral-800">
      <div
        className="h-full rounded-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(34, 211, 238, 0.6), transparent)',
          animation: 'genifer-scan 1.5s ease-in-out infinite',
          width: '40%',
        }}
      />
    </div>
    <style>{`@keyframes genifer-scan { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>

    {/* Status */}
    <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}>
      {phase === 'allocating' ? 'Initializing surface…' : 'Streaming elements…'}
    </span>

    {/* Prompt echo */}
    {prompt && (
      <span
        className="text-neutral-600 font-mono text-center max-w-[300px] truncate"
        style={{ fontSize: 'var(--tmnl-text-xs, 10px)' }}
      >
        "{prompt}"
      </span>
    )}

    {/* Skeleton blocks — visual hint that content is coming */}
    <div className="w-full max-w-[320px] flex flex-col gap-2 mt-2">
      {[0.7, 1, 0.5].map((w, i) => (
        <div
          key={i}
          className="animate-pulse rounded"
          style={{
            height: 16 + i * 8,
            width: `${w * 100}%`,
            background: 'rgba(120, 113, 108, 0.12)',
            animationDelay: `${i * 150}ms`,
          }}
        />
      ))}
    </div>
  </div>
)

// ─────────────────────────────────────────────────────────────────────────────
// Surface Renderer — bridges to genifer's react Renderer
// ─────────────────────────────────────────────────────────────────────────────

const GeniferSurfaceRenderer: FC<{ surface: GeniferSurface }> = ({ surface }) => {
  const tree = useIncrementalTree({
    treeSnapshot: (surface as any).treeSnapshot,
    treePatch: (surface as any).treePatch,
    patchSeq: typeof (surface as any).patchSeq === 'number' ? (surface as any).patchSeq : undefined,
    streamKey: `panel-surface:${surface.id}:v${surface.version}`,
  })

  const isStreaming = surface.status === 'streaming'

  // During streaming with no tree yet, show the streaming skeleton
  // Once the first patch arrives, useIncrementalTree returns a tree
  // and SurfaceRenderer takes over with loading=true
  if (isStreaming && !tree) {
    return <StreamingSkeleton phase="streaming" />
  }

  return (
    <SurfaceRenderer
      surface={surface}
      tree={tree}
      showRefineBar={!isStreaming}
      disableAnimations={isStreaming}
      className="m-0"
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration — call once at app startup
// ─────────────────────────────────────────────────────────────────────────────

let _visitorRegistered = false

export function registerGeniferPanelVisitor(): void {
  if (_visitorRegistered && panelRegistry.has('genifer:surface')) return

  panelRegistry.register('genifer:surface', {
    label: 'Genifer Surface',
    icon: '✨',
    description: 'AI-generated interactive UI surface',
    category: 'genifer',
    component: GeniferPanelVisitor,
    stateTier: 'full', // keep alive — surfaces have live bindings
    defaults: {
      width: 480,
      height: 400,
      mode: 'floating',
      accent: '#22d3ee', // cyan
    },
  })

  _visitorRegistered = true
}
