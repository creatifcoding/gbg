import React from 'react'
import { createRoot } from 'react-dom/client'
import { ScaleProvider } from './lib/scale'
import { morphChatRegistry, MorphChatRegistryProvider } from './lib/morphchat/atoms/registry'
import { SessionDrawer } from './lib/morphchat/components/session-drawer/SessionDrawer'
import { piSessionList$, sessionFetchDiagnostics$, sessionList$ } from './lib/morphchat/atoms/session-manager'
import type { SessionListItem } from './lib/harness/HarnessRuntime'
import type { PiSessionListItem } from './lib/harness/session/v2/pi-session-schemas'
import './index.css'

const SMOKE_INSTANCE_ID = 'session-drawer-smoke'

const smokePiSessions = (): ReadonlyArray<PiSessionListItem> => {
  const now = Date.now()
  return [
    {
      _tag: 'PiSessionListItem',
      ref: {
        _tag: 'PiCliSessionRef',
        id: 'tiny-pi-smoke',
        path: '/tmp/tmnl/tiny-pi-session-smoke.jsonl',
        cwd: '/workspace/tmnl-fixture',
      },
      title: 'Tiny Pi Replay Fixture',
      name: 'Tiny Pi Replay Fixture',
      createdAt: now - 12_000,
      updatedAt: now - 2_000,
      messageCount: 2,
      preview: 'Prime asks a tiny replay question; Val answers without waking the whole archive.',
      allMessagesText: 'Prime asks a tiny replay question. Val answers without waking the whole archive.',
      localProject: true,
      sourceRank: 0,
    },
  ]
}

const smokeSessions = (): ReadonlyArray<SessionListItem> => {
  const now = Date.now()
  return [
    {
      sessionId: 'smoke-session-architecture',
      name: 'Temporal Smoke Contract',
      autoTitle: 'Temporal Smoke Contract',
      tags: ['smoke', 'motion', 'ux'],
      status: 'starred',
      starred: true,
      createdAt: now - 86_400_000,
      updatedAt: now - 90_000,
      messageCount: 42,
      modelId: 'motion-dev',
      provider: 'tmnl-smoke',
      previewSnippet: 'Validate the loading envelope: immediate orientation, quiet indexing texture, settled row geometry.',
      nodeId: 'session-drawer-smoke',
      role: 'validator',
    },
    {
      sessionId: 'smoke-session-pi-cache',
      name: 'Pi Session Cache Sketch',
      autoTitle: 'Pi Session Cache Sketch',
      tags: ['cache', 'pi', 'metadata'],
      status: 'active',
      starred: false,
      createdAt: now - 172_800_000,
      updatedAt: now - 3_600_000,
      messageCount: 27,
      modelId: 'effect-v4',
      provider: 'tmnl-smoke',
      previewSnippet: 'Warm metadata should render instantly, then stale-while-revalidate changed JSONL files without drama.',
      nodeId: 'session-drawer-smoke',
      role: 'architect',
    },
    {
      sessionId: 'smoke-session-agent-browser',
      name: 'Agent Browser Evidence',
      autoTitle: 'Agent Browser Evidence',
      tags: ['agent-browser', 'evidence'],
      status: 'active',
      starred: false,
      createdAt: now - 259_200_000,
      updatedAt: now - 10_800_000,
      messageCount: 18,
      modelId: 'browser-smoke',
      provider: 'tmnl-smoke',
      previewSnippet: 'Capture skeleton and settled states with deterministic data attributes and no Playwright detours.',
      nodeId: 'session-drawer-smoke',
      role: 'operator',
    },
  ]
}

