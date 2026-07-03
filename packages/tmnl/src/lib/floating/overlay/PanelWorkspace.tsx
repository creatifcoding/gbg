/**
 * PanelWorkspace — the live panel surface inside PanelWorkspaceOverlay.
 *
 * This is the production equivalent of FloatingPanelTestbed.
 * It wires together:
 *   - FloatingPanelProvider (DndContext, sensors, modifiers)
 *   - SplitContainer (tiled panels via CSS Grid)
 *   - FloatingPanels (floating overlay panels)
 *   - FloatingDragOverlay (ghost drag feedback)
 *   - PanelContentRenderer (visitorId → component resolution)
 *   - Keyboard navigation (Alt+HJKL, splits, close)
 *   - Visitor registration (morphchat, terminal, etc.)
 *
 * Architecture:
 *   <PanelWorkspaceOverlay>      ← always-mounted grid-cell overlay
 *     <PanelWorkspace />          ← THIS. The live surface.
 *   </PanelWorkspaceOverlay>
 *
 * The workspace auto-initializes with a blank tiled layout.
 * Use `spawnPanel(visitorId)` to add content.
 *
 * @module floating/overlay/PanelWorkspace
 */

import { memo, useEffect, useCallback, useState, type ReactNode } from 'react'
import { useSelector } from '@/lib/stx'
import { batch } from '@legendapp/state'

import { FloatingPanelProvider } from '../FloatingPanelProvider'
import { FloatingPanel } from '../FloatingPanel'
import { FloatingDragOverlay } from '../FloatingDragOverlay'
import { SplitContainer } from '../layout/SplitContainer'
import { ScrollStrip } from '../layout/ScrollStrip'
import { TiledPanel } from '../layout/TiledPanel'
import { getFloatingStx } from '../stx/instance'
import { floatPanel, tilePanel, spawnPanel } from '../stx/actions'
import { registerCorePanelVisitors } from '../visitors/core'
import { PANEL } from '../tokens'
import { WORKSPACE_SENTINEL, WORKSPACE_CHROME_Z_INDEX as CHROME_Z } from '../stx/constants'
import { leaf, collectPanelIds } from '../layout/split-tree'
import { closePanelOverlay, togglePanelOverlay } from './index'

// =============================================================================
// Register all visitors on module load
// =============================================================================

registerCorePanelVisitors()

// =============================================================================
// Layout mode toggle — tree (SplitContainer) vs strip (ScrollStrip/Niri)
// =============================================================================

type LayoutMode = 'tree' | 'strip'

// Simple observable for layout mode
import { observable } from '@legendapp/state'
const layoutMode$ = observable<LayoutMode>('strip') // Default to strip for validation

// =============================================================================
// Tiled Panel Renderer
// =============================================================================

function renderTiledPanel(panelId: string): ReactNode {
  return (
    <TiledPanel key={`tiled-${panelId}`} id={panelId} onFloat={(id) => floatPanel(id)} />
  )
}

// =============================================================================
// Floating Panels — renders all floating-mode panels from zOrder
// =============================================================================

const FloatingPanels = memo(function FloatingPanels() {
  const allPanelIds = useSelector(() => {
    const stx = getFloatingStx()
    return [...(stx.data.zOrder.get() ?? [])]
  })

  return (
    <>
      {allPanelIds.map(id => (
        <FloatingPanelIfVisible key={id} id={id} />
      ))}
    </>
  )
})

const FloatingPanelIfVisible = memo(function FloatingPanelIfVisible({ id }: { id: string }) {
  const mode = useSelector(() => getFloatingStx().data.panels.get(id)?.mode.get())
  const visibility = useSelector(() => getFloatingStx().data.panels.get(id)?.visibility.get())
  const title = useSelector(() => getFloatingStx().data.panels.get(id)?.title.get()) ?? id

  if (mode !== 'floating' || !visibility || visibility === 'hidden') return null

  return (
    <FloatingPanel id={id} title={title}>
      {/* PanelContentRenderer is already wired inside FloatingPanel and TiledPanel */}
    </FloatingPanel>
  )
})

// =============================================================================
// Initialization — set up workspace sentinel for first-panel docking
// =============================================================================

