/**
 * Floating Panel Testbed v5 — SM Migration Exercise Surface
 *
 * Default: 3 panels tiled, 2 floating. Tests all SM features:
 *   - Tiled layout (split tree, separators, collapse, resize)
 *   - Floating panels (drag, resize, snap, minimize, maximize)
 *   - Float ↔ Tile transitions (header buttons, toolbar, right-click)
 *   - Edge drop zones (drag floating panel to workspace edge)
 *   - Context menus (right-click any panel)
 *   - Stash / Unstash (minimize/restore all floats)
 *   - Accent colors, tab bar
 *
 * @module
 */

import { useState, useEffect, type ReactNode } from 'react'
import { useSelector } from '@/lib/stx'
import {
  FloatingPanelProvider,
  FloatingPanel,
  FloatingDragOverlay,
  useFloatingPanel,
  registerPanel,
  getFloatingStx,
  tilePanel,
  floatPanel,
  dockToEdge,
  stashFloatsToEdges,
  unstashFloats,
  setPanelAccent,
  AccordionPanel,
} from '@/lib/floating'
import { spawnPanel, registerAllVisitors } from '@/lib/floating'
import { leaf, split } from '@/lib/floating/layout/split-tree'
import { SplitContainer } from '@/lib/floating/layout/SplitContainer'
import { TiledPanel } from '@/lib/floating/layout/TiledPanel'
import { TabBar, type Tab } from '@/lib/floating/layout/TabBar'
import { WORKSPACE_CHROME_Z_INDEX as CHROME_Z } from '@/lib/floating/stx/constants'
import { batch } from '@legendapp/state'

// Register built-in panel visitors (MorphChat, etc.)
registerAllVisitors()

// =============================================================================
// Palette
// =============================================================================

const V = {
  void: 'oklch(0.03 0.005 280)',
  surface: 'oklch(0.08 0.005 280)',
  surfaceRaised: 'oklch(0.10 0.005 280)',
  line: 'rgba(38, 38, 38, 0.5)',
  lineStrong: 'rgba(255, 255, 255, 0.05)',
  text: '#525252',
  textMid: '#737373',
  textHigh: '#e5e5e5',
  accent: '#06b6d4',
  accentDim: 'rgba(8, 145, 178, 0.12)',
  accentBorder: 'rgba(8, 145, 178, 0.3)',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
  xs: 'var(--tmnl-text-xs, 12px)',
  sm: 'var(--tmnl-text-sm, 14px)',
} as const

// =============================================================================
// Panel Definitions
// =============================================================================

/** Panels that start tiled */
const TILED_DEFS = [
  { id: 'p-alpha',   title: 'Alpha',   w: 340, h: 260, accent: '#c4a1b1' },
  { id: 'p-beta',    title: 'Beta',    w: 360, h: 300 },
  { id: 'p-gamma',   title: 'Gamma',   w: 300, h: 220 },
] as const

/** Panels that start floating */
const FLOAT_DEFS = [
  { id: 'p-delta',   title: 'Delta',   x: 500, y: 120, w: 280, h: 340, accent: '#4ade80' },
  { id: 'p-epsilon', title: 'Epsilon', x: 620, y: 300, w: 300, h: 200 },
] as const

const ALL_IDS = [...TILED_DEFS.map(d => d.id), ...FLOAT_DEFS.map(d => d.id)]

// =============================================================================
// Panel Content
// =============================================================================