function SessionDrawerSmoke() {
  const [isOpen, setIsOpen] = React.useState(true)
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null)
  const [selectedPi, setSelectedPi] = React.useState<{ readonly path: string; readonly sessionId?: string } | null>(null)
  const searchParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams()
  const seedSettledSessions = searchParams.has('tmnl-session-settled')
  const seedPiReplay = searchParams.has('tmnl-session-pi-replay')

  React.useEffect(() => {
    if (!seedSettledSessions && !seedPiReplay) return

    const sessions = seedSettledSessions ? smokeSessions() : []
    const piSessions = seedPiReplay ? smokePiSessions() : []
    morphChatRegistry.set(sessionList$(SMOKE_INSTANCE_ID), sessions)
    morphChatRegistry.set(piSessionList$(SMOKE_INSTANCE_ID), piSessions)
    morphChatRegistry.set(sessionFetchDiagnostics$(SMOKE_INSTANCE_ID), {
      lastFetchAt: Date.now(),
      serverCount: sessions.length,
      piCount: piSessions.length,
      sampleSessionIds: sessions.map((session) => session.sessionId),
      samplePiSessionIds: piSessions.map((session) => session.ref.id),
      source: 'remote:list_session_sources',
    })
  }, [seedSettledSessions, seedPiReplay])

  return (
    <ScaleProvider>
      <MorphChatRegistryProvider>
        <div
          data-tmnl-session-smoke-root="true"
          data-tmnl-selected-session-id={selectedSessionId ?? ''}
          data-tmnl-selected-pi-path={selectedPi?.path ?? ''}
          data-tmnl-selected-pi-id={selectedPi?.sessionId ?? ''}
          style={{
            width: '100vw',
            height: '100vh',
            display: 'flex',
            justifyContent: 'flex-end',
            overflow: 'hidden',
            background:
              'radial-gradient(circle at 22% 14%, oklch(0.12 0.04 195 / 0.22), transparent 34%), oklch(0.025 0 0)',
            color: 'oklch(0.86 0 0)',
          }}
        >
          <div
            aria-label="Session drawer smoke stage"
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: 32,
              borderRight: '1px solid oklch(0.1 0 0)',
            }}
          >
            <div
              style={{
                maxWidth: 560,
                border: '1px solid oklch(0.14 0 0)',
                borderRadius: 16,
                background: 'oklch(0.045 0 0 / 0.82)',
                padding: 20,
                boxShadow: '0 24px 80px rgba(0, 0, 0, 0.42)',
              }}
            >
              <div
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  fontSize: 'var(--tmnl-text-sm, 14px)',
                  color: 'oklch(0.72 0.12 195)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Temporal smoke harness
              </div>
              <p
                style={{
                  margin: 0,
                  maxWidth: 480,
                  fontSize: 'var(--tmnl-text-base, 16px)',
                  lineHeight: 1.55,
                  color: 'oklch(0.62 0 0)',
                }}
              >
                This page renders the session drawer in isolation so agent-browser can capture
                the Motion.dev loading envelope without disturbing the main workspace.
              </p>
              <button
                type="button"
                data-tmnl-session-smoke-toggle="true"
                onClick={() => setIsOpen((value) => !value)}
                style={{
                  marginTop: 18,
                  borderRadius: 8,
                  border: '1px solid oklch(0.16 0 0)',
                  background: isOpen ? 'oklch(0.1 0.04 195 / 0.55)' : 'oklch(0.07 0 0)',
                  color: isOpen ? 'oklch(0.76 0.14 195)' : 'oklch(0.68 0 0)',
                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                  fontSize: 'var(--tmnl-text-xs, 12px)',
                  padding: '7px 10px',
                  cursor: 'pointer',
                }}
              >
                {isOpen ? 'Close drawer' : 'Open drawer'}
              </button>
            </div>
          </div>

          <SessionDrawer
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            onResumeSession={(sessionId) => {
              setSelectedSessionId(sessionId)
              setSelectedPi(null)
            }}
            onResumePiSession={(path, sessionId) => {
              setSelectedPi({ path, sessionId })
              setSelectedSessionId(`pi:${sessionId ?? path}`)
            }}
            onNewSession={() => {
              setSelectedSessionId(null)
              setSelectedPi(null)
            }}
            currentSessionId={selectedSessionId}
            instanceId={SMOKE_INSTANCE_ID}
            width={420}
          />
        </div>
      </MorphChatRegistryProvider>
    </ScaleProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionDrawerSmoke />
  </React.StrictMode>,
)