function useInitializeWorkspace() {
  useEffect(() => {
    const stx = getFloatingStx()
    const currentTree = stx.data.panelTree.peek()

    // Only initialize if tree is completely empty
    if (!currentTree) {
      batch(() => {
        // Set workspace sentinel — first tilePanel() or spawnPanel(mode:'tiled')
        // will replace this with an actual panel
        stx.data.panelTree.set(leaf(WORKSPACE_SENTINEL))
      })
    }

    // No cleanup — panels persist across overlay toggles
  }, [])
}

// =============================================================================
// Status Bar — compact workspace info
// =============================================================================

const WorkspaceStatusBar = memo(function WorkspaceStatusBar() {
  const stx = getFloatingStx()
  const activeId = useSelector(() => stx.data.activePanel.get())

  // Count from actual sources — zOrder for floating, tree for tiled
  const floating = useSelector(() => {
    const zOrder = stx.data.zOrder.get() ?? []
    return zOrder.filter((id: string) => {
      const p = stx.data.panels.get(id)?.peek()
      return p?.mode === 'floating' && p?.visibility === 'visible'
    }).length
  })

  const tiled = useSelector(() => {
    const tree = stx.data.panelTree.get()
    if (!tree) return 0
    return collectPanelIds(tree).filter(id => id !== WORKSPACE_SENTINEL).length
  })

  const minimized = useSelector(() => {
    const zOrder = stx.data.zOrder.get() ?? []
    return zOrder.filter((id: string) => {
      const p = stx.data.panels.get(id)?.peek()
      return p?.visibility === 'minimized'
    }).length
  })

  return (
    <div
      data-panel-status-bar
      style={{
        height: 24,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingInline: 12,
        background: PANEL.headerBg,
        borderTop: `1px solid ${PANEL.border}`,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        color: PANEL.textMuted,
        zIndex: CHROME_Z,
      }}
    >
      <span>
        <span style={{ color: PANEL.textStrong }}>{tiled}</span> tiled
      </span>
      <Sep />
      <span>
        <span style={{ color: PANEL.textStrong }}>{floating}</span> float
      </span>
      {minimized > 0 && (
        <>
          <Sep />
          <span>
            <span style={{ color: PANEL.textStrong }}>{minimized}</span> min
          </span>
        </>
      )}
      <Sep />
      <span>
        focus: <span style={{ color: activeId ? PANEL.accentCyan : PANEL.textMuted }}>
          {activeId ?? '—'}
        </span>
      </span>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: PANEL.textMuted, opacity: 0.6 }}>
          Alt+P to toggle · Alt+HJKL to navigate
        </span>
      </div>
    </div>
  )
})

function Sep() {
  return <span style={{ color: PANEL.border, fontSize: 'var(--tmnl-text-xs, 12px)' }}>│</span>
}

// =============================================================================
// Quick Action Bar — spawn + workspace controls
// =============================================================================

const WorkspaceActionBar = memo(function WorkspaceActionBar({
  onRequestClose = closePanelOverlay,
}: {
  onRequestClose?: () => void | Promise<void>
}) {
  const mode = useSelector(() => layoutMode$.get())

  const handleSpawnChat = useCallback(() => {
    spawnPanel('morphchat', { mode: 'tiled' })
  }, [])

  const handleSpawnHarness = useCallback(() => {
    spawnPanel('morphchat:harness', { mode: 'tiled' })
  }, [])

  const handleSpawnMuse = useCallback(() => {
    spawnPanel('muse:log', { mode: 'floating' })
  }, [])

  const handleClose = useCallback(() => {
    void onRequestClose()
  }, [onRequestClose])

  const handleToggleMode = useCallback(() => {
    layoutMode$.set(mode === 'tree' ? 'strip' : 'tree')
  }, [mode])

  return (
    <div
      data-panel-action-bar
      style={{
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        paddingInline: 10,
        background: PANEL.headerBg,
        borderBottom: `1px solid ${PANEL.border}`,
        zIndex: CHROME_Z,
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
      }}
    >
      {/* Brand */}
      <span style={{
        color: PANEL.accentCyan,
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginRight: 8,
      }}>
        panels
      </span>

      <Sep />

      {/* Spawn actions */}
      <QuickBtn label="+ Demo" onClick={handleSpawnChat} />
      <QuickBtn label="+ Live" onClick={handleSpawnHarness} accent />
      <QuickBtn label="+ Muse" onClick={handleSpawnMuse} />

      <Sep />

      {/* Layout mode toggle */}
      <QuickBtn
        label={mode === 'strip' ? '◇ Strip' : '▦ Tree'}
        onClick={handleToggleMode}
        accent={mode === 'strip'}
      />

      {/* Close button — far right */}
      <div style={{ marginLeft: 'auto' }}>
        <button
          onClick={handleClose}
          title="Close panel workspace (Alt+P)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: PANEL.textMuted,
            cursor: 'pointer',
            transition: 'color 150ms ease-out, background 150ms ease-out',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = PANEL.textStrong
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = PANEL.textMuted
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l10 10M12 2L2 12" />
          </svg>
        </button>
      </div>
    </div>
  )
})