function MetricBlock() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(id)
  }, [])
  const metrics = [
    { label: 'REQ/s', value: (1247 + tick * 7).toLocaleString(), color: V.accent, bg: 'rgba(8,145,178,0.08)' },
    { label: 'LATENCY', value: `${(42 + Math.sin(tick) * 3).toFixed(1)}ms`, color: '#818cf8', bg: 'rgba(129,140,248,0.08)' },
    { label: 'ERRORS', value: String(Math.max(0, 3 + (tick % 5 === 0 ? 1 : 0))), color: '#f43f5e', bg: 'rgba(244,63,94,0.08)' },
    { label: 'UPTIME', value: '99.97%', color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, padding: 10 }}>
      {metrics.map(m => (
        <div key={m.label} style={{
          background: m.bg,
          border: `1px solid ${V.line}`,
          borderRadius: 6,
          padding: '10px 12px',
        }}>
          <div style={{
            fontFamily: V.mono, fontSize: V.xs, color: V.text,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            marginBottom: 6,
          }}>
            {m.label}
          </div>
          <div style={{
            fontFamily: V.mono, fontSize: '20px', fontWeight: 600,
            color: m.color, letterSpacing: '-0.02em',
          }}>
            {m.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function LogContent() {
  const lines: Array<{ level: 'info' | 'warn' | 'ok'; msg: string }> = [
    { level: 'ok',   msg: 'sys.init → stx loaded' },
    { level: 'info', msg: 'layout.tree → 3 tiled panels' },
    { level: 'info', msg: 'snap.proximity → threshold: 12px' },
    { level: 'warn', msg: 'edge.zones → active during drag' },
    { level: 'info', msg: 'drag.distance → 8px activation' },
    { level: 'ok',   msg: 'persistence → localStorage v2' },
    { level: 'info', msg: 'right-click → context menu' },
    { level: 'ok',   msg: 'runtime → ready' },
  ]
  const levelColor = { info: V.text, warn: '#fbbf24', ok: '#34d399' }
  const levelBg = { info: 'transparent', warn: 'rgba(251,191,36,0.04)', ok: 'rgba(52,211,153,0.04)' }
  return (
    <div style={{ padding: 4, fontFamily: V.mono, fontSize: V.xs, color: V.text, overflow: 'auto', height: '100%' }}>
      {lines.map((l, i) => (
        <div key={i} style={{
          padding: '4px 8px',
          borderBottom: `1px solid ${V.line}`,
          background: levelBg[l.level],
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ color: V.textMid, width: 20, flexShrink: 0 }}>{String(i).padStart(2, '0')}</span>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: levelColor[l.level],
          }} />
          <span style={{ color: levelColor[l.level] }}>{l.msg}</span>
        </div>
      ))}
    </div>
  )
}

function InspectorContent() {
  return (
    <AccordionPanel>
      <AccordionPanel.Section title="Properties" defaultOpen>
        <div style={{ padding: 8, fontFamily: V.mono, fontSize: V.xs, color: V.text, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[['x', '120'], ['y', '80'], ['width', '320'], ['height', '240'], ['opacity', '1.0']].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{k}</span><span style={{ color: V.textMid }}>{v}</span>
            </div>
          ))}
        </div>
      </AccordionPanel.Section>
      <AccordionPanel.Section title="Styles">
        <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {['oklch(0.08 0.005 280)', '#06b6d4', '#34d399', '#f43f5e', '#818cf8', '#fbbf24'].map(c => (
            <div key={c} style={{ width: 24, height: 24, background: c, border: `1px solid ${V.line}` }} />
          ))}
        </div>
      </AccordionPanel.Section>
    </AccordionPanel>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', fontFamily: V.mono, fontSize: V.xs, color: V.text,
      flexDirection: 'column', gap: 10,
    }}>
      <span style={{ letterSpacing: '0.12em', textTransform: 'uppercase', color: V.textMid }}>{label}</span>
      <span style={{
        color: V.text,
        padding: '3px 10px',
        border: `1px solid ${V.line}`,
        borderRadius: 4,
        fontSize: V.xs,
        letterSpacing: '0.04em',
      }}>
        drag · dock · right-click
      </span>
    </div>
  )
}

function getPanelContent(id: string): ReactNode {
  switch (id) {
    case 'p-alpha':   return <MetricBlock />
    case 'p-beta':    return <LogContent />
    case 'p-gamma':   return <Placeholder label="Gamma" />
    case 'p-delta':   return <InspectorContent />
    case 'p-epsilon': return <Placeholder label="Epsilon" />
    default:          return <Placeholder label={id} />
  }
}

