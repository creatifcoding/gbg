/**
 * SurfaceRenderer — The Artifact Card
 *
 * Renders a genifer surface as a live, interactive, inline artifact
 * in the chat thread. Each surface is:
 *   - A self-contained rendered tree (components from CatalogService)
 *   - Surrounded by surface chrome (header, quality badge, controls)
 *   - Streamable (shows incremental preview during generation)
 *   - Collapsible (user can minimize completed surfaces)
 *   - Refinable (user can send instruction to modify)
 *   - Versioned (shows version chain for refined surfaces)
 *
 * Design language: Q-Branch Brutalist — warm gray, cream, monospace,
 * subtle glow on interactive elements, precise micro-typography.
 *
 * @module genifer/react/SurfaceRenderer
 */

'use client'

import {
  memo,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react'
import { HashMap, Option } from 'effect'
import type { GeniferSurface } from '../harness/surface'
import type { GeniferStreamDeltaEvent } from '../harness/schemas'
import type { UITree } from '../core/schemas'
import { Renderer, DefaultFallback, type ComponentRegistry } from './renderer'
import { SurfaceProvider, type SurfaceProviderProps } from './SurfaceProvider'
import { BehaviorProvider } from './BehaviorBridge'
import type { GeniferHarnessServiceShape } from '../harness/GeniferHarnessService'
import type { DataSourceResolverShape } from '../harness/DataSourceResolver'

// =============================================================================
// CSS Tokens (inline — these complement the TMNL design system)
// =============================================================================

const SURFACE_TOKENS = {
  bg: 'rgba(28, 25, 23, 0.85)',           // stone-950 85%
  border: 'rgba(120, 113, 108, 0.25)',     // stone-500 25%
  borderStreaming: 'rgba(34, 211, 238, 0.35)', // cyan-400 35%
  borderError: 'rgba(239, 68, 68, 0.5)',   // red-500 50%
  headerBg: 'rgba(41, 37, 36, 0.9)',       // stone-800 90%
  badgeBg: 'rgba(6, 182, 212, 0.15)',      // cyan-500 15%
  badgeText: 'rgb(103, 232, 249)',         // cyan-300
  errorBadgeBg: 'rgba(239, 68, 68, 0.15)',
  errorBadgeText: 'rgb(252, 165, 165)',    // red-300
  refineBg: 'rgba(41, 37, 36, 0.7)',
  refineAccent: 'rgba(34, 211, 238, 0.6)',
  textPrimary: 'rgb(231, 229, 228)',       // stone-200
  textSecondary: 'rgb(168, 162, 158)',     // stone-400
  textMuted: 'rgb(120, 113, 108)',         // stone-500
  scanline: 'rgba(34, 211, 238, 0.03)',
  glow: '0 0 20px rgba(34, 211, 238, 0.1)',
  glowStreaming: '0 0 30px rgba(34, 211, 238, 0.2)',
} as const

// =============================================================================
// Quality Badge
// =============================================================================

function QualityBadge({ score, repairCount }: { score: number; repairCount: number }) {
  const pct = Math.round(score * 100)
  const isPerfect = pct >= 100 && repairCount === 0
  const isGood = pct >= 80

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 4,
        fontSize: 'var(--tmnl-text-xs, 10px)',
        fontFamily: 'var(--tmnl-font-mono, "JetBrains Mono", monospace)',
        background: isPerfect
          ? 'rgba(34, 197, 94, 0.15)'
          : isGood
            ? SURFACE_TOKENS.badgeBg
            : SURFACE_TOKENS.errorBadgeBg,
        color: isPerfect
          ? 'rgb(134, 239, 172)'
          : isGood
            ? SURFACE_TOKENS.badgeText
            : SURFACE_TOKENS.errorBadgeText,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
      {pct}%
      {repairCount > 0 && (
        <span style={{ opacity: 0.7 }}> · {repairCount} repair{repairCount !== 1 ? 's' : ''}</span>
      )}
    </span>
  )
}

// =============================================================================
// Surface Header
// =============================================================================

