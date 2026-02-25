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

import { type FC, useEffect, useState, useMemo } from 'react'
import { useAtomValue, useAtom, RegistryContext } from '@effect-atom/atom-react'
import { Atom } from '@effect-atom/atom-react'
import type { PanelContentProps } from '@/lib/floating/panel-registry'
import { panelRegistry } from '@/lib/floating/panel-registry'
import type { GeniferSurface } from './surface'

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

// ─────────────────────────────────────────────────────────────────────────────
// Visitor Component
// ─────────────────────────────────────────────────────────────────────────────

export const GeniferPanelVisitor: FC<PanelContentProps> = ({ panelId, data }) => {
  const panelData = data as GeniferPanelData | undefined

  if (!panelData?.surfaceId) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 font-mono"
           style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        No surface ID provided
      </div>
    )
  }

  return <GeniferPanelContent surfaceId={panelData.surfaceId} prompt={panelData.prompt} />
}

GeniferPanelVisitor.displayName = 'GeniferPanelVisitor'

// ─────────────────────────────────────────────────────────────────────────────
// Inner content — reads surface atom, renders tree
// ─────────────────────────────────────────────────────────────────────────────

const GeniferPanelContent: FC<{ surfaceId: string; prompt?: string }> = ({ surfaceId, prompt }) => {
  const surface$ = useMemo(() => geniferPanelSurfaces(surfaceId), [surfaceId])
  const surface = useAtomValue(surface$)

  if (!surface) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
        <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          Generating{prompt ? `…` : '…'}
        </span>
        {prompt && (
          <span className="text-neutral-700 font-mono text-center max-w-[300px] truncate"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            "{prompt}"
          </span>
        )}
      </div>
    )
  }

  // Render the surface tree using genifer's Renderer
  // The actual rendering is delegated to the genifer react system
  // which handles the UITree → React component mapping
  return (
    <div
      data-genifer-panel
      data-surface-id={surfaceId}
      className="h-full overflow-auto p-3"
    >
      <GeniferSurfaceRenderer surface={surface} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface Renderer — bridges to genifer's react Renderer
// ─────────────────────────────────────────────────────────────────────────────

const GeniferSurfaceRenderer: FC<{ surface: GeniferSurface }> = ({ surface }) => {
  // The surface object contains the UITree + metadata
  // For now, render a JSON tree view as MVP — the full Renderer integration
  // will be wired once we confirm the data flow works end-to-end
  const tree = (surface as any).tree ?? (surface as any).uiTree

  if (!tree) {
    return (
      <div className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        Empty surface
      </div>
    )
  }

  // Render as formatted JSON for MVP — upgrade to full Renderer in next pass
  return (
    <pre
      className="text-neutral-300 font-mono overflow-auto whitespace-pre-wrap"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {JSON.stringify(tree, null, 2)}
    </pre>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration — call once at app startup
// ─────────────────────────────────────────────────────────────────────────────

export function registerGeniferPanelVisitor(): void {
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
}
