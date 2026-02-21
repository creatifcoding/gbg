/**
 * Floating Panel Testbed v3 — Vantablack
 *
 * Clean exercise surface for the floating panel system.
 * No clutter, no instruction cards, no sortable grid.
 * Just panels on void.
 *
 * @module
 */

import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useSelector } from '@/lib/stx'
import {
  FloatingPanelProvider,
  FloatingPanel,
  FloatingDragOverlay,
  useFloatingPanel,
  useFloatingDimensions,
  registerPanel,
  unregisterPanel,
  getFloatingStx,
  AccordionPanel,
} from '@/lib/floating'
import type { DimensionConstraints } from '@/lib/floating/types'
import { WORKSPACE_CHROME_Z_INDEX as WORKSPACE_CHROME_Z } from '@/lib/floating/stx/constants'

// =============================================================================
// Palette — vantablack ground, surgical accents
// =============================================================================

const V = {
  void: '#010101',
  surface: '#0a0a0a',
  line: '#1a1a1a',
  lineHover: '#262626',
  text: '#525252',
  textMid: '#737373',
  textHigh: '#d4d4d4',
  accent: '#22c55e',
  accentDim: 'rgba(34, 197, 94, 0.12)',
  accentBorder: 'rgba(34, 197, 94, 0.25)',
  mono: 'var(--tmnl-font-mono, ui-monospace, "SF Mono", monospace)',
  xs: 'var(--tmnl-text-xs, 12px)',
  sm: 'var(--tmnl-text-sm, 14px)',
} as const

// =============================================================================
// Managed Panel — registration lifecycle
// =============================================================================

interface ManagedPanelProps {
  id: string
  title: string
  initialPosition: { x: number; y: number }
  initialDimensions: { width: number; height: number }
  constraints?: DimensionConstraints
  show: boolean
  children: ReactNode
}

function ManagedPanel({
  id,
  title,
  initialPosition,
  initialDimensions,
  constraints,
  show,
  children,
}: ManagedPanelProps) {
  const stx = getFloatingStx()
  const panel = useSelector(() => stx.data.panels.get(id)?.get())

  useEffect(() => {
    if (show) {
      const existing = getFloatingStx().data.panels.get(id)?.peek()
      if (!existing) {
        registerPanel({ id, title, initialPosition, initialDimensions, constraints })
      }
    } else {
      unregisterPanel(id)
    }
    return () => { if (show) unregisterPanel(id) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, id])

  if (!show || !panel) return null

  return (
    <FloatingPanel id={id} title={title}>
      {children}
    </FloatingPanel>
  )
}

// =============================================================================
// Panel content — minimal, functional, zero noise
// =============================================================================

function DimensionReadout() {
  const { width, height, isResizing, layout } = useFloatingDimensions()
  return (
    <div style={{ padding: 16, fontFamily: V.mono, fontSize: V.xs, color: V.text, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <Row label="size" value={`${Math.round(width)} × ${Math.round(height)}`} />
      <Row label="layout" value={layout} accent />
      <Row label="resizing" value={isResizing ? 'true' : 'false'} warn={isResizing} />
    </div>
  )
}

function LogContent({ lines }: { lines: string[] }) {
  return (
    <div style={{ padding: 12, fontFamily: V.mono, fontSize: V.xs, color: V.text, overflow: 'auto', height: '100%' }}>
      {lines.map((l, i) => (
        <div key={i} style={{ padding: '2px 0', borderBottom: `1px solid ${V.line}` }}>
          <span style={{ color: V.textMid, marginRight: 8 }}>{String(i).padStart(2, '0')}</span>
          {l}
        </div>
      ))}
    </div>
  )
}

function MetricBlock() {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000)
    return () => clearInterval(id)
  }, [])

  const metrics = [
    { label: 'REQ', value: (1247 + tick * 7).toLocaleString(), color: V.accent },
    { label: 'LAT', value: `${(42 + Math.sin(tick) * 3).toFixed(1)}ms`, color: '#00A2FF' },
    { label: 'ERR', value: String(Math.max(0, 3 + (tick % 5 === 0 ? 1 : 0))), color: '#ef4444' },
    { label: 'UP', value: '99.9%', color: V.accent },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, padding: 12 }}>
      {metrics.map(m => (
        <div key={m.label} style={{ background: V.surface, border: `1px solid ${V.line}`, padding: '10px 12px' }}>
          <div style={{ fontFamily: V.mono, fontSize: V.xs, color: V.text, marginBottom: 4 }}>{m.label}</div>
          <div style={{ fontFamily: V.mono, fontSize: '18px', fontWeight: 600, color: m.color, letterSpacing: '-0.02em' }}>{m.value}</div>
        </div>
      ))}
    </div>
  )
}