interface SurfaceHeaderProps {
  surface: GeniferSurface
  isCollapsed: boolean
  onToggle: () => void
  elementCount: number
}

function SurfaceHeader({ surface, isCollapsed, onToggle, elementCount }: SurfaceHeaderProps) {
  const statusLabel = surface.status === 'streaming'
    ? '● STREAMING'
    : surface.status === 'error'
      ? '✕ ERROR'
      : surface.status === 'collapsed'
        ? '▸ COLLAPSED'
        : '✓ READY'

  const statusColor = surface.status === 'streaming'
    ? SURFACE_TOKENS.badgeText
    : surface.status === 'error'
      ? SURFACE_TOKENS.errorBadgeText
      : 'rgb(134, 239, 172)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: SURFACE_TOKENS.headerBg,
        borderBottom: `1px solid ${SURFACE_TOKENS.border}`,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      aria-expanded={!isCollapsed}
      aria-label={`Surface ${surface.id.slice(0, 8)}: ${isCollapsed ? 'expand' : 'collapse'}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      {/* Left: status + prompt */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 'var(--tmnl-text-xs, 10px)',
            fontFamily: 'var(--tmnl-font-mono, monospace)',
            color: statusColor,
            letterSpacing: '0.05em',
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {statusLabel}
        </span>
        <span
          style={{
            fontSize: 'var(--tmnl-text-sm, 12px)',
            color: SURFACE_TOKENS.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {surface.prompt.length > 80 ? surface.prompt.slice(0, 77) + '…' : surface.prompt}
        </span>
      </div>

      {/* Right: metadata */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {surface.isRefinement && (
          <span
            style={{
              fontSize: 'var(--tmnl-text-xs, 10px)',
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              color: SURFACE_TOKENS.textMuted,
            }}
          >
            v{surface.version}
          </span>
        )}
        <span
          style={{
            fontSize: 'var(--tmnl-text-xs, 10px)',
            fontFamily: 'var(--tmnl-font-mono, monospace)',
            color: SURFACE_TOKENS.textSecondary,
          }}
        >
          {elementCount} el
        </span>
        {surface.status !== 'streaming' && (
          <QualityBadge
            score={surface.quality.score}
            repairCount={surface.quality.repairCount}
          />
        )}
        <span
          style={{
            fontSize: 'var(--tmnl-text-xs, 10px)',
            color: SURFACE_TOKENS.textMuted,
            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        >
          ▾
        </span>
      </div>
    </div>
  )
}

// =============================================================================
// Streaming Overlay
// =============================================================================

function StreamingOverlay({ elementCount }: { elementCount: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        background: `linear-gradient(90deg, transparent, ${SURFACE_TOKENS.badgeText}, transparent)`,
        animation: 'genifer-scan 2s ease-in-out infinite',
      }}
    >
      <style>{`
        @keyframes genifer-scan {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

// =============================================================================
// Refine Bar
// =============================================================================

function RefineBar({ onRefine }: { onRefine: (instruction: string) => void }) {
  const [instruction, setInstruction] = useState('')

  const handleSubmit = useCallback(() => {
    if (instruction.trim()) {
      onRefine(instruction.trim())
      setInstruction('')
    }
  }, [instruction, onRefine])

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: SURFACE_TOKENS.refineBg,
        borderTop: `1px solid ${SURFACE_TOKENS.border}`,
      }}
    >
      <input
        type="text"
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit()
        }}
        placeholder="Refine: describe what to change…"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 'var(--tmnl-text-sm, 12px)',
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          color: SURFACE_TOKENS.textPrimary,
          caretColor: SURFACE_TOKENS.refineAccent,
        }}
        aria-label="Refinement instruction"
      />
      <button
        onClick={handleSubmit}
        disabled={!instruction.trim()}
        style={{
          padding: '4px 12px',
          borderRadius: 4,
          border: `1px solid ${SURFACE_TOKENS.refineAccent}`,
          background: 'transparent',
          color: SURFACE_TOKENS.badgeText,
          fontSize: 'var(--tmnl-text-xs, 10px)',
          fontFamily: 'var(--tmnl-font-mono, monospace)',
          cursor: instruction.trim() ? 'pointer' : 'default',
          opacity: instruction.trim() ? 1 : 0.4,
          letterSpacing: '0.05em',
        }}
        aria-label="Submit refinement"
      >
        REFINE
      </button>
    </div>
  )
}

