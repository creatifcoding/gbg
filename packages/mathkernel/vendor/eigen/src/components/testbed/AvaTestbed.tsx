/**
 * AVA Testbed - Floating Panel Edition v2
 *
 * Every panel uses the proper FloatingPanel system from @/lib/floating.
 * Features: resize handles, persistence, motion blur, mode toggling.
 *
 * Panels:
 * - Config: Base URL configuration
 * - Hypotheses: EDIN validation status
 * - Connection: WebSocket controls
 * - Views: Registered view list
 * - Artifact: Selected view inspector
 * - Messages: WebSocket event log
 * - REPL: Console interface
 * - State: Machine inspector
 * - Sequence: Event timeline
 * - Scenarios: Test runner
 * - Graph: Visualization
 *
 * @pattern FloatingPanel stx system + ManagedPanel wrapper
 * @module
 */

import { useEffect, useMemo, useState, useCallback, useRef, type ReactNode } from 'react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'

import {
  StatusIndicator,
  Button,
  ValueDisplay,
  SectionLabel,
  CodeBlock,
  VersionBadge,
} from './shared'
import {
  ReplConsole,
  StateInspector,
  SequenceDiagram,
  ScenarioRunner,
  GraphVisualization,
  resetTestbedStx,
} from './ava'
import {
  TmnlDataGrid,
  tmnlDenseDark,
  type GridVariantType,
} from '@/lib/data-grid'

import { useStxData, useStxMatches, useStx } from '@/lib/stx'
import { useSelector } from '@/lib/stx'
import {
  getAvaStx,
  resetAvaStx,
  type ConnectionStatus,
  type MessageLogEntry,
  type ViewSummary,
} from '@/lib/ava/atoms/ava-stx'

// Floating Panel System
import {
  FloatingPanelProvider,
  FloatingPanel,
  FloatingDragOverlay,
  useFloatingPanel,
  registerPanel,
  unregisterPanel,
  getFloatingStx,
} from '@/lib/floating'
import type { DimensionConstraints } from '@/lib/floating/types'

// Selection System
import { useSelection, useSelectable, SelectionOverlay, selectItem } from '@/lib/selection'
import { SelectionRing } from '@/components/affordances/SelectionRing'
import type { SelectionMode } from '@/lib/selection/types'

// =============================================================================
// TYPES
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

// =============================================================================
// MANAGED PANEL WRAPPER
// =============================================================================

/**
 * Wrapper that handles panel registration/unregistration lifecycle.
 * Panel is registered when show=true, unregistered when show=false.
 * Only renders FloatingPanel when panel exists in stx.
 * Integrates with selection system for multi-select and grouping.
 *
 * NOTE: FloatingPanel uses position:fixed, so we can't wrap it.
 * Instead, we render a fixed-position selectable overlay that tracks the panel.
 */
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
  const panelsMap = useSelector(() => stx.data.panels.get())
  const panel = panelsMap.get(id)

  // Selection integration
  const { isSelected, select } = useSelectable(id)

  // Register/unregister based on show prop
  useEffect(() => {
    if (show) {
      // Only register if panel doesn't exist yet (preserve resized dimensions)
      const existingPanel = getFloatingStx().data.panels.get(id)?.peek()
      if (!existingPanel) {
        registerPanel({
          id,
          title,
          initialPosition,
          initialDimensions,
          constraints,
        })
      }
    } else {
      unregisterPanel(id)
    }

    return () => {
      // Cleanup on unmount
      if (show) {
        unregisterPanel(id)
      }
    }
  }, [show, id, title, initialPosition, initialDimensions, constraints])

  // Handle click on selection overlay
  const handleSelectionClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const mode = e.shiftKey ? 'add' : e.ctrlKey || e.metaKey ? 'toggle' : 'replace'
    select(mode)
  }, [select])

  // Only render if panel exists
  if (!show || !panel) {
    return null
  }

  return (
    <>
      {/* The actual panel */}
      <FloatingPanel id={id} title={title}>
        {children}
      </FloatingPanel>

      {/* Fixed-position selectable overlay that tracks the panel */}
      <div
        data-selectable
        data-selectable-id={id}
        onClick={handleSelectionClick}
        className="pointer-events-none"
        style={{
          position: 'fixed',
          left: panel.position.x,
          top: panel.position.y,
          width: panel.dimensions.width,
          height: panel.dimensions.height,
          zIndex: panel.zIndex + 1,
        }}
      >
        {/* Selection ring */}
        <SelectionRing selected={isSelected} style="ring" color="cyan" />
      </div>
    </>
  )
}