function PropertiesContent() {
  const rows = [
    { label: 'x', value: '120' },
    { label: 'y', value: '80' },
    { label: 'width', value: '320' },
    { label: 'height', value: '240' },
    { label: 'opacity', value: '1.0' },
    { label: 'rotation', value: '0°' },
  ]
  return (
    <div style={{ padding: 8, fontFamily: V.mono, fontSize: V.xs, color: V.text, display: 'flex', flexDirection: 'column', gap: 2 }}>
      {rows.map(r => <Row key={r.label} label={r.label} value={r.value} />)}
    </div>
  )
}

function StylesContent() {
  const swatches = ['#0a0a0a', '#1a1a1a', '#22c55e', '#ef4444', '#3b82f6', '#eab308']
  return (
    <div style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {swatches.map(c => (
        <div key={c} style={{ width: 24, height: 24, background: c, border: `1px solid ${V.line}` }} title={c} />
      ))}
      <div style={{ width: '100%', marginTop: 4, fontFamily: V.mono, fontSize: V.xs, color: V.text }}>
        border-radius: 0 · shadow: none
      </div>
    </div>
  )
}

function LayersContent() {
  const layers = ['Background', 'Grid', 'Panel Layer', 'Overlay', 'Chrome']
  return (
    <div style={{ padding: 4, fontFamily: V.mono, fontSize: V.xs, color: V.text }}>
      {layers.map((l, i) => (
        <div key={l} style={{
          padding: '4px 8px', borderBottom: `1px solid ${V.line}`,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{l}</span>
          <span style={{ color: V.textMid }}>z:{i * 10}</span>
        </div>
      ))}
    </div>
  )
}

function EmptyContent({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', fontFamily: V.mono, fontSize: V.xs, color: V.text,
    }}>
      {label}
    </div>
  )
}

// =============================================================================
// Inline helpers
// =============================================================================

function Row({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span style={{ color: warn ? '#eab308' : accent ? V.accent : V.textMid }}>{value}</span>
    </div>
  )
}

// =============================================================================
// Status bar — bottom HUD
// =============================================================================

function StatusBar() {
  const { panels } = useFloatingPanel()
  const stx = getFloatingStx()
  const activeId = useSelector(() => stx.data.activePanel.get())
  const snapOn = useSelector(() => stx.data.snapEnabled?.get() ?? false)

  const visible = panels.filter(p => p.visibility === 'visible').length

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, height: 28,
      display: 'flex', alignItems: 'center', gap: 16, paddingInline: 12,
      background: V.surface, borderTop: `1px solid ${V.line}`,
      fontFamily: V.mono, fontSize: V.xs, color: V.text, zIndex: WORKSPACE_CHROME_Z,
    }}>
      <span>{visible} panel{visible !== 1 ? 's' : ''}</span>
      <Separator />
      <span>active: <span style={{ color: activeId ? V.textHigh : V.text }}>{activeId ?? '—'}</span></span>
      <Separator />
      <span>snap: <span style={{ color: snapOn ? V.accent : V.text }}>{snapOn ? 'on' : 'off'}</span></span>
      <Separator />
      <span style={{ color: V.text, marginLeft: 'auto' }}>
        ⌨ arrows nudge · shift fine · alt coarse · edge dock
      </span>
    </div>
  )
}

function Separator() {
  return <span style={{ color: V.line }}>│</span>
}

// =============================================================================
// Spawn bar — top-right, minimal
// =============================================================================

const PANEL_DEFS = [
  { id: 'p-metrics', title: 'Metrics', x: 80, y: 80, w: 320, h: 240 },
  { id: 'p-log', title: 'Log', x: 440, y: 80, w: 380, h: 280 },
  { id: 'p-dim', title: 'Dimensions', x: 80, y: 360, w: 300, h: 200 },
  { id: 'p-constrained', title: 'Constrained', x: 420, y: 400, w: 300, h: 220 },
  { id: 'p-empty', title: 'Void', x: 760, y: 160, w: 260, h: 180 },
  { id: 'p-accordion', title: 'Inspector', x: 860, y: 80, w: 280, h: 400 },
] as const