// =============================================================================
// Initialization — register panels and build default tiled layout
// =============================================================================

function useInitializePanels() {
  useEffect(() => {
    const stx = getFloatingStx()

    batch(() => {
      // Register tiled panels with mode: 'tiled' directly
      for (const def of TILED_DEFS) {
        const existing = stx.data.panels.get(def.id)?.peek()
        if (existing) continue
        stx.data.panels.set(def.id, {
          id: def.id,
          title: def.title,
          mode: 'tiled',
          position: { x: 0, y: 0 },
          dimensions: { width: def.w, height: def.h },
          constraints: { minWidth: 200, minHeight: 150 },
          zIndex: 0,
          visibility: 'visible',
          isDragging: false,
          isResizing: false,
          isMaximized: false,
          preMaximizePosition: undefined,
          preMaximizeDimensions: undefined,
          preMinimizePosition: undefined,
          preMinimizeDimensions: undefined,
          tiledWidth: def.w,
          isCollapsed: false,
          floatOriginSide: undefined,
          accent: def.accent,
          headerHidden: false,
          tabs: [],
          activeTabId: undefined,
          closable: true,
          minimizable: true,
          resizable: true,
          visitorId: undefined,
          visitorData: undefined,
        })
      }

      // Build default split tree:
      //   horizontal(
      //     Alpha [35%],
      //     vertical( Beta [60%], Gamma [40%] ) [65%]
      //   )
      const rightSide = split('vertical', leaf('p-beta'), leaf('p-gamma'), 0.6)
      const tree = split('horizontal', leaf('p-alpha'), rightSide, 0.35)
      stx.data.panelTree.set(tree)
      stx.data.activePanel.set('p-alpha')

      // Register floating panels normally
      for (const def of FLOAT_DEFS) {
        const existing = stx.data.panels.get(def.id)?.peek()
        if (!existing) {
          registerPanel({
            id: def.id,
            title: def.title,
            initialPosition: { x: def.x, y: def.y },
            initialDimensions: { width: def.w, height: def.h },
            accent: def.accent,
          })
        }
      }
    })

    return () => {
      // Cleanup on unmount — idempotent, safe for StrictMode double-invoke
      batch(() => {
        for (const id of ALL_IDS) {
          stx.data.panels.delete(id)
        }
        stx.data.panelTree.set(null)
        stx.data.zOrder.set([])
        stx.data.activePanel.set(null)
      })
    }
  }, [])
}

// =============================================================================
// Tiled Panel Renderer — called by SplitContainer
// =============================================================================

function renderTiledPanel(panelId: string) {
  return (
    <TiledPanel key={`tiled-${panelId}`} id={panelId} onFloat={(id) => floatPanel(id)}>
      {getPanelContent(panelId)}
    </TiledPanel>
  )
}

// =============================================================================
// Floating Panels — only renders panels that are in floating mode
// =============================================================================

function FloatingPanels() {
  // Collect ALL panel IDs from stx — includes dynamically spawned panels
  // Use zOrder as source of truth — it's an observable array that tracks
  // all panel IDs including dynamically spawned ones
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
}

function FloatingPanelIfVisible({ id }: { id: string }) {
  const mode = useSelector(() => getFloatingStx().data.panels.get(id)?.mode.get())
  const visibility = useSelector(() => getFloatingStx().data.panels.get(id)?.visibility.get())
  const title = useSelector(() => getFloatingStx().data.panels.get(id)?.title.get()) ?? id

  if (mode !== 'floating' || !visibility || visibility === 'hidden') return null

  return (
    <FloatingPanel id={id} title={title}>
      {getPanelContent(id)}
    </FloatingPanel>
  )
}

// =============================================================================
// Tab Bar Demo
// =============================================================================