// =============================================================================
// COLUMN DEFINITIONS
// =============================================================================

const createViewsColumnDefs = (variant: GridVariantType): ColDef<ViewSummary>[] => [
  {
    field: 'id',
    headerName: 'ID',
    width: 100,
    cellStyle: {
      fontFamily: 'monospace',
      color: variant.colors.text.muted,
      fontSize: variant.density.fontSizeXs,
    },
  },
  {
    field: 'name',
    headerName: 'Name',
    flex: 1,
    cellStyle: { color: variant.colors.text.primary },
  },
  {
    field: 'version',
    headerName: 'Ver',
    width: 50,
    cellStyle: {
      textAlign: 'center',
      fontFamily: 'monospace',
      color: variant.colors.signal.accent,
    },
  },
]

const createMessageLogColumnDefs = (variant: GridVariantType): ColDef<MessageLogEntry>[] => [
  {
    field: 'direction',
    headerName: '',
    width: 28,
    cellRenderer: (params: ICellRendererParams<MessageLogEntry>) => {
      const isIn = params.value === 'in'
      return (
        <span style={{
          color: isIn ? variant.colors.signal.accent : variant.colors.signal.warning,
          fontFamily: 'monospace',
        }}>
          {isIn ? '←' : '→'}
        </span>
      )
    },
  },
  {
    field: 'timestamp',
    headerName: 'Time',
    width: 70,
    valueFormatter: (params) => {
      const d = new Date(params.value)
      return d.toLocaleTimeString('en-US', { hour12: false }).slice(0, 8)
    },
    cellStyle: {
      fontFamily: 'monospace',
      color: variant.colors.text.muted,
      fontSize: variant.density.fontSizeXs,
    },
  },
  {
    field: 'type',
    headerName: 'Type',
    width: 80,
    cellRenderer: (params: ICellRendererParams<MessageLogEntry>) => {
      const typeColors: Record<string, string> = {
        artifact: variant.colors.signal.success,
        delta: variant.colors.signal.accent,
        status: variant.colors.signal.warning,
        error: variant.colors.signal.error,
        pong: variant.colors.text.muted,
      }
      return (
        <span style={{
          color: typeColors[params.value as string] ?? variant.colors.text.primary,
          fontFamily: 'monospace',
          fontSize: variant.density.fontSizeXs,
        }}>
          {params.value}
        </span>
      )
    },
  },
  {
    field: 'payload',
    headerName: 'Payload',
    flex: 1,
    cellStyle: {
      fontFamily: 'monospace',
      color: variant.colors.text.secondary,
      fontSize: variant.density.fontSizeXs,
    },
  },
]

// =============================================================================
// PANEL CONTENT COMPONENTS
// =============================================================================

interface PanelContentProps {
  ava: ReturnType<typeof getAvaStx>
  variant: GridVariantType
}

// Config Panel Content
function ConfigContent({ ava }: PanelContentProps) {
  const { data } = useStx(ava)
  const config = useStxData(ava, (d) => d.config.get())

  return (
    <div className="p-3">
      <div className="flex items-center gap-2">
        <label className="text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          URL:
        </label>
        <input
          type="text"
          value={config.baseUrl}
          onChange={(e) => data.config.set({ ...config, baseUrl: e.target.value })}
          className="flex-1 px-2 py-1 bg-neutral-900 border border-neutral-700 rounded font-mono text-neutral-200"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        />
      </div>
    </div>
  )
}

