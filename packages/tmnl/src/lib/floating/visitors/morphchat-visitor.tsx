/**
 * MorphChat Panel Visitor — renders a MorphChat surface inside a panel
 *
 * Registers two visitor IDs:
 *   - `morphchat`       — Mock adapter, fully seeded, for dev/demo
 *   - `morphchat:harness` — Live harness adapter (WebSocket to pi-ai)
 *
 * Each visitor creates an isolated MorphChat.Surface with its own
 * adapter, spec, and surface ID scoped to the panel.
 *
 * @module floating/visitors/morphchat-visitor
 */

import * as React from 'react'
import { useState } from 'react'
import { useAtomValue } from '@effect-atom/atom-react'
import { MorphChatSurface } from '@/lib/morphchat/components/surface-root'
import { MorphChatRegistryProvider } from '@/lib/morphchat/atoms/registry'
import { createMockChatAdapter } from '@/lib/morphchat/adapters/mock-adapter'
import { Conductor } from '@/lib/morphchat/specs/conductor'
import { useHarnessAdapter, sessionId$ } from '@/lib/morphchat/hooks/useHarnessAdapter'
import { SessionDrawer } from '@/lib/morphchat/components/session-drawer/SessionDrawer'
import type { PanelContentProps } from '../panel-registry'
import {
  definePanelVisitor,
  installPanelVisitorsFromLayer,
  makePanelVisitorCatalogLayer,
} from './catalog'

// =============================================================================
// Mock Conductor Panel
// =============================================================================

function MorphChatMockPanel({ panelId }: PanelContentProps) {
  const adapter = React.useMemo(
    () =>
      createMockChatAdapter({
        surface: {
          title: 'CONDUCTOR',
          subtitle: 'PANEL // ' + panelId.toUpperCase(),
          sessionLabel: `panel:${panelId}`,
        },
        seedTasks: true,
        autoRespond: true,
        responseDelayMs: 600,
        latencyMs: 120,
      }),
    [panelId],
  )

  return (
    <MorphChatSurface
      spec={Conductor}
      adapter={adapter}
      surfaceId={`panel-${panelId}`}
      className="h-full"
    />
  )
}

// =============================================================================
// Live Harness Conductor Panel
// =============================================================================

