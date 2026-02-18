import { useMemo, useState } from 'react'
import { DateTime } from 'effect'
import {
  RvnChatIsolated,
  type RvnChatIsolatedAgent,
  type RvnChatIsolatedMessage,
  type RvnChatIsolatedStatusRow,
  type RvnChatIsolatedSendPayload,
} from '@/lib/rvn/chat'
import { AgentTask, type RvnChatInlineTaskItem } from '@/lib/rvn/chat/msg/inline-task-types'

const AGENTS: ReadonlyArray<RvnChatIsolatedAgent> = [
  {
    id: 'agent-prime',
    label: 'Prime-Architect',
    subtitle: 'assistant · composition',
    status: 'online',
  },
  {
    id: 'agent-val',
    label: 'Val-Guard',
    subtitle: 'tool · boundary checks',
    status: 'idle',
  },
  {
    id: 'agent-watch',
    label: 'Ops-Watch',
    subtitle: 'system · telemetry',
    status: 'online',
  },
]

// ── Task factories ───────────────────────────────────────────

const now = DateTime.unsafeNow()
const task = (
  overrides: Omit<RvnChatInlineTaskItem, '_tag' | 'createdAt' | 'updatedAt' | 'dependencies'> & {
    dependencies?: ReadonlyArray<string>
  },
): RvnChatInlineTaskItem => new AgentTask({
  createdAt: now,
  updatedAt: now,
  dependencies: [],
  ...overrides,
})

// ── Analysis tasks (v1 VirtualizedList path) ─────────────────

const ANALYSIS_TASKS: ReadonlyArray<RvnChatInlineTaskItem> = [
  task({
    taskId: 'iso-shell-01',
    title: 'Hydrate shell bands',
    status: 'completed',
    progress: 100,
    assignmentMode: 'dispatcher-assigned',
    claimedBy: 'prime-agent',
    metadata: { phase: 'layout', owner: 'prime-agent' },
  }),
  task({
    taskId: 'iso-shell-02',
    title: 'Attach message shell compounds',
    status: 'running',
    progress: 65,
    message: 'Wiring attachment lane slots…',
    dependencies: ['iso-shell-01'],
    assignmentMode: 'self-select',
    claimedBy: 'val-agent',
    metadata: { phase: 'interaction', owner: 'val-agent' },
  }),
  task({
    taskId: 'iso-shell-03',
    title: 'Finalize transport actions',
    status: 'queued',
    dependencies: ['iso-shell-02'],
    assignmentMode: 'policy-assigned',
    metadata: { phase: 'qa' },
  }),
]

// ── Remediation tasks (v2 InlineTaskShell path) ──────────────

const REMEDIATION_TASKS: ReadonlyArray<RvnChatInlineTaskItem> = [
  task({
    taskId: 'rm-001',
    title: 'Lock intake valve V-4821-A to safe position',
    status: 'completed',
    progress: 100,
    message: 'Valve locked at 62% open — safe operating position confirmed',
    assignmentMode: 'dispatcher-assigned',
    claimedBy: 'actuator-agent',
    metadata: { phase: 'interaction', owner: 'actuator-agent', deliverable: 'Valve lock confirmation' },
  }),
  task({
    taskId: 'rm-002',
    title: 'Deploy pressure relief bypass circuit',
    status: 'completed',
    progress: 100,
    message: 'Bypass circuit PR-4821B activated',
    dependencies: ['rm-001'],
    assignmentMode: 'self-select',
    claimedBy: 'circuit-agent',
    metadata: { phase: 'interaction', owner: 'circuit-agent' },
  }),
  task({
    taskId: 'rm-003',
    title: 'Monitor pressure decay curve for 60s window',
    status: 'running',
    progress: 72,
    message: 'Sample 43/60 — pressure trending toward baseline',
    dependencies: ['rm-002'],
    assignmentMode: 'handoff',
    claimedBy: 'monitor-agent',
    metadata: { phase: 'qa', owner: 'monitor-agent', note: 'Sampling at 1Hz' },
  }),
  task({
    taskId: 'rm-004',
    title: 'Validate pressure within operating envelope',
    status: 'queued',
    dependencies: ['rm-003'],
    assignmentMode: 'policy-assigned',
    metadata: { phase: 'qa', owner: 'qa-agent' },
  }),
  task({
    taskId: 'rm-005',
    title: 'Generate incident report for WO-4821',
    status: 'queued',
    dependencies: ['rm-003', 'rm-004'],
    assignmentMode: 'dispatcher-assigned',
    metadata: { phase: 'brief', owner: 'report-agent' },
  }),
]

