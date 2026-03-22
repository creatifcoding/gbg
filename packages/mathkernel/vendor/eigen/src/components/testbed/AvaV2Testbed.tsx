/**
 * AVA v2 Testbed
 *
 * Demonstrates the AVA v2 reactive streaming system.
 * Uses effect-atom hooks for view subscriptions, artifacts, and monitoring.
 *
 * Route: /testbed/ava-v2
 *
 * HYPOTHESES:
 * - H1: Connection establishes via NATS WebSocket
 * - H2: View subscriptions track correctly
 * - H3: Artifacts received and displayed
 * - H4: Deltas/events monitored in real-time
 *
 * @see .edin/AVA_V2_STRATEGIC_ANALYSIS.md
 * @module testbed/ava-v2
 */

import { useState, useCallback, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  Wifi,
  WifiOff,
  Play,
  Square,
  RefreshCw,
  Eye,
  EyeOff,
  Activity,
  Zap,
  Database,
  Clock,
} from 'lucide-react'
import { Schema } from 'effect'

import { SectionLabel, TestCard } from '@/components/testbed/shared'

// AVA v2 hooks
import {
  useAvaConnection,
  useViewSubscription,
  useAvaMonitor,
  useAllArtifacts,
  useSubscriptions,
  useAvaCleanup,
} from '@/lib/ava/hooks/v2'

import { ViewId } from '@/lib/ava/schemas/v2'

// =============================================================================
// Hypotheses Tracking
// =============================================================================

interface Hypotheses {
  h1_connected: boolean
  h2_subscribed: boolean
  h3_artifactReceived: boolean
  h4_monitoring: boolean
}

const initialHypotheses: Hypotheses = {
  h1_connected: false,
  h2_subscribed: false,
  h3_artifactReceived: false,
  h4_monitoring: false,
}

// ViewId decoder
const decodeViewId = Schema.decodeSync(ViewId)

// =============================================================================
// Component
// =============================================================================

