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
import { MorphChat } from '@/lib/morphchat'
import { createMockChatAdapter } from '@/lib/morphchat/adapters/mock-adapter'
import { Conductor } from '@/lib/morphchat/specs/conductor'
import { useHarnessAdapter } from '@/lib/morphchat/hooks'
import { panelRegistry, type PanelContentProps } from '../panel-registry'

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
    <MorphChat.Surface
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

function MorphChatHarnessPanel({ panelId }: PanelContentProps) {
  // NOTE: useHarnessAdapter is a singleton — all instances share one WS connection.
  // If the harness server isn't running, this will stay in 'idle' or 'error'.
  const { adapter, status, error } = useHarnessAdapter({
    nodeId: 'conductor',
    role: 'general',
    agentName: 'Panel-Agent',
    autoConnect: true,
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {status !== 'connected' && (
        <div
          style={{
            padding: '8px 12px',
            fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            color: status === 'error' ? '#f43f5e' : '#737373',
            borderBottom: '1px solid rgba(38,38,38,0.5)',
            letterSpacing: '0.04em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: status === 'error' ? '#f43f5e' : status === 'connecting' ? '#fbbf24' : '#525252',
            flexShrink: 0,
          }} />
          <span>
            {status === 'connecting' ? 'CONNECTING TO HARNESS…'
              : status === 'error' ? `CONNECTION ERROR: ${error ?? 'unknown'}`
              : 'WAITING FOR HARNESS (/api/harness/ws)'}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MorphChat.Surface
          spec={Conductor}
          adapter={adapter}
          surfaceId={`harness-panel-${panelId}`}
          className="h-full"
        />
      </div>
    </div>
  )
}

// =============================================================================
// Registration
// =============================================================================

export function registerMorphChatVisitors() {
  panelRegistry.register('morphchat', {
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
  })

  panelRegistry.register('morphchat:harness', {
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
  })
}