// =============================================================================
// SurfaceRenderer — The Artifact Card
// =============================================================================

export interface SurfaceRendererProps {
  /** The surface to render */
  surface: GeniferSurface
  /** The UITree to render (live from atoms, or snapshot) */
  tree: UITree | null
  /** Stream deltas for streaming preview */
  streamDeltas?: readonly GeniferStreamDeltaEvent[]
  /** DataSource resolver (for live bindings) */
  resolver?: DataSourceResolverShape
  /** Harness service (for refine) */
  harnessService?: GeniferHarnessServiceShape
  /** Session ID */
  sessionId?: string
  /** Additional component registry (merged with catalog) */
  registry?: ComponentRegistry
  /** Callback when refine is submitted */
  onRefine?: (surfaceId: string, instruction: string) => void
  /** Show the refine bar (default: true for completed surfaces) */
  showRefineBar?: boolean
  /** Disable entrance animations */
  disableAnimations?: boolean
  /** Custom className for the card container */
  className?: string
}

export const SurfaceRenderer = memo(function SurfaceRenderer({
  surface,
  tree,
  streamDeltas,
  resolver,
  harnessService,
  sessionId,
  registry,
  onRefine,
  showRefineBar,
  disableAnimations = false,
  className,
}: SurfaceRendererProps) {
  const [isCollapsed, setIsCollapsed] = useState(surface.status === 'collapsed')

  const elementCount = tree ? HashMap.size(tree.elements) : 0
  const isStreaming = surface.status === 'streaming'

  const handleToggle = useCallback(() => {
    setIsCollapsed((c) => !c)
  }, [])

  const handleRefine = useCallback(
    (instruction: string) => {
      onRefine?.(surface.id, instruction)
    },
    [surface.id, onRefine],
  )

  // Should we show refine bar?
  const shouldShowRefine = showRefineBar ?? (surface.status === 'complete')

  // Border color based on status
  const borderColor = isStreaming
    ? SURFACE_TOKENS.borderStreaming
    : surface.status === 'error'
      ? SURFACE_TOKENS.borderError
      : SURFACE_TOKENS.border

  return (
    <SurfaceProvider
      surface={surface}
      resolver={resolver}
      harnessService={harnessService}
      sessionId={sessionId}
      onRefine={onRefine}
    >
      <div
        className={className}
        style={{
          position: 'relative',
          borderRadius: 8,
          border: `1px solid ${borderColor}`,
          background: SURFACE_TOKENS.bg,
          boxShadow: isStreaming ? SURFACE_TOKENS.glowStreaming : SURFACE_TOKENS.glow,
          overflow: 'hidden',
          transition: 'border-color 300ms ease, box-shadow 300ms ease',
          margin: '8px 0',
        }}
        data-surface-id={surface.id}
        data-surface-status={surface.status}
        data-surface-version={surface.version}
        role="article"
        aria-label={`Generated UI: ${surface.prompt.slice(0, 50)}`}
      >
        {/* Streaming scan line */}
        {isStreaming && <StreamingOverlay elementCount={elementCount} />}

        {/* Header */}
        <SurfaceHeader
          surface={surface}
          isCollapsed={isCollapsed}
          onToggle={handleToggle}
          elementCount={elementCount}
        />

        {/* Body — rendered tree */}
        {!isCollapsed && (
          <div
            style={{
              padding: 12,
              minHeight: isStreaming ? 80 : undefined,
            }}
          >
            {tree ? (
              <BehaviorProvider tree={tree}>
                <Renderer
                  tree={tree}
                  registry={registry}
                  loading={isStreaming}
                  fallback={DefaultFallback}
                  disableAnimations={disableAnimations || isStreaming}
                />
              </BehaviorProvider>
            ) : isStreaming ? (
              /* Streaming skeleton when no tree yet */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 3 }, (_, i) => (
                  <div
                    key={i}
                    className="animate-pulse"
                    style={{
                      height: 24 + Math.random() * 24,
                      borderRadius: 4,
                      background: 'rgba(120, 113, 108, 0.15)',
                    }}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: 24,
                  color: SURFACE_TOKENS.textMuted,
                  fontSize: 'var(--tmnl-text-sm, 12px)',
                  fontFamily: 'var(--tmnl-font-mono, monospace)',
                }}
              >
                No content
              </div>
            )}
          </div>
        )}

        {/* Collapsed preview */}
        {isCollapsed && (
          <div
            style={{
              padding: '4px 12px',
              color: SURFACE_TOKENS.textMuted,
              fontSize: 'var(--tmnl-text-xs, 10px)',
              fontFamily: 'var(--tmnl-font-mono, monospace)',
            }}
          >
            {elementCount} elements · click to expand
          </div>
        )}

        {/* Refine bar */}
        {!isCollapsed && shouldShowRefine && (
          <RefineBar onRefine={handleRefine} />
        )}

        {/* Metadata footer */}
        {!isCollapsed && surface.status !== 'streaming' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 12px',
              borderTop: `1px solid ${SURFACE_TOKENS.border}`,
              fontSize: 'var(--tmnl-text-xs, 10px)',
              fontFamily: 'var(--tmnl-font-mono, monospace)',
              color: SURFACE_TOKENS.textMuted,
            }}
          >
            <span>{surface.quality.model} · {surface.quality.durationMs}ms</span>
            <span>{surface.id.slice(0, 8)}{surface.isRefinement ? ` ← ${surface.parentSurfaceId?.slice(0, 8)}` : ''}</span>
          </div>
        )}
      </div>
    </SurfaceProvider>
  )
})