function TabBarDemo() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 't1', label: 'main.tsx' },
    { id: 't2', label: 'types.ts' },
    { id: 't3', label: 'actions.ts' },
  ])
  const [activeTab, setActiveTab] = useState('t1')

  return (
    <div style={{ fontFamily: V.mono }}>
      <TabBar
        tabs={tabs}
        activeTabId={activeTab}
        onTabClick={setActiveTab}
        onTabClose={(id) => {
          setTabs(prev => prev.filter(t => t.id !== id))
          if (activeTab === id) setActiveTab(tabs[0]?.id ?? '')
        }}
        onTabReorder={(ids) => {
          setTabs(prev => ids.map(id => prev.find(t => t.id === id)!).filter(Boolean))
        }}
        onNewTab={() => {
          const id = `t${Date.now()}`
          setTabs(prev => [...prev, { id, label: `new-${tabs.length}.ts` }])
          setActiveTab(id)
        }}
      />
      <div style={{ padding: 12, fontSize: V.xs, color: V.textMid }}>
        Active: {activeTab} · Drag tabs to reorder
      </div>
    </div>
  )
}

// =============================================================================
// Toolbar
// =============================================================================

function Toolbar() {
  const panelTree = useSelector(() => getFloatingStx().data.panelTree.get())
  const hasTiled = panelTree !== null

  return (
    <div style={{
      height: 40, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px',
      background: V.surface, borderBottom: `1px solid ${V.line}`,
      zIndex: CHROME_Z, fontFamily: V.mono, fontSize: V.xs,
    }}>
      {/* Quick tile actions */}
      <ActionBtn label="Float Alpha" onClick={() => floatPanel('p-alpha')} />
      <ActionBtn label="Float Beta" onClick={() => floatPanel('p-beta')} />
      <ActionBtn label="Dock Delta→L" onClick={() => dockToEdge('p-delta', 'left', 0.3)} />
      <ActionBtn label="Dock Epsilon→R" onClick={() => dockToEdge('p-epsilon', 'right', 0.3)} />

      <Divider />

      <ActionBtn label="Float All" onClick={() => {
        ALL_IDS.forEach(id => {
          const p = getFloatingStx().data.panels.get(id)?.peek()
          if (p?.mode === 'tiled') floatPanel(id)
        })
      }} />
      <ActionBtn label="Tile All" onClick={() => {
        // Reset tree and re-tile
        const stx = getFloatingStx()
        batch(() => {
          stx.data.panelTree.set(null)
          ALL_IDS.forEach(id => {
            const p = stx.data.panels.get(id)?.peek()
            if (p) stx.data.panels.get(id)!.mode.set('floating')
          })
        })
        // Now tile them in order
        tilePanel('p-alpha')
        tilePanel('p-beta', 'p-alpha', 'horizontal', 0.35)
        tilePanel('p-gamma', 'p-beta', 'vertical', 0.6)
        tilePanel('p-delta')
        tilePanel('p-epsilon', 'p-delta', 'vertical', 0.5)
      }} />

      <Divider />

      <ActionBtn label="Stash" onClick={stashFloatsToEdges} />
      <ActionBtn label="Unstash" onClick={unstashFloats} />

      <Divider />

      <ActionBtn label="Accent Mauve" onClick={() => setPanelAccent('p-alpha', '#c4a1b1')} />
      <ActionBtn label="Accent Sage" onClick={() => setPanelAccent('p-beta', '#4ade80')} />
      <ActionBtn label="Clear Accents" onClick={() => ALL_IDS.forEach(id => setPanelAccent(id, undefined))} />

      <Divider />

      <ActionBtn label="+ Chat (Mock)" onClick={() => spawnPanel('morphchat', { mode: 'tiled' })} />
      <ActionBtn label="+ Chat (Live)" onClick={() => spawnPanel('morphchat:harness', { mode: 'floating' })} />

      <div style={{ marginLeft: 'auto', color: V.textMid }}>
        {hasTiled ? '🟢 tiled' : '⚫ float-only'}
      </div>
    </div>
  )
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 10px',
        border: `1px solid ${V.line}`,
        background: 'transparent',
        color: V.text,
        cursor: 'pointer',
        fontFamily: V.mono,
        fontSize: V.xs,
        letterSpacing: '0.04em',
        borderRadius: 4,
        transition: 'all 200ms ease-out',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = V.accentBorder
        e.currentTarget.style.color = V.textHigh
        e.currentTarget.style.background = V.accentDim
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = V.line
        e.currentTarget.style.color = V.text
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.transform = ''
      }}
      onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)' }}
      onMouseUp={e => { e.currentTarget.style.transform = '' }}
    >
      {label}
    </button>
  )
}