function MorphChatHarnessPanelInner({ panelId }: PanelContentProps) {
  // Each panel is an isolated session — like Cursor agent tabs.
  // The WS transport is shared, but atoms/session/messages are per-instance.
  const { adapter, status, error, newSession, resumeSession, resumePiSession, hardReconnect } = useHarnessAdapter({
    instanceId: panelId,
    // Per-panel node identity guarantees isolated sessions (no cross-panel reuse)
    // while preserving the Conductor role semantics.
    nodeId: `conductor:${panelId}`,
    role: 'general',
    agentName: 'Panel-Agent',
    autoConnect: true,
  })

  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false)

  const currentSessionId = useAtomValue(sessionId$(panelId))
  const canStartSession = status === 'connected'
  const canReconnect = status !== 'connecting'

  const handleResumeSession = React.useCallback((sid: string) => {
    resumeSession(sid)
    setIsSessionDrawerOpen(false)
  }, [resumeSession])

  const handleResumePiSession = React.useCallback((path: string, sid?: string) => {
    resumePiSession(path, sid)
    setIsSessionDrawerOpen(false)
  }, [resumePiSession])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Status bar */}
      <div
        style={{
          padding: '4px 12px',
          fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
          fontSize: 'var(--tmnl-text-xs, 12px)',
          color: status === 'error' ? '#f43f5e' : status === 'connected' ? '#525252' : '#737373',
          borderBottom: '1px solid rgba(38,38,38,0.5)',
          letterSpacing: '0.04em',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: status === 'connected' ? '#22d3ee'
            : status === 'error' ? '#f43f5e'
            : status === 'connecting' ? '#fbbf24'
            : '#525252',
          flexShrink: 0,
        }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {status === 'connecting' ? 'CONNECTING…'
            : status === 'error' ? `ERROR: ${error ?? 'unknown'}`
            : status === 'connected' ? 'CONNECTED'
            : 'WAITING FOR HARNESS'}
        </span>
        <span
          style={{
            color: 'oklch(0.6 0 0)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={currentSessionId ?? 'no active session id'}
        >
          SID:{currentSessionId ?? 'none'}
        </span>

        {/* Sessions toggle — keep diagnostics reachable even when the harness is idle/erroring. */}
        <button
          onClick={() => setIsSessionDrawerOpen(!isSessionDrawerOpen)}
          style={{
            background: isSessionDrawerOpen ? 'rgba(34,211,238,0.12)' : 'rgba(120,113,108,0.06)',
            border: `1px solid ${isSessionDrawerOpen ? 'rgba(34,211,238,0.25)' : 'rgba(120,113,108,0.15)'}`,
            color: isSessionDrawerOpen ? '#67e8f9' : '#a8a29e',
            borderRadius: 4,
            padding: '1px 8px',
            cursor: 'pointer',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontFamily: 'inherit',
            letterSpacing: '0.04em',
            transition: 'all 0.15s ease',
          }}
          title={isSessionDrawerOpen ? 'Close sessions drawer' : 'Browse sessions and harness diagnostics'}
        >
          SESSIONS
        </button>
        {canStartSession && (
          <button
            onClick={newSession}
            style={{
              background: 'rgba(34,211,238,0.08)',
              border: '1px solid rgba(34,211,238,0.2)',
              color: '#67e8f9',
              borderRadius: 4,
              padding: '1px 8px',
              cursor: 'pointer',
              fontSize: 'var(--tmnl-text-xs, 12px)',
              fontFamily: 'inherit',
              letterSpacing: '0.04em',
            }}
            title="Start a new chat session (clears messages)"
          >
            NEW
          </button>
        )}
        {canReconnect && (
          <button
            onClick={hardReconnect}
            style={{
              background: status === 'error' ? 'rgba(244,63,94,0.08)' : 'rgba(120,113,108,0.08)',
              border: `1px solid ${status === 'error' ? 'rgba(244,63,94,0.2)' : 'rgba(120,113,108,0.2)'}`,
              color: status === 'error' ? '#fda4af' : '#a8a29e',
              borderRadius: 4,
              padding: '1px 8px',
              cursor: 'pointer',
              fontSize: 'var(--tmnl-text-xs, 12px)',
              fontFamily: 'inherit',
              letterSpacing: '0.04em',
            }}
            title="Reconnect to harness (rebuilds WebSocket transport)"
          >
            RECONNECT
          </button>
        )}
      </div>

      {/* Content + Session Drawer — horizontal flex for split pane (like AutonomousEditorPanel) */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* Main chat area */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <MorphChatSurface
            spec={Conductor}
            adapter={adapter}
            surfaceId={`harness-panel-${panelId}`}
            className="h-full"
          />
        </div>

        {/* Session drawer — slides in from right, split pane */}
        <SessionDrawer
          isOpen={isSessionDrawerOpen}
          onClose={() => setIsSessionDrawerOpen(false)}
          onResumeSession={handleResumeSession}
          onResumePiSession={handleResumePiSession}
          onNewSession={newSession}
          currentSessionId={currentSessionId}
          instanceId={panelId}
          width={340}
        />
      </div>
    </div>
  )
}

function MorphChatHarnessPanel(props: PanelContentProps) {
  return (
    <MorphChatRegistryProvider>
      <MorphChatHarnessPanelInner {...props} />
    </MorphChatRegistryProvider>
  )
}

// =============================================================================
// Registration
// =============================================================================

export const morphChatPanelVisitors = [
  definePanelVisitor({
    id: 'morphchat',
    label: 'Conductor (Mock)',
    icon: '💬',
    description: 'Full MorphChat conductor with mock data, seeded agents & tasks',
    category: 'chat',
    component: MorphChatMockPanel,
    defaults: {
      width: 480,
      height: 600,
      accent: 'rgba(8, 145, 178, 0.5)',
    },
  }),
  definePanelVisitor({
    id: 'morphchat:harness',
    label: 'Conductor (Live)',
    icon: '🔌',
    description: 'Live MorphChat conductor connected to pi-ai harness runtime',
    category: 'chat',
    stateTier: 'full', // WebSocket — must stay mounted during virtualization
    component: MorphChatHarnessPanel,
    defaults: {
      width: 480,
      height: 600,
      accent: 'rgba(52, 211, 153, 0.5)',
    },
  }),
] as const

export const MorphChatPanelVisitorCatalogLive = makePanelVisitorCatalogLayer(morphChatPanelVisitors)

export function registerMorphChatVisitors() {
  installPanelVisitorsFromLayer(MorphChatPanelVisitorCatalogLive)
}