// ── Messages ─────────────────────────────────────────────────

const INITIAL_MESSAGES: ReadonlyArray<RvnChatIsolatedMessage> = [
  {
    id: 'boot-1',
    role: 'system',
    text: 'RVN chat isolated testbed online. Conductor visual grammar is mounted.',
    at: 'system · 10:01:12',
  },
  {
    id: 'user-1',
    role: 'user',
    text: 'Compose the shell and inline task lane in isolation.',
    at: 'operator · 10:01:26',
  },
  {
    id: 'assistant-1',
    role: 'assistant',
    text: 'Composition complete. Inline task feed attached.',
    at: 'assistant · 10:01:41',
    tasks: ANALYSIS_TASKS,
    telemetryLabel: 'telemetry',
  },
  {
    id: 'user-2',
    role: 'user',
    text: 'Execute remediation protocol. Lock V-4821-A, deploy bypass, confirm pressure decay.',
    at: 'operator · 10:02:03',
  },
  {
    id: 'assistant-2',
    role: 'assistant',
    text: 'Initiating remediation pipeline for Sector 4 intake valve V-4821-A. 5 tasks dispatched.',
    at: 'assistant · 10:02:06',
    tasks: REMEDIATION_TASKS,
    telemetryLabel: 'remediation',
  },
]

export function RvnChatIsolatedTestbed() {
  const [activeAgentId, setActiveAgentId] = useState(AGENTS[0]?.id ?? 'agent-prime')
  const [connectionOnline, setConnectionOnline] = useState(true)
  const [messages, setMessages] = useState<ReadonlyArray<RvnChatIsolatedMessage>>(INITIAL_MESSAGES)
  const [draft, setDraft] = useState('')

  const statusRows = useMemo<ReadonlyArray<RvnChatIsolatedStatusRow>>(() => {
    if (connectionOnline) {
      return [
        {
          id: 'iso-info',
          tone: 'info',
          text: 'S1 • Isolated mount active — no conductor runtime dependency.',
        },
      ]
    }

    return [
      {
        id: 'iso-offline',
        tone: 'warn',
        text: 'S2 • Connection offline — draft is preserved in composer state.',
      },
    ]
  }, [connectionOnline])

  const connectionState = connectionOnline ? 'online' : 'offline'

  const handleSend = async (payload: RvnChatIsolatedSendPayload) => {
    const at = new Date().toLocaleTimeString()

    const nextUser: RvnChatIsolatedMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: payload.text,
      at: `operator · ${at}`,
    }

    const nextAssistant: RvnChatIsolatedMessage = {
      id: `assistant-${Date.now() + 1}`,
      role: 'assistant',
      text: `Isolated acknowledgement from ${payload.activeAgentId}. Composition remains local and conductor-style themed.`,
      at: `assistant · ${at}`,
    }

    setMessages((prev) => [...prev, nextUser, nextAssistant])
  }

  return (
    <main className="rvn-chat-testbed">
      <header className="rvn-chat-testbed__header">
        <strong className="rvn-chat-testbed__title">RVN Chat Isolated Testbed</strong>
        <button
          type="button"
          className="rvn-chat-testbed__toggle havoc-btn"
          onClick={() => setConnectionOnline((value) => !value)}
        >
          Toggle connection ({connectionOnline ? 'online' : 'offline'})
        </button>
      </header>

      <section className="rvn-chat-testbed__surface">
        <RvnChatIsolated
          title="Conductor-style Isolated Chat"
          subtitle="Shell + message compounds mounted without conductor runtime"
          sessionLabel={`agent:${activeAgentId}`}
          connectionState={connectionState}
          agents={AGENTS}
          activeAgentId={activeAgentId}
          onActiveAgentIdChange={setActiveAgentId}
          statusRows={statusRows}
          messages={messages}
          draft={draft}
          onDraftChange={setDraft}
          onSend={handleSend}
          onReconnect={async () => {
            setConnectionOnline(true)
          }}
          onPause={async () => undefined}
        />
      </section>
    </main>
  )
}