function Divider() {
  return <span style={{ color: V.line, margin: '0 4px' }}>│</span>
}

// =============================================================================
// Status Bar
// =============================================================================

function StatusBar() {
  const { panels } = useFloatingPanel()
  const stx = getFloatingStx()
  const activeId = useSelector(() => stx.data.activePanel.get())
  const panelTree = useSelector(() => stx.data.panelTree.get())

  const floating = panels.filter(p => p.mode === 'floating' && p.visibility === 'visible').length
  const tiled = panels.filter(p => p.mode === 'tiled').length
  const minimized = panels.filter(p => p.visibility === 'minimized').length

  return (
    <div style={{
      height: 28, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 16, paddingInline: 12,
      background: V.surface, borderTop: `1px solid ${V.line}`,
      fontFamily: V.mono, fontSize: V.xs, color: V.text, zIndex: CHROME_Z,
    }}>
      <span>floating: <span style={{ color: V.textHigh }}>{floating}</span></span>
      <span style={{ color: V.line }}>│</span>
      <span>tiled: <span style={{ color: V.textHigh }}>{tiled}</span></span>
      <span style={{ color: V.line }}>│</span>
      <span>minimized: <span style={{ color: V.textHigh }}>{minimized}</span></span>
      <span style={{ color: V.line }}>│</span>
      <span>active: <span style={{ color: activeId ? V.accent : V.text }}>{activeId ?? '—'}</span></span>
      <span style={{ color: V.line }}>│</span>
      <span>tree: <span style={{ color: panelTree ? V.accent : V.text }}>{panelTree ? panelTree._tag : 'null'}</span></span>
      <span style={{ color: V.text, marginLeft: 'auto' }}>
        header buttons toggle mode · right-click for menu · drag separators to resize
      </span>
    </div>
  )
}

// =============================================================================
// Main Testbed
// =============================================================================

export function FloatingPanelTestbed() {
  useInitializePanels()

  const hasTiledLayout = useSelector(() => getFloatingStx().data.panelTree.get() !== null)

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: V.void,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      <FloatingPanelProvider>
        <Toolbar />

        {/* Workspace — between toolbar (40px) and status bar (28px) */}
        <div
          data-shell-workspace
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            contain: 'paint',
          }}
        >
          {/* Tiled base layer — always present, shows empty state or split tree */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }} data-shell-tiled>
            <SplitContainer renderPanel={renderTiledPanel} />
          </div>

          {/* Floating panels render on top of tiled layer */}
          <FloatingPanels />

          {/* Tab bar demo — bottom-left corner */}
          {!hasTiledLayout && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12,
              width: 360, background: V.surface, border: `1px solid ${V.line}`,
              zIndex: 1,
            }}>
              <div style={{ padding: '4px 8px', fontSize: V.xs, color: V.textMid, fontFamily: V.mono, borderBottom: `1px solid ${V.line}` }}>
                TabBar Demo
              </div>
              <TabBarDemo />
            </div>
          )}
        </div>

        <FloatingDragOverlay style="ghost" />
        <StatusBar />
      </FloatingPanelProvider>
    </div>
  )
}

export default FloatingPanelTestbed
