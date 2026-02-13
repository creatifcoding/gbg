import { useMemo, useState } from 'react'
import {
  RvnChatIsolated,
  type RvnChatIsolatedAgent,
  type RvnChatIsolatedMessage,
  type RvnChatIsolatedStatusRow,
  type RvnChatIsolatedSendPayload,
} from '@/lib/rvn/chat'

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
    tasks: [
      {
        taskId: 'iso-shell-01',
        title: 'Hydrate shell bands',
        status: 'completed',
        progress: 100,
      },
      {
        taskId: 'iso-shell-02',
        title: 'Attach message shell compounds',
        status: 'running',
        progress: 65,
        message: 'Wiring attachment lane slots…',
      },
      {
        taskId: 'iso-shell-03',
        title: 'Finalize transport actions',
        status: 'queued',
      },
    ],
    telemetryLabel: 'build telemetry',
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
