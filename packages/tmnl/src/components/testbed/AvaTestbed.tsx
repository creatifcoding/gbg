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
 * @pattern stx tri-library composition (XState + Legend-State + effect-atom)
 * @see src/lib/ava/atoms/ava-stx.ts for state definitions
 * @module
 */

import { useEffect, useMemo } from 'react'
import { Effect } from 'effect'
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

import { useStxData, useStxMatches, useStx } from '@/lib/stx'
import {
  getAvaStx,
  resetAvaStx,
  type ConnectionStatus,
  type MessageLogEntry,
  type ViewSummary,
} from '@/lib/ava/atoms/ava-stx'

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
  // stx State (tri-library composition)
  // ---------------------------------------------------------------------------

  const ava = getAvaStx()
  const { data, runEffect } = useStx(ava)

  // Fine-grained data subscriptions via Legend-State
  const views = useStxData(ava, (d) => d.views.get())
  const selectedView = useStxData(ava, (d) => d.selectedView.get())
  const artifact = useStxData(ava, (d) => d.artifact.get())
  const messageLog = useStxData(ava, (d) => d.messageLog.get())
  const error = useStxData(ava, (d) => d.error.get())
  const config = useStxData(ava, (d) => d.config.get())
  const hypotheses = useStxData(ava, (d) => d.hypotheses.get())

  // Machine state matching
  const isDisconnected = useStxMatches(ava, 'disconnected')
  const isConnecting = useStxMatches(ava, 'connecting')
  const isConnected = useStxMatches(ava, 'connected')
  const isError = useStxMatches(ava, 'error')

  // Derive connection status from machine state
  const connectionStatus: ConnectionStatus = isConnected
    ? 'connected'
    : isConnecting
      ? 'connecting'
      : isError
        ? 'error'
        : 'disconnected'

  // Grid variant
  const variant = tmnlDenseDark
  const viewsColumnDefs = useMemo(() => createViewsColumnDefs(variant), [variant])
  const messageLogColumnDefs = useMemo(() => createMessageLogColumnDefs(variant), [variant])

  // ---------------------------------------------------------------------------
  // Handlers (stx effect execution)
  // ---------------------------------------------------------------------------

  const handleFetchViews = () => {
    runEffect('fetchViews').catch(() => {})
  }

  const handleSelectView = (viewId: string) => {
    runEffect('selectView', viewId).catch(() => {})
  }

  const handleRegisterView = () => {
    runEffect('registerTestView').catch(() => {})
  }

  const handleConnect = () => {
    runEffect('connectSession').catch(() => {})
  }

  const handleDisconnect = () => {
    runEffect('disconnectSession').catch(() => {})
  }

  const handlePing = () => {
    runEffect('sendPing').catch(() => {})
  }

  const handleSubscribe = (viewId: string) => {
    runEffect('subscribeToView', viewId).catch(() => {})
  }

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Auto-fetch views on mount
    handleFetchViews()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetAvaStx()
    }
  }, [])

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
        subtitle="API endpoint"
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
              value={config.baseUrl}
              onChange={(e) => data.config.set({ ...config, baseUrl: e.target.value })}
              className="px-3 py-1 bg-neutral-900 border border-neutral-700 rounded font-mono text-neutral-200 w-64"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            />
          </div>
          <Button variant="ghost" onClick={handleFetchViews}>
            Refresh Views
          </Button>
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
            <Button variant="ghost" onClick={() => data.error.set(null)} className="ml-auto">
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
            description={`Live WebSocket → ${config.baseUrl}`}
            actions={
              <div className="flex items-center gap-2">
                {connectionStatus === 'disconnected' ? (
                  <Button variant="primary" onClick={handleConnect}>
                    Connect
                  </Button>
                ) : (
                  <Button variant="danger" onClick={handleDisconnect}>
                    Disconnect
                  </Button>
                )}
                <Button
                  variant="ghost"
                  onClick={handlePing}
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
                <ValueDisplay label="Endpoint" value={config.baseUrl} accent="cyan" size="sm" />
              )}
            </div>
          </TestCard>

          {/* Views List */}
          <TestCard
            title="Views"
            description="Registered view specifications"
            actions={
              <div className="flex items-center gap-2">
                <Button variant="primary" onClick={handleRegisterView}>
                  + Register
                </Button>
                <Button variant="ghost" onClick={handleFetchViews}>
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
                    handleSelectView(event.data.id)
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
            actions={
              selectedView && connectionStatus === 'connected' ? (
                <Button
                  variant="primary"
                  onClick={() => handleSubscribe(selectedView.id)}
                >
                  Subscribe
                </Button>
              ) : null
            }
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
              <Button variant="ghost" onClick={() => data.messageLog.set([])}>
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