function QuickBtn({ label, onClick, accent }: { label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 8px',
        border: `1px solid ${accent ? PANEL.accentCyan + '40' : PANEL.border}`,
        background: accent ? PANEL.accentCyan + '0a' : 'transparent',
        color: accent ? PANEL.accentCyan : PANEL.textMuted,
        cursor: 'pointer',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        fontSize: 'var(--tmnl-text-xs, 12px)',
        letterSpacing: '0.04em',
        borderRadius: 4,
        lineHeight: '20px',
        transition: 'all 150ms ease-out',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = PANEL.accentCyan
        e.currentTarget.style.color = PANEL.textStrong
        e.currentTarget.style.background = PANEL.accentCyan + '14'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = accent ? PANEL.accentCyan + '40' : PANEL.border
        e.currentTarget.style.color = accent ? PANEL.accentCyan : PANEL.textMuted
        e.currentTarget.style.background = accent ? PANEL.accentCyan + '0a' : 'transparent'
      }}
    >
      {label}
    </button>
  )
}

// =============================================================================
// Empty State — shown when workspace has no panels
// =============================================================================

const EmptyState = memo(function EmptyState() {
  const [launching, setLaunching] = useState<string | null>(null)

  const launch = useCallback((visitorId: string, mode: 'tiled' | 'floating' = 'tiled') => {
    setLaunching(visitorId)
    // Let the exit pulse register visually, then hand all state mutation to STX spawnPanel.
    setTimeout(() => {
      spawnPanel(visitorId, { mode })
      setLaunching(null)
    }, 180)
  }, [])

  return (
    <div
      data-panel-empty-state
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        width: '100%',
        gap: 18,
        padding: 24,
        background: PANEL.bg,
      }}
    >
      <style>{`
        @keyframes empty-card-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${PANEL.accentCyan}00; }
          50% { box-shadow: 0 0 0 6px ${PANEL.accentCyan}08; }
        }
        [data-empty-launch-card]:hover {
          border-color: ${PANEL.accentCyan} !important;
          background: oklch(0.18 0.01 200 / 0.92) !important;
          box-shadow: 0 0 20px ${PANEL.accentCyan}18, inset 0 0 12px ${PANEL.accentCyan}08 !important;
          transform: translateY(-1px);
        }
        [data-empty-launch-card]:active {
          transform: scale(0.98) !important;
          transition-duration: 100ms !important;
        }
      `}</style>

      <div style={{ textAlign: 'center', maxWidth: 720 }}>
        <div style={{
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          fontSize: 'var(--tmnl-text-sm, 14px)',
          color: PANEL.accentCyan,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          TMNL Panel Workspace
        </div>
        <div style={{
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: PANEL.textMuted,
          lineHeight: 1.6,
        }}>
          The workspace sentinel is ready. Launch a canonical visitor to replace it — STX owns the layout, strip, focus, and panel lifecycle.
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(180px, 1fr))',
        gap: 10,
        width: 'min(760px, 100%)',
      }}>
        <LaunchCard
          title="Live Conductor"
          eyebrow="Harness"
          description="Open the panel-scoped MorphChat harness session and session drawer."
          accent
          launching={launching === 'morphchat:harness'}
          onClick={() => launch('morphchat:harness')}
        />
        <LaunchCard
          title="Demo Conductor"
          eyebrow="Mock"
          description="Seed a fully local MorphChat conductor with sample messages and tasks."
          launching={launching === 'morphchat'}
          onClick={() => launch('morphchat')}
        />
        <LaunchCard
          title="Muse Log"
          eyebrow="Stream"
          description="Open the raw/log capture panel as a floating live stream surface."
          launching={launching === 'muse:log'}
          onClick={() => launch('muse:log', 'floating')}
        />
      </div>
    </div>
  )
})