// =============================================================================
// SurfaceList — Renders multiple surfaces in a thread
// =============================================================================

export interface SurfaceListProps {
  /** Surfaces to render (Map<id, surface>) */
  surfaces: ReadonlyMap<string, GeniferSurface>
  /** Tree lookup: surfaceId → UITree */
  getTree: (surfaceId: string) => UITree | null
  /** Stream deltas for the currently streaming surface */
  activeStreamDeltas?: readonly GeniferStreamDeltaEvent[]
  /** Active streaming surface ID */
  activeStreamingSurfaceId?: string
  /** Shared props passed to each SurfaceRenderer */
  resolver?: DataSourceResolverShape
  harnessService?: GeniferHarnessServiceShape
  sessionId?: string
  registry?: ComponentRegistry
  onRefine?: (surfaceId: string, instruction: string) => void
  disableAnimations?: boolean
}

/**
 * Renders all surfaces in a thread, ordered by creation time.
 * The most recent surface appears at the bottom (chat thread order).
 */
export function SurfaceList({
  surfaces,
  getTree,
  activeStreamDeltas,
  activeStreamingSurfaceId,
  resolver,
  harnessService,
  sessionId,
  registry,
  onRefine,
  disableAnimations,
}: SurfaceListProps) {
  // Sort by creation time (oldest first → newest at bottom)
  const sortedSurfaces = useMemo(() => {
    return Array.from(surfaces.values()).sort((a, b) => a.createdAt - b.createdAt)
  }, [surfaces])

  if (sortedSurfaces.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sortedSurfaces.map((surface) => (
        <SurfaceRenderer
          key={surface.id}
          surface={surface}
          tree={getTree(surface.id)}
          streamDeltas={
            surface.id === activeStreamingSurfaceId ? activeStreamDeltas : undefined
          }
          resolver={resolver}
          harnessService={harnessService}
          sessionId={sessionId}
          registry={registry}
          onRefine={onRefine}
          disableAnimations={disableAnimations}
        />
      ))}
    </div>
  )
}