// Hypotheses Panel Content
function HypothesesContent({ ava }: PanelContentProps) {
  const hypotheses = useStxData(ava, (d) => d.hypotheses.get())

  return (
    <div className="p-3 space-y-2">
      {hypotheses.map(h => (
        <div
          key={h.id}
          className="flex items-center gap-2 p-2 bg-neutral-900/50 rounded border border-neutral-800"
        >
          <StatusIndicator
            status={
              h.status === 'passed' ? 'success' :
              h.status === 'failed' ? 'error' :
              h.status === 'validating' ? 'pending' : 'neutral'
            }
            label={h.id}
          />
          <div className="flex-1 min-w-0">
            <div className="text-neutral-400 truncate" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {h.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Connection Panel Content
function ConnectionContent({ ava }: PanelContentProps) {
  const { runEffect } = useStx(ava)
  const config = useStxData(ava, (d) => d.config.get())

  const isDisconnected = useStxMatches(ava, 'disconnected')
  const isConnecting = useStxMatches(ava, 'connecting')
  const isConnected = useStxMatches(ava, 'connected')
  const isError = useStxMatches(ava, 'error')

  const status: ConnectionStatus = isConnected ? 'connected' :
    isConnecting ? 'connecting' : isError ? 'error' : 'disconnected'

  const statusMap = {
    disconnected: { status: 'neutral' as const, label: 'Disconnected' },
    connecting: { status: 'pending' as const, label: 'Connecting...' },
    connected: { status: 'success' as const, label: 'Connected' },
    error: { status: 'error' as const, label: 'Error' },
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-3">
        <StatusIndicator
          status={statusMap[status].status}
          label={statusMap[status].label}
          pulse={status === 'connecting'}
        />
        {status === 'connected' && (
          <span className="text-cyan-400 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {config.baseUrl}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {status === 'disconnected' ? (
          <Button variant="primary" onClick={() => runEffect('connectSession')}>
            Connect
          </Button>
        ) : (
          <Button variant="danger" onClick={() => runEffect('disconnectSession')}>
            Disconnect
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => runEffect('sendPing')}
          disabled={status !== 'connected'}
        >
          Ping
        </Button>
      </div>
    </div>
  )
}

// Views Panel Content
function ViewsContent({ ava, variant }: PanelContentProps) {
  const { runEffect } = useStx(ava)
  const views = useStxData(ava, (d) => d.views.get())
  const columnDefs = useMemo(() => createViewsColumnDefs(variant), [variant])

  return (
    <div className="p-3 space-y-2 h-full flex flex-col">
      <div className="flex-1 min-h-0 border border-neutral-800 rounded overflow-hidden">
        <TmnlDataGrid<ViewSummary>
          variant={variant}
          rowData={views as ViewSummary[]}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true, sortable: true }}
          getRowId={(params) => params.data.id}
          rowSelection="single"
          onRowClicked={(e) => e.data && runEffect('selectView', e.data.id)}
          className="h-full"
        />
      </div>
      <div className="text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
        {views.length} view(s) • Click to inspect
      </div>
    </div>
  )
}

// Artifact Panel Content
function ArtifactContent({ ava }: PanelContentProps) {
  const { runEffect } = useStx(ava)
  const selectedView = useStxData(ava, (d) => d.selectedView.get())
  const artifact = useStxData(ava, (d) => d.artifact.get())
  const isConnected = useStxMatches(ava, 'connected')

  if (!selectedView) {
    return (
      <div className="h-32 flex items-center justify-center text-neutral-600">
        <span style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>Select a view</span>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <ValueDisplay label="View" value={selectedView.name} accent="cyan" size="sm" />
        {isConnected && (
          <Button variant="primary" onClick={() => runEffect('subscribeToView', selectedView.id)}>
            Subscribe
          </Button>
        )}
      </div>

      {artifact && (
        <>
          <SectionLabel variant="minimal">Channels</SectionLabel>
          <div className="space-y-1">
            {artifact.channel_bindings.map(b => (
              <div key={b.channel_id} className="flex items-center justify-between p-2 bg-neutral-900/50 rounded">
                <StatusIndicator status={b.active ? 'success' : 'neutral'} label={b.channel_id} />
                {b.row_count !== undefined && (
                  <span className="font-mono text-cyan-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    {b.row_count} rows
                  </span>
                )}
              </div>
            ))}
          </div>

          <SectionLabel variant="minimal">Spec</SectionLabel>
          <CodeBlock>{JSON.stringify(selectedView, null, 2)}</CodeBlock>
        </>
      )}
    </div>
  )
}

// Message Log Panel Content
function MessageLogContent({ ava, variant }: PanelContentProps) {
  const { data } = useStx(ava)
  const messageLog = useStxData(ava, (d) => d.messageLog.get())
  const columnDefs = useMemo(() => createMessageLogColumnDefs(variant), [variant])

  return (
    <div className="p-3 space-y-2 h-full flex flex-col">
      <div className="flex-1 min-h-0 border border-neutral-800 rounded overflow-hidden">
        <TmnlDataGrid<MessageLogEntry>
          variant={variant}
          rowData={messageLog as MessageLogEntry[]}
          columnDefs={columnDefs}
          defaultColDef={{ resizable: true }}
          getRowId={(params) => params.data.id}
          className="h-full"
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-neutral-600" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
          {messageLog.length} message(s)
        </span>
        <Button variant="ghost" onClick={() => data.messageLog.set([])}>Clear</Button>
      </div>
    </div>
  )
}

// =============================================================================
// PANEL CONTROLS (fixed position debug)
// =============================================================================

function PanelControls({ visiblePanels, togglePanel }: {
  visiblePanels: Set<string>
  togglePanel: (id: string) => void
}) {
  const { panels, bringToFront, sendToBack, closePanel, resizeSensitivity } = useFloatingPanel()
  const { selectedIds, selectedCount, hasSelection, deselectAll, group, ungroup } = useSelection()

  return (
    <div
      className="fixed bottom-4 left-4 bg-neutral-900 border border-neutral-800 rounded p-3 space-y-2"
      style={{ zIndex: 10000, minWidth: 200 }}
    >
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <span
          className="font-mono text-neutral-400"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          PANEL CONTROLS
        </span>
        <span
          className={`font-mono ${
            resizeSensitivity === 0.01 ? 'text-green-400' :
            resizeSensitivity === 0.1 ? 'text-amber-400' :
            'text-neutral-500'
          }`}
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {resizeSensitivity}x
        </span>
      </div>

      <div className="space-y-1 max-h-64 overflow-auto">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className="flex items-center justify-between gap-2 px-2 py-1 bg-neutral-800/50 rounded"
          >
            <div className="flex flex-col min-w-0">
              <span
                className="font-mono text-neutral-300 truncate"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {panel.title}
              </span>
              <span
                className="font-mono text-neutral-600"
                style={{ fontSize: '10px' }}
              >
                {Math.round(panel.dimensions.width)}×{Math.round(panel.dimensions.height)}
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => bringToFront(panel.id)}
                className="px-1.5 py-0.5 text-cyan-500 hover:bg-cyan-500/20 rounded"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Bring to front"
              >
                ↑
              </button>
              <button
                onClick={() => sendToBack(panel.id)}
                className="px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/20 rounded"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Send to back"
              >
                ↓
              </button>
              <button
                onClick={() => closePanel(panel.id)}
                className="px-1.5 py-0.5 text-red-500 hover:bg-red-500/20 rounded"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Close"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Selection controls */}
      <div className="pt-2 border-t border-neutral-800 space-y-2">
        <div className="flex items-center justify-between">
          <span
            className={`font-mono ${hasSelection ? 'text-cyan-400' : 'text-neutral-600'}`}
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {selectedCount} selected
          </span>
          {hasSelection && (
            <div className="flex gap-1">
              <button
                onClick={() => group()}
                className="px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/20 rounded font-mono"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Group (Shift+G)"
              >
                G
              </button>
              <button
                onClick={() => ungroup()}
                className="px-1.5 py-0.5 text-purple-500 hover:bg-purple-500/20 rounded font-mono"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Ungroup (Shift+U)"
              >
                U
              </button>
              <button
                onClick={deselectAll}
                className="px-1.5 py-0.5 text-red-500 hover:bg-red-500/20 rounded font-mono"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                title="Deselect all (Esc)"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        {hasSelection && (
          <div
            className="text-neutral-600 font-mono"
            style={{ fontSize: '10px' }}
          >
            {Array.from(selectedIds).map(id => id.replace('ava-', '')).join(', ')}
          </div>
        )}
      </div>

      <div
        className="text-neutral-600 pt-2 border-t border-neutral-800"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Shift=0.1x • Ctrl+Shift=0.01x<br />
        Click=select • Shift+=add • Ctrl+=toggle<br />
        Drag=marquee • Shift+G=group • Esc=clear
      </div>
    </div>
  )
}

// =============================================================================
// PANEL DEFINITIONS
// =============================================================================

interface PanelDef {
  id: string
  title: string
  x: number
  y: number
  w: number
  h: number
}

const PANEL_DEFS: PanelDef[] = [
  { id: 'ava-config', title: 'Config', x: 20, y: 80, w: 360, h: 100 },
  { id: 'ava-hypotheses', title: 'Hypotheses', x: 20, y: 200, w: 360, h: 200 },
  { id: 'ava-connection', title: 'Connection', x: 400, y: 80, w: 320, h: 150 },
  { id: 'ava-views', title: 'Views', x: 400, y: 250, w: 380, h: 280 },
  { id: 'ava-artifact', title: 'Artifact', x: 800, y: 80, w: 400, h: 350 },
  { id: 'ava-messages', title: 'Messages', x: 800, y: 450, w: 400, h: 280 },
  { id: 'ava-repl', title: 'REPL', x: 20, y: 420, w: 450, h: 300 },
  { id: 'ava-state', title: 'State', x: 490, y: 550, w: 380, h: 280 },
  { id: 'ava-sequence', title: 'Sequence', x: 890, y: 750, w: 380, h: 200 },
  { id: 'ava-scenarios', title: 'Scenarios', x: 1220, y: 80, w: 320, h: 300 },
  { id: 'ava-graph', title: 'Graph', x: 1220, y: 400, w: 320, h: 280 },
]

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function AvaTestbed() {
  const ava = getAvaStx()
  const { runEffect } = useStx(ava)
  const variant = tmnlDenseDark

  // Container ref for marquee selection
  const containerRef = useRef<HTMLDivElement>(null)

  // Panel visibility state - all visible by default
  const [visiblePanels, setVisiblePanels] = useState<Set<string>>(
    new Set(PANEL_DEFS.map(p => p.id))
  )

  const togglePanel = useCallback((id: string) => {
    setVisiblePanels(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Initialize
  useEffect(() => {
    runEffect('fetchViews').catch(() => {})
    return () => {
      resetAvaStx()
      resetTestbedStx()
    }
  }, [runEffect])

  // Global click handler for panel selection
  // Since FloatingPanel uses position:fixed, clicks don't bubble through the selectable overlay.
  // We detect clicks inside panel bounds and trigger selection manually.
  // IMPORTANT: Sort by z-index descending to only select the TOPMOST panel.
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Ignore clicks on the header bar and panel controls
      const target = e.target as HTMLElement
      if (target.closest('.fixed.top-0') || target.closest('.fixed.bottom-4.left-4')) {
        return
      }

      // Get all current panels and sort by z-index (highest first)
      const panelsMap = getFloatingStx().data.panels.get()
      const panelsSorted = Array.from(panelsMap.entries())
        .sort(([, a], [, b]) => b.zIndex - a.zIndex)

      const clickX = e.clientX
      const clickY = e.clientY

      // Check if click is inside any panel's bounds - starting from topmost
      for (const [panelId, panel] of panelsSorted) {
        // Skip hidden/minimized panels
        if (panel.visibility === 'hidden' || panel.visibility === 'minimized') {
          continue
        }

        const { x, y } = panel.position
        const { width, height } = panel.dimensions

        if (
          clickX >= x &&
          clickX <= x + width &&
          clickY >= y &&
          clickY <= y + height
        ) {
          // Click is inside this panel (the topmost one) - select it
          const mode: SelectionMode = e.shiftKey ? 'add' : e.ctrlKey || e.metaKey ? 'toggle' : 'replace'
          selectItem(panelId, mode)
          return // Stop at first (topmost) match
        }
      }
    }

    window.addEventListener('click', handleGlobalClick, true) // Capture phase
    return () => window.removeEventListener('click', handleGlobalClick, true)
  }, [])

  const contentProps: PanelContentProps = { ava, variant }

  // Content map
  const panelContent: Record<string, ReactNode> = {
    'ava-config': <ConfigContent {...contentProps} />,
    'ava-hypotheses': <HypothesesContent {...contentProps} />,
    'ava-connection': <ConnectionContent {...contentProps} />,
    'ava-views': <ViewsContent {...contentProps} />,
    'ava-artifact': <ArtifactContent {...contentProps} />,
    'ava-messages': <MessageLogContent {...contentProps} />,
    'ava-repl': <div className="h-full"><ReplConsole /></div>,
    'ava-state': <div className="h-full"><StateInspector /></div>,
    'ava-sequence': <div className="h-full"><SequenceDiagram /></div>,
    'ava-scenarios': <div className="h-full"><ScenarioRunner /></div>,
    'ava-graph': <div className="h-full"><GraphVisualization /></div>,
  }

  return (
    <FloatingPanelProvider>
      <div
        ref={containerRef}
        className="min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden"
      >
        {/* Header Bar */}
        <div className="fixed top-0 left-0 right-0 h-14 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between px-4 z-[200]">
          <div className="flex items-center gap-4">
            <span className="font-mono text-neutral-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              AVA TESTBED
            </span>
            <VersionBadge version="v2" status="experimental" />
          </div>

          {/* Panel Toggles */}
          <div className="flex items-center gap-1 flex-wrap">
            {PANEL_DEFS.map(p => (
              <button
                key={p.id}
                onClick={() => togglePanel(p.id)}
                className={`
                  px-2 py-1 rounded font-mono transition-colors
                  ${visiblePanels.has(p.id)
                    ? 'bg-cyan-900/50 text-cyan-400 border border-cyan-700'
                    : 'text-neutral-600 hover:text-neutral-400 border border-transparent'
                  }
                `}
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {p.title}
              </button>
            ))}
          </div>

          <Button variant="ghost" onClick={() => runEffect('fetchViews')}>
            Refresh
          </Button>
        </div>

        {/* Floating Panels */}
        {PANEL_DEFS.map(p => (
          <ManagedPanel
            key={p.id}
            id={p.id}
            title={p.title}
            initialPosition={{ x: p.x, y: p.y }}
            initialDimensions={{ width: p.w, height: p.h }}
            show={visiblePanels.has(p.id)}
          >
            {panelContent[p.id]}
          </ManagedPanel>
        ))}

        {/* Drag Overlay (ghost during drag) */}
        <FloatingDragOverlay style="ghost" />

        {/* Selection Overlay (marquee selection + hotkeys) */}
        <SelectionOverlay
          containerRef={containerRef}
          selectableSelector="[data-selectable]"
        />

        {/* Panel Controls Debug UI */}
        <PanelControls visiblePanels={visiblePanels} togglePanel={togglePanel} />
      </div>
    </FloatingPanelProvider>
  )
}

export default AvaTestbed