function LaunchCard({
  title,
  eyebrow,
  description,
  launching,
  accent,
  onClick,
}: {
  title: string
  eyebrow: string
  description: string
  launching: boolean
  accent?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-empty-launch-card
      onClick={onClick}
      style={{
        minHeight: 132,
        padding: 14,
        border: `1px solid ${accent ? PANEL.accentCyan + '55' : PANEL.border}`,
        borderRadius: 10,
        background: accent ? PANEL.accentCyan + '0a' : PANEL.headerBg,
        color: PANEL.text,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
        transition: 'transform 180ms ease-out, border-color 180ms ease-out, background 180ms ease-out, box-shadow 180ms ease-out',
        animation: launching ? 'empty-card-pulse 360ms ease-out infinite' : undefined,
      }}
    >
      <div style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        color: accent ? PANEL.accentCyan : PANEL.textMuted,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        {eyebrow}
      </div>
      <div style={{
        fontSize: 'var(--tmnl-text-sm, 14px)',
        color: PANEL.textStrong,
        marginBottom: 8,
      }}>
        {title}
      </div>
      <div style={{
        fontSize: 'var(--tmnl-text-xs, 12px)',
        color: PANEL.textMuted,
        lineHeight: 1.5,
      }}>
        {description}
      </div>
    </button>
  )
}

// =============================================================================
// Workspace Content — tiled + floating surfaces
// =============================================================================

const WorkspaceContent = memo(function WorkspaceContent() {
  const mode = useSelector(() => layoutMode$.get())

  const hasTiledLayout = useSelector(() => {
    const tree = getFloatingStx().data.panelTree.get()
    if (!tree) return false
    // A tree with only WORKSPACE_SENTINEL is effectively empty
    if (tree._tag === 'leaf' && tree.panelId === WORKSPACE_SENTINEL) return false
    return true
  })

  return (
    <div
      data-panel-workspace-content
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        contain: 'paint',
      }}
    >
      {/* Tiled base layer — mode-dependent */}
      <div
        data-panel-tiled-layer
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!hasTiledLayout ? (
          <EmptyState />
        ) : mode === 'strip' ? (
          <ScrollStrip renderPanel={renderTiledPanel} />
        ) : (
          <SplitContainer renderPanel={renderTiledPanel} />
        )}
      </div>

      {/* Floating panels render on top */}
      <FloatingPanels />
    </div>
  )
})

// =============================================================================
// Main Export — PanelWorkspace
// =============================================================================

/**
 * PanelWorkspace — the full panel surface.
 *
 * Drop this as the sole child of `<PanelWorkspaceOverlay>`.
 * It self-initializes, registers visitors, and renders
 * both tiled and floating panels.
 *
 * @example
 * ```tsx
 * <PanelWorkspaceOverlay>
 *   <PanelWorkspace />
 * </PanelWorkspaceOverlay>
 * ```
 */
export interface PanelWorkspaceProps {
  /** Called by the action-bar close control. Defaults to closing the React overlay atom. */
  onRequestClose?: () => void | Promise<void>
}

export const PanelWorkspace = memo(function PanelWorkspace({
  onRequestClose,
}: PanelWorkspaceProps) {
  useInitializeWorkspace()

  return (
    <FloatingPanelProvider onRequestOverlayToggle={onRequestClose}>
      <WorkspaceActionBar onRequestClose={onRequestClose} />
      <WorkspaceContent />
      <FloatingDragOverlay style="ghost" />
      <WorkspaceStatusBar />
    </FloatingPanelProvider>
  )
})

export default PanelWorkspace
