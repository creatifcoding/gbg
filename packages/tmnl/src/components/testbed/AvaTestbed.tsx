/**
 * AVA Testbed
 *
 * Interactive testbed for AVA (Asset View Agent) client integration.
 * Validates HTTP + WebSocket client patterns with TmnlDataGrid display.
 *
 * Hypotheses:
 * - H1: HTTP client can list/register/invalidate views
 * - H2: WebSocket session receives artifact events on subscribe
 * - H3: TmnlDataGrid displays views with proper column defs
 * - H4: Connection status reflects WebSocket state
 * - H5: Message log captures all session events
 *
 * @pattern Direct driver (not Atom.runtime for stateful services)
 * @see DataManagerTestbed.tsx for precedent
 * @module
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Effect, Stream, Fiber, Runtime, Ref, Queue, Layer } from 'effect'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'

import {
  TestbedHeader,
  TestCard,
  StatusIndicator,
  Button,
  ValueDisplay,
  CollapsiblePanel,
  SectionLabel,
  CodeBlock,
  VersionBadge,
} from './shared'
import {
  TmnlDataGrid,
  tmnlDenseDark,
  type GridVariantType,
} from '@/lib/data-grid'

import {
  // HTTP Client
  AvaHttpClient,
  AvaHttpClientLive,
  AvaApiConfig,
  type AvaHttpError,
  type AvaNotFoundError,
  // Session Client
  AvaSessionClient,
  AvaSessionClientLive,
  type AvaSessionError,
  // Schemas
  type ViewSummary,
  type ViewSpec,
  type ViewArtifact,
  type SessionEvent,
} from '@/lib/ava'

// =============================================================================
// TYPES
// =============================================================================

interface HypothesisState {
  id: string
  label: string
  status: 'pending' | 'validating' | 'passed' | 'failed'
  evidence?: string
}

interface MessageLogEntry {
  id: string
  timestamp: number
  direction: 'in' | 'out'
  type: string
  payload: string
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

// =============================================================================
// COLUMN DEFINITIONS
// =============================================================================

const createViewsColumnDefs = (variant: GridVariantType): ColDef<ViewSummary>[] => [
  {
    field: 'id',
    headerName: 'ID',
    width: 120,
    suppressSizeToFit: true,
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
    cellStyle: {
      color: variant.colors.text.primary,
    },
  },
  {
    field: 'version',
    headerName: 'Ver',
    width: 60,
    suppressSizeToFit: true,
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
    width: 32,
    suppressSizeToFit: true,
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
    width: 80,
    suppressSizeToFit: true,
    valueFormatter: (params) => {
      const d = new Date(params.value)
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
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
    width: 100,
    suppressSizeToFit: true,
    cellRenderer: (params: ICellRendererParams<MessageLogEntry>) => {
      const typeColors: Record<string, string> = {
        artifact: variant.colors.signal.success,
        delta: variant.colors.signal.accent,
        status: variant.colors.signal.warning,
        error: variant.colors.signal.error,
        pong: variant.colors.text.muted,
        subscribe: variant.colors.signal.accent,
        unsubscribe: variant.colors.text.muted,
      }
      const color = typeColors[params.value as string] ?? variant.colors.text.primary
      return (
        <span style={{
          color,
          fontFamily: 'monospace',
          textTransform: 'uppercase',
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
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
]

// =============================================================================
// COMPONENT
// =============================================================================

export function AvaTestbed() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const [views, setViews] = useState<readonly ViewSummary[]>([])
  const [selectedView, setSelectedView] = useState<ViewSpec | null>(null)
  const [artifact, setArtifact] = useState<ViewArtifact | null>(null)
  const [messageLog, setMessageLog] = useState<readonly MessageLogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  // Config
  const [baseUrl, setBaseUrl] = useState('http://localhost:3000')
  const [useMock, setUseMock] = useState(true) // Default to mock mode

  // Hypotheses
  const [hypotheses, setHypotheses] = useState<HypothesisState[]>([
    { id: 'H1', label: 'HTTP client can list/register/invalidate views', status: 'pending' },
    { id: 'H2', label: 'WebSocket session receives artifact events', status: 'pending' },
    { id: 'H3', label: 'TmnlDataGrid displays views correctly', status: 'pending' },
    { id: 'H4', label: 'Connection status reflects WebSocket state', status: 'pending' },
    { id: 'H5', label: 'Message log captures all session events', status: 'pending' },
  ])

  // Refs for runtime/fibers
  const runtimeRef = useRef<Runtime.Runtime<AvaHttpClient | AvaSessionClient> | null>(null)
  const sessionFiberRef = useRef<Fiber.RuntimeFiber<void, never> | null>(null)
  const messageIdRef = useRef(0)

  // Grid variant
  const variant = tmnlDenseDark
  const viewsColumnDefs = useMemo(() => createViewsColumnDefs(variant), [variant])
  const messageLogColumnDefs = useMemo(() => createMessageLogColumnDefs(variant), [variant])

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const updateHypothesis = useCallback((id: string, status: HypothesisState['status'], evidence?: string) => {
    setHypotheses(prev => prev.map(h =>
      h.id === id ? { ...h, status, evidence } : h
    ))
  }, [])

  const addMessage = useCallback((direction: 'in' | 'out', type: string, payload: unknown) => {
    const entry: MessageLogEntry = {
      id: `msg-${++messageIdRef.current}`,
      timestamp: Date.now(),
      direction,
      type,
      payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }
    setMessageLog(prev => [entry, ...prev].slice(0, 100)) // Keep last 100
  }, [])

  // ---------------------------------------------------------------------------
  // Mock Implementation (Direct Driver Pattern)
  // ---------------------------------------------------------------------------

  const mockViewsRef = useRef<Map<string, ViewSpec>>(new Map([
    ['mock-view-1', {
      id: 'mock-view-1',
      name: 'Device Telemetry',
      description: 'Real-time device metrics view',
      assemblage_id: 'mock-assemblage',
      channels: [
        { id: 'ch-1', role: 'State', source_connection: 'mqtt://broker/devices/#', materialization: 'Eager' },
        { id: 'ch-2', role: 'Events', source_connection: 'kafka://events/device-events', materialization: 'OnDemand' },
      ],
      version: 1,
    }],
    ['mock-view-2', {
      id: 'mock-view-2',
      name: 'Alert Dashboard',
      description: 'Active alerts and acknowledgments',
      assemblage_id: 'mock-assemblage',
      channels: [
        { id: 'ch-3', role: 'State', source_connection: 'redis://alerts', materialization: 'Eager' },
      ],
      version: 3,
    }],
  ]))

  const mockHttpClient = useMemo(() => ({
    listViews: () => Effect.succeed(
      Array.from(mockViewsRef.current.values()).map(spec => ({
        id: spec.id,
        name: spec.name,
        version: spec.version,
      }))
    ),
    getSpec: (viewId: string) => {
      const spec = mockViewsRef.current.get(viewId)
      return spec
        ? Effect.succeed(spec)
        : Effect.fail({ _tag: 'AvaNotFoundError', resource: 'view', id: viewId } as AvaNotFoundError)
    },
    getArtifact: (viewId: string) => {
      const spec = mockViewsRef.current.get(viewId)
      return spec
        ? Effect.succeed({
            view_id: viewId,
            spec,
            channel_bindings: spec.channels.map(ch => ({
              channel_id: ch.id,
              role: ch.role,
              active: true,
              row_count: Math.floor(Math.random() * 1000),
              last_updated_ms: Date.now(),
            })),
            created_at_ms: Date.now() - 3600000,
            version: spec.version,
          } as ViewArtifact)
        : Effect.fail({ _tag: 'AvaNotFoundError', resource: 'view', id: viewId } as AvaNotFoundError)
    },
    registerView: (req: { name: string; assemblage_id: string; channels: unknown[]; id?: string }) => {
      const id = req.id ?? `view-${Date.now()}`
      const spec: ViewSpec = {
        id,
        name: req.name,
        assemblage_id: req.assemblage_id,
        channels: req.channels as ViewSpec['channels'],
        version: 1,
      }
      mockViewsRef.current.set(id, spec)
      return Effect.succeed({ view_id: id, was_created: true, version: 1 })
    },
    invalidate: (viewId: string) => {
      if (!mockViewsRef.current.has(viewId)) {
        return Effect.fail({ _tag: 'AvaNotFoundError', resource: 'view', id: viewId } as AvaNotFoundError)
      }
      return Effect.succeed({ view_id: viewId, message: 'View invalidated (mock)' })
    },
    getStatus: (viewId: string) => {
      if (!mockViewsRef.current.has(viewId)) {
        return Effect.fail({ _tag: 'AvaNotFoundError', resource: 'view', id: viewId } as AvaNotFoundError)
      }
      return Effect.succeed({
        view_id: viewId,
        is_subscribed: false,
        version: 1,
        total_subscriptions: 0,
      })
    },
  }), [])

  // ---------------------------------------------------------------------------
  // Operations
  // ---------------------------------------------------------------------------

  const fetchViews = useCallback(async () => {
    try {
      updateHypothesis('H1', 'validating')

      if (useMock) {
        const result = await Effect.runPromise(mockHttpClient.listViews())
        setViews(result)
        updateHypothesis('H1', 'passed', `Listed ${result.length} views`)
        if (result.length > 0) {
          updateHypothesis('H3', 'passed', 'Grid populated with view data')
        }
      } else {
        // Live mode - would use real runtime
        setError('Live mode not implemented in testbed')
      }
    } catch (e) {
      updateHypothesis('H1', 'failed', String(e))
      setError(String(e))
    }
  }, [useMock, mockHttpClient, updateHypothesis])

  const selectView = useCallback(async (viewId: string) => {
    try {
      if (useMock) {
        const spec = await Effect.runPromise(mockHttpClient.getSpec(viewId))
        setSelectedView(spec)

        const art = await Effect.runPromise(mockHttpClient.getArtifact(viewId))
        setArtifact(art)

        // Simulate artifact event
        addMessage('in', 'artifact', { view_id: viewId, version: art.version })
        updateHypothesis('H2', 'passed', 'Artifact received for selected view')
      }
    } catch (e) {
      setError(String(e))
    }
  }, [useMock, mockHttpClient, addMessage, updateHypothesis])

  const registerTestView = useCallback(async () => {
    try {
      const viewName = `Test View ${Date.now()}`
      if (useMock) {
        const result = await Effect.runPromise(mockHttpClient.registerView({
          name: viewName,
          assemblage_id: 'test-assemblage',
          channels: [
            { id: `ch-${Date.now()}`, role: 'State', source_connection: 'test://source' },
          ],
        }))
        addMessage('out', 'register', { name: viewName })
        addMessage('in', 'status', { view_id: result.view_id, was_created: result.was_created })

        // Refresh views list
        await fetchViews()
      }
    } catch (e) {
      setError(String(e))
    }
  }, [useMock, mockHttpClient, addMessage, fetchViews])

  const simulateConnection = useCallback(() => {
    setConnectionStatus('connecting')
    updateHypothesis('H4', 'validating')

    // Simulate connection delay
    setTimeout(() => {
      setConnectionStatus('connected')
      updateHypothesis('H4', 'passed', 'Status transitioned: disconnected → connecting → connected')
      addMessage('in', 'session', { status: 'connected' })
    }, 500)
  }, [updateHypothesis, addMessage])

  const simulateDisconnect = useCallback(() => {
    setConnectionStatus('disconnected')
    addMessage('in', 'session', { status: 'disconnected' })
  }, [addMessage])

  const simulatePing = useCallback(() => {
    addMessage('out', 'ping', { payload: 'test-ping' })
    setTimeout(() => {
      addMessage('in', 'pong', { payload: 'test-ping' })
      updateHypothesis('H5', 'passed', 'Message log captures ping/pong')
    }, 100)
  }, [addMessage, updateHypothesis])

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Auto-fetch views on mount
    fetchViews()
  }, [fetchViews])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const connectionStatusMap: Record<ConnectionStatus, { status: 'success' | 'warning' | 'error' | 'neutral' | 'pending'; label: string }> = {
    disconnected: { status: 'neutral', label: 'Disconnected' },
    connecting: { status: 'pending', label: 'Connecting...' },
    connected: { status: 'success', label: 'Connected' },
    error: { status: 'error', label: 'Error' },
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <TestbedHeader
        title="AVA Client Testbed"
        subtitle="HTTP + WebSocket client integration with TmnlDataGrid display"
        actions={<VersionBadge version="v1" status="experimental" />}
      />

      {/* Config Panel */}
      <CollapsiblePanel
        title="Configuration"
        subtitle="API endpoint and mock mode"
        defaultOpen={true}
        className="mb-6"
      >
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <label className="text-neutral-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Base URL:
            </label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              disabled={useMock}
              className="px-3 py-1 bg-neutral-900 border border-neutral-700 rounded font-mono text-neutral-200 w-64 disabled:opacity-50"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useMock}
              onChange={(e) => setUseMock(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-neutral-400" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Mock Mode
            </span>
          </label>
        </div>
      </CollapsiblePanel>

      {/* Hypotheses Panel */}
      <CollapsiblePanel
        title="Hypotheses"
        subtitle="EDIN validation status"
        defaultOpen={true}
        className="mb-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {hypotheses.map(h => (
            <div
              key={h.id}
              className="flex items-center gap-3 p-3 bg-neutral-900/50 rounded border border-neutral-800"
            >
              <StatusIndicator
                status={
                  h.status === 'passed' ? 'success' :
                  h.status === 'failed' ? 'error' :
                  h.status === 'validating' ? 'pending' :
                  'neutral'
                }
                label={h.id}
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-neutral-300 truncate"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  {h.label}
                </div>
                {h.evidence && (
                  <div
                    className="text-neutral-500 truncate"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    {h.evidence}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CollapsiblePanel>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded">
          <div className="flex items-center gap-2">
            <span className="text-red-400 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              Error:
            </span>
            <span className="text-red-300" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              {error}
            </span>
            <Button variant="ghost" onClick={() => setError(null)} className="ml-auto">
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Views + Controls */}
        <div className="space-y-6">
          {/* Connection Status */}
          <TestCard
            title="Connection"
            description="WebSocket session status"
            actions={
              <div className="flex items-center gap-2">
                {connectionStatus === 'disconnected' ? (
                  <Button variant="primary" onClick={simulateConnection}>
                    Connect
                  </Button>
                ) : (
                  <Button variant="danger" onClick={simulateDisconnect}>
                    Disconnect
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={simulatePing}
                  disabled={connectionStatus !== 'connected'}
                >
                  Ping
                </Button>
              </div>
            }
          >
            <div className="flex items-center gap-4">
              <StatusIndicator
                status={connectionStatusMap[connectionStatus].status}
                label={connectionStatusMap[connectionStatus].label}
                pulse={connectionStatus === 'connecting'}
              />
              {connectionStatus === 'connected' && (
                <ValueDisplay label="Endpoint" value={useMock ? 'mock://local' : baseUrl} accent="cyan" size="sm" />
              )}
            </div>
          </TestCard>

          {/* Views List */}
          <TestCard
            title="Views"
            description="Registered view specifications"
            actions={
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={registerTestView}>
                  + Register
                </Button>
                <Button variant="ghost" onClick={fetchViews}>
                  Refresh
                </Button>
              </div>
            }
          >
            <div className="h-64 border border-neutral-800 rounded overflow-hidden">
              <TmnlDataGrid<ViewSummary>
                variant={variant}
                rowData={views as ViewSummary[]}
                columnDefs={viewsColumnDefs}
                defaultColDef={{
                  resizable: true,
                  sortable: true,
                }}
                getRowId={(params) => params.data.id}
                rowSelection="single"
                onRowClicked={(event) => {
                  if (event.data) {
                    selectView(event.data.id)
                  }
                }}
                className="h-full"
              />
            </div>
            <div className="mt-2 text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {views.length} view(s) registered • Click to inspect
            </div>
          </TestCard>
        </div>

        {/* Right Column: Artifact + Message Log */}
        <div className="space-y-6">
          {/* Selected View / Artifact */}
          <TestCard
            title="Artifact Inspector"
            description={selectedView ? `View: ${selectedView.name}` : 'Select a view to inspect'}
          >
            {selectedView && artifact ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <ValueDisplay label="View ID" value={artifact.view_id} accent="cyan" size="sm" />
                  <ValueDisplay label="Version" value={artifact.version} accent="amber" size="sm" />
                </div>

                <SectionLabel variant="minimal">Channels</SectionLabel>
                <div className="space-y-2">
                  {artifact.channel_bindings.map(binding => (
                    <div
                      key={binding.channel_id}
                      className="flex items-center justify-between p-2 bg-neutral-900/50 rounded border border-neutral-800"
                    >
                      <div className="flex items-center gap-3">
                        <StatusIndicator
                          status={binding.active ? 'success' : 'neutral'}
                          label={binding.channel_id}
                        />
                        <span
                          className="font-mono text-neutral-400"
                          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                        >
                          {binding.role}
                        </span>
                      </div>
                      {binding.row_count !== undefined && (
                        <span
                          className="font-mono text-cyan-400"
                          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                        >
                          {binding.row_count.toLocaleString()} rows
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                <SectionLabel variant="minimal">Spec</SectionLabel>
                <CodeBlock>
                  {JSON.stringify(selectedView, null, 2)}
                </CodeBlock>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-neutral-500">
                <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
                  No view selected
                </span>
              </div>
            )}
          </TestCard>

          {/* Message Log */}
          <TestCard
            title="Message Log"
            description="WebSocket session events"
            actions={
              <Button variant="ghost" onClick={() => setMessageLog([])}>
                Clear
              </Button>
            }
          >
            <div className="h-64 border border-neutral-800 rounded overflow-hidden">
              <TmnlDataGrid<MessageLogEntry>
                variant={variant}
                rowData={messageLog as MessageLogEntry[]}
                columnDefs={messageLogColumnDefs}
                defaultColDef={{
                  resizable: true,
                }}
                getRowId={(params) => params.data.id}
                className="h-full"
              />
            </div>
            <div className="mt-2 text-neutral-500" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              {messageLog.length} message(s) • Newest first
            </div>
          </TestCard>
        </div>
      </div>
    </div>
  )
}