export function AvaV2Testbed() {
  // Hypotheses state
  const [hypotheses, setHypotheses] = useState<Hypotheses>(initialHypotheses)

  // Custom view ID input
  const [viewIdInput, setViewIdInput] = useState('test-view-1')

  // Selected view for inspection
  const [selectedViewId, setSelectedViewId] = useState<string | null>(null)

  // Logs
  const [logs, setLogs] = useState<string[]>([])
  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-29), `[${new Date().toLocaleTimeString()}] ${msg}`])
  }, [])

  // Cleanup on unmount
  useAvaCleanup()

  // Connection hook
  const { status, isConnected, error, config, setConfig } = useAvaConnection()

  // Monitor hook
  const {
    deltas,
    events,
    subscriptionCount,
    startMonitoringArtifacts,
    startMonitoringDeltas,
    startMonitoringEvents,
  } = useAvaMonitor()

  // All artifacts
  const allArtifacts = useAllArtifacts()

  // All subscriptions
  const subscriptions = useSubscriptions()

  // Selected view subscription (if any)
  const viewIdForSubscription = selectedViewId ? decodeViewId(selectedViewId) : null
  const selectedSubscription = viewIdForSubscription
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useViewSubscription(viewIdForSubscription)
    : null

  // Update hypotheses based on state
  useEffect(() => {
    if (isConnected) {
      setHypotheses((h) => ({ ...h, h1_connected: true }))
      log('Connected to NATS')
    }
  }, [isConnected, log])

  useEffect(() => {
    if (subscriptionCount > 0) {
      setHypotheses((h) => ({ ...h, h2_subscribed: true }))
    }
  }, [subscriptionCount])

  useEffect(() => {
    if (allArtifacts.length > 0) {
      setHypotheses((h) => ({ ...h, h3_artifactReceived: true }))
      log(`Received ${allArtifacts.length} artifact(s)`)
    }
  }, [allArtifacts.length, log])

  useEffect(() => {
    if (deltas.length > 0 || events.length > 0) {
      setHypotheses((h) => ({ ...h, h4_monitoring: true }))
    }
  }, [deltas.length, events.length])

  // Handle subscribe
  const handleSubscribe = useCallback(() => {
    if (!viewIdInput.trim()) return
    const viewId = decodeViewId(viewIdInput.trim())
    setSelectedViewId(viewIdInput.trim())
    log(`Subscribing to view: ${viewId}`)
  }, [viewIdInput, log])

  // Handle start monitoring
  const handleStartMonitoring = useCallback(() => {
    startMonitoringArtifacts()
    startMonitoringDeltas()
    startMonitoringEvents()
    log('Started monitoring all streams')
  }, [startMonitoringArtifacts, startMonitoringDeltas, startMonitoringEvents, log])

  return (
    <div className="min-h-screen bg-[var(--tmnl-surface-base)] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/testbed"
          className="flex items-center gap-2 text-[var(--tmnl-text-secondary)] hover:text-[var(--tmnl-text-primary)] transition-colors"
        >
          <ArrowLeft size={16} />
          <span style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>Back to Testbeds</span>
        </Link>
        <h1
          className="font-mono font-bold text-[var(--tmnl-text-primary)]"
          style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
        >
          AVA v2 Testbed
        </h1>
        <span
          className="px-2 py-0.5 rounded bg-[var(--tmnl-accent-cyan)]/20 text-[var(--tmnl-accent-cyan)] font-mono"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          effect-atom
        </span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Connection & Subscription */}
        <div className="space-y-4">
          {/* Connection Status */}
          <SectionLabel>Connection</SectionLabel>
          <TestCard>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <Wifi size={20} className="text-[var(--tmnl-status-success)]" />
                ) : (
                  <WifiOff size={20} className="text-[var(--tmnl-status-error)]" />
                )}
                <span
                  className="font-mono text-[var(--tmnl-text-primary)]"
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  {status}
                </span>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-[var(--tmnl-status-success)]' : 'bg-[var(--tmnl-status-error)]'
                }`}
              />
            </div>

            {error && (
              <div
                className="p-2 rounded bg-[var(--tmnl-status-error)]/10 text-[var(--tmnl-status-error)] mb-4"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                <span className="text-[var(--tmnl-text-muted)]">NATS URL</span>
                <span className="font-mono text-[var(--tmnl-text-secondary)]">{config.natsUrl}</span>
              </div>
              <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                <span className="text-[var(--tmnl-text-muted)]">Subject Prefix</span>
                <span className="font-mono text-[var(--tmnl-text-secondary)]">{config.subjectPrefix}</span>
              </div>
            </div>
          </TestCard>

          {/* View Subscription */}
          <SectionLabel>Subscribe to View</SectionLabel>
          <TestCard>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={viewIdInput}
                onChange={(e) => setViewIdInput(e.target.value)}
                placeholder="Enter view ID..."
                className="flex-1 px-3 py-2 rounded bg-[var(--tmnl-surface-sunken)] border border-[var(--tmnl-surface-border)] text-[var(--tmnl-text-primary)] font-mono"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              />
              <button
                onClick={handleSubscribe}
                disabled={!viewIdInput.trim()}
                className="flex items-center gap-2 px-3 py-2 rounded bg-[var(--tmnl-accent-cyan)] text-black font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                <Play size={14} />
                Subscribe
              </button>
            </div>

            {/* Selected View Actions */}
            {selectedSubscription && (
              <div className="p-3 rounded bg-[var(--tmnl-surface-sunken)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    {selectedViewId}
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedSubscription.isSubscribed ? (
                      <Eye size={14} className="text-[var(--tmnl-status-success)]" />
                    ) : (
                      <EyeOff size={14} className="text-[var(--tmnl-text-muted)]" />
                    )}
                    <div
                      className={`w-2 h-2 rounded-full ${
                        selectedSubscription.isSubscribed
                          ? 'bg-[var(--tmnl-status-success)]'
                          : 'bg-[var(--tmnl-accent-amber)]'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={selectedSubscription.subscribe}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-[var(--tmnl-status-success)]/20 text-[var(--tmnl-status-success)] hover:bg-[var(--tmnl-status-success)]/30 transition-colors"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    <Play size={12} />
                    Start
                  </button>
                  <button
                    onClick={selectedSubscription.unsubscribe}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-[var(--tmnl-status-error)]/20 text-[var(--tmnl-status-error)] hover:bg-[var(--tmnl-status-error)]/30 transition-colors"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    <Square size={12} />
                    Stop
                  </button>
                  <button
                    onClick={() => selectedSubscription.invalidate('manual')}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-[var(--tmnl-accent-amber)]/20 text-[var(--tmnl-accent-amber)] hover:bg-[var(--tmnl-accent-amber)]/30 transition-colors"
                    style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                  >
                    <RefreshCw size={12} />
                    Invalidate
                  </button>
                </div>
              </div>
            )}
          </TestCard>

          {/* Active Subscriptions */}
          <SectionLabel>Active Subscriptions ({subscriptionCount})</SectionLabel>
          <TestCard>
            {subscriptions.length === 0 ? (
              <div
                className="text-center text-[var(--tmnl-text-muted)] py-4"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                No active subscriptions
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {subscriptions.map(([viewId, sub]) => (
                  <div
                    key={viewId}
                    onClick={() => setSelectedViewId(viewId)}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedViewId === viewId
                        ? 'bg-[var(--tmnl-accent-cyan)]/20 border border-[var(--tmnl-accent-cyan)]'
                        : 'bg-[var(--tmnl-surface-sunken)] hover:bg-[var(--tmnl-surface-base)]'
                    }`}
                  >
                    <div
                      className="font-mono text-[var(--tmnl-accent-cyan)]"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      {viewId}
                    </div>
                    <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                      <span className="text-[var(--tmnl-text-muted)]">Deltas</span>
                      <span className="text-[var(--tmnl-text-secondary)]">{sub.deltaCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TestCard>
        </div>

        {/* Center Column: Artifacts & Monitor */}
        <div className="space-y-4">
          {/* Monitor Controls */}
          <SectionLabel>Monitor</SectionLabel>
          <TestCard>
            <button
              onClick={handleStartMonitoring}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded bg-[var(--tmnl-accent-magenta)] text-black font-semibold hover:opacity-90 transition-opacity"
              style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
            >
              <Activity size={16} />
              Start Global Monitoring
            </button>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-[var(--tmnl-accent-amber)]" />
                <div>
                  <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    Deltas
                  </div>
                  <div
                    className="font-mono text-[var(--tmnl-text-primary)]"
                    style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                  >
                    {deltas.length}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={16} className="text-[var(--tmnl-accent-cyan)]" />
                <div>
                  <div className="text-[var(--tmnl-text-muted)]" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                    Events
                  </div>
                  <div
                    className="font-mono text-[var(--tmnl-text-primary)]"
                    style={{ fontSize: 'var(--tmnl-text-lg, 18px)' }}
                  >
                    {events.length}
                  </div>
                </div>
              </div>
            </div>
          </TestCard>

          {/* Artifacts List */}
          <SectionLabel>Artifacts ({allArtifacts.length})</SectionLabel>
          <TestCard>
            {allArtifacts.length === 0 ? (
              <div
                className="text-center text-[var(--tmnl-text-muted)] py-8"
                style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
              >
                No artifacts received
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {allArtifacts.map(([viewId, artifact]) => (
                  <div key={viewId} className="p-3 rounded bg-[var(--tmnl-surface-sunken)]">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="font-mono text-[var(--tmnl-accent-cyan)]"
                        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                      >
                        {viewId}
                      </span>
                      <Database size={14} className="text-[var(--tmnl-text-muted)]" />
                    </div>
                    <div
                      className="text-[var(--tmnl-text-primary)]"
                      style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                    >
                      {artifact.spec.name || 'Unnamed View'}
                    </div>
                    <div className="flex justify-between mt-1" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                      <span className="text-[var(--tmnl-text-muted)]">Channels</span>
                      <span className="text-[var(--tmnl-text-secondary)]">
                        {artifact.channelBindings.length}
                      </span>
                    </div>
                    <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                      <span className="text-[var(--tmnl-text-muted)]">Version</span>
                      <span className="text-[var(--tmnl-text-secondary)]">{artifact.version}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TestCard>

          {/* Recent Deltas */}
          <SectionLabel>Recent Deltas</SectionLabel>
          <TestCard>
            <div className="max-h-[150px] overflow-y-auto">
              {deltas.length === 0 ? (
                <div
                  className="text-center text-[var(--tmnl-text-muted)] py-4"
                  style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
                >
                  No deltas received
                </div>
              ) : (
                <div className="space-y-1">
                  {deltas.slice(-10).map((delta, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 p-1.5 rounded bg-[var(--tmnl-surface-sunken)]"
                      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                    >
                      <Zap size={12} className="text-[var(--tmnl-accent-amber)]" />
                      <span className="font-mono text-[var(--tmnl-text-secondary)]">
                        {delta.viewId}
                      </span>
                      <span className="text-[var(--tmnl-text-muted)]">
                        seq:{delta.sequence}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TestCard>
        </div>

        {/* Right Column: Hypotheses & Logs */}
        <div className="space-y-4">
          {/* Hypotheses */}
          <SectionLabel>Hypotheses</SectionLabel>
          <TestCard>
            {[
              { key: 'h1_connected', label: 'H1: NATS connection established' },
              { key: 'h2_subscribed', label: 'H2: View subscription active' },
              { key: 'h3_artifactReceived', label: 'H3: Artifacts received' },
              { key: 'h4_monitoring', label: 'H4: Real-time monitoring' },
            ].map(({ key, label }) => (
              <div
                key={key}
                className="flex items-center gap-2 py-1"
                style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    hypotheses[key as keyof Hypotheses]
                      ? 'bg-[var(--tmnl-status-success)]'
                      : 'bg-[var(--tmnl-surface-sunken)]'
                  }`}
                />
                <span
                  className={
                    hypotheses[key as keyof Hypotheses]
                      ? 'text-[var(--tmnl-text-primary)]'
                      : 'text-[var(--tmnl-text-muted)]'
                  }
                >
                  {label}
                </span>
              </div>
            ))}

            <div className="mt-4 pt-4 border-t border-[var(--tmnl-surface-border)]">
              <div className="flex justify-between" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
                <span className="text-[var(--tmnl-text-muted)]">Validated</span>
                <span className="font-mono text-[var(--tmnl-accent-cyan)]">
                  {Object.values(hypotheses).filter(Boolean).length} / {Object.keys(hypotheses).length}
                </span>
              </div>
            </div>
          </TestCard>

          {/* Selected Artifact Details */}
          {selectedSubscription?.artifact && (
            <>
              <SectionLabel>Selected Artifact</SectionLabel>
              <TestCard>
                <pre
                  className="p-3 bg-[var(--tmnl-surface-sunken)] rounded font-mono text-[var(--tmnl-text-secondary)] overflow-x-auto"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  <code>
                    {JSON.stringify(
                      {
                        viewId: selectedSubscription.artifact.viewId,
                        spec: selectedSubscription.artifact.spec,
                        version: selectedSubscription.artifact.version,
                        channels: selectedSubscription.artifact.channelBindings.length,
                      },
                      null,
                      2
                    )}
                  </code>
                </pre>
              </TestCard>
            </>
          )}

          {/* Logs */}
          <SectionLabel>Activity Log</SectionLabel>
          <TestCard>
            <div
              className="bg-[var(--tmnl-surface-sunken)] rounded p-3 h-[200px] overflow-y-auto font-mono"
              style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
            >
              {logs.length === 0 ? (
                <div className="text-[var(--tmnl-text-muted)] text-center py-4">No activity yet</div>
              ) : (
                logs.map((logEntry, i) => (
                  <div key={i} className="text-[var(--tmnl-text-muted)] whitespace-pre-wrap">
                    {logEntry}
                  </div>
                ))
              )}
            </div>
          </TestCard>

          {/* Config Editor */}
          <SectionLabel>Configuration</SectionLabel>
          <TestCard>
            <div className="space-y-2">
              <div>
                <label
                  className="block text-[var(--tmnl-text-muted)] mb-1"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  NATS WebSocket URL
                </label>
                <input
                  type="text"
                  value={config.natsUrl}
                  onChange={(e) => setConfig({ natsUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[var(--tmnl-surface-sunken)] border border-[var(--tmnl-surface-border)] text-[var(--tmnl-text-primary)] font-mono"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                />
              </div>
              <div>
                <label
                  className="block text-[var(--tmnl-text-muted)] mb-1"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                >
                  Subject Prefix
                </label>
                <input
                  type="text"
                  value={config.subjectPrefix}
                  onChange={(e) => setConfig({ subjectPrefix: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-[var(--tmnl-surface-sunken)] border border-[var(--tmnl-surface-border)] text-[var(--tmnl-text-primary)] font-mono"
                  style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
                />
              </div>
            </div>
          </TestCard>
        </div>
      </div>
    </div>
  )
}

export default AvaV2Testbed