const LOG_LINES = [
  'sys.init → floating-stx loaded',
  'panel.register → p-metrics (320×240)',
  'panel.register → p-log (380×280)',
  'snap.magnetic → threshold: 10px',
  'dock.zones → edge: 24px',
  'modifier.chain → restrict → dock → snap',
  'keyboard.nudge → arrows bound',
  'persistence → localStorage OK',
  'runtime → ready',
]

function SpawnBar({ active, onToggle }: { active: Set<string>; onToggle: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed', top: 12, right: 12, display: 'flex', gap: 4, zIndex: WORKSPACE_CHROME_Z,
    }}>
      {PANEL_DEFS.map(def => {
        const isActive = active.has(def.id)
        return (
          <button
            key={def.id}
            onClick={() => onToggle(def.id)}
            style={{
              fontFamily: V.mono, fontSize: V.xs, padding: '4px 10px',
              border: `1px solid ${isActive ? V.accentBorder : V.line}`,
              background: isActive ? V.accentDim : 'transparent',
              color: isActive ? V.accent : V.text,
              cursor: 'pointer',
            }}
          >
            {def.title}
          </button>
        )
      })}
    </div>
  )
}

// =============================================================================
// Main — void canvas
// =============================================================================

export function FloatingPanelTestbed() {
  const [activePanels, setActivePanels] = useState<Set<string>>(
    () => new Set(PANEL_DEFS.map(d => d.id))
  )

  const toggle = useCallback((id: string) => {
    setActivePanels(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: V.void,
      overflow: 'hidden',
    }}>
      <FloatingPanelProvider>
        <SpawnBar active={activePanels} onToggle={toggle} />

        {/* ── Panels ── */}
        <ManagedPanel
          id="p-metrics"
          title="Metrics"
          initialPosition={{ x: 80, y: 80 }}
          initialDimensions={{ width: 320, height: 240 }}
          show={activePanels.has('p-metrics')}
        >
          <MetricBlock />
        </ManagedPanel>

        <ManagedPanel
          id="p-log"
          title="Log"
          initialPosition={{ x: 440, y: 80 }}
          initialDimensions={{ width: 380, height: 280 }}
          show={activePanels.has('p-log')}
        >
          <LogContent lines={LOG_LINES} />
        </ManagedPanel>

        <ManagedPanel
          id="p-dim"
          title="Dimensions"
          initialPosition={{ x: 80, y: 360 }}
          initialDimensions={{ width: 300, height: 200 }}
          show={activePanels.has('p-dim')}
        >
          <DimensionReadout />
        </ManagedPanel>

        <ManagedPanel
          id="p-constrained"
          title="Constrained"
          initialPosition={{ x: 420, y: 400 }}
          initialDimensions={{ width: 300, height: 220 }}
          constraints={{ minWidth: 200, minHeight: 150, maxWidth: 500, maxHeight: 400 }}
          show={activePanels.has('p-constrained')}
        >
          <div style={{ padding: 16, fontFamily: V.mono, fontSize: V.xs, color: V.text, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Row label="min" value="200 × 150" />
            <Row label="max" value="500 × 400" />
            <div style={{ marginTop: 12, color: V.textMid }}>Resize to test clamping.</div>
          </div>
        </ManagedPanel>

        <ManagedPanel
          id="p-empty"
          title="Void"
          initialPosition={{ x: 760, y: 160 }}
          initialDimensions={{ width: 260, height: 180 }}
          show={activePanels.has('p-empty')}
        >
          <EmptyContent label="drag me · dock me · snap me" />
        </ManagedPanel>

        <ManagedPanel
          id="p-accordion"
          title="Inspector"
          initialPosition={{ x: 860, y: 80 }}
          initialDimensions={{ width: 280, height: 400 }}
          show={activePanels.has('p-accordion')}
        >
          <AccordionPanel>
            <AccordionPanel.Section title="Properties" defaultOpen>
              <PropertiesContent />
            </AccordionPanel.Section>
            <AccordionPanel.Section title="Styles">
              <StylesContent />
            </AccordionPanel.Section>
            <AccordionPanel.Section title="Layers">
              <LayersContent />
            </AccordionPanel.Section>
          </AccordionPanel>
        </ManagedPanel>

        <FloatingDragOverlay style="ghost" />
        <StatusBar />
      </FloatingPanelProvider>
    </div>
  )
}

export default FloatingPanelTestbed
