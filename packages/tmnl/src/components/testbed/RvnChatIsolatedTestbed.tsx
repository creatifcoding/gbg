import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DateTime } from 'effect'
import { faker } from '@faker-js/faker'
import { connect, StringCodec, type NatsConnection } from 'nats.ws'
import {
  RvnChatIsolated,
  type RvnChatIsolatedAgent,
  type RvnChatIsolatedMessage,
  type RvnChatIsolatedStatusRow,
  type RvnChatIsolatedSendPayload,
} from '@/lib/rvn/chat'
import { AgentTaskLogEntry, type LogLevel } from '@/lib/agents/tasks/schemas'
import { serializeLine } from '@/lib/agents/tasks/codec/jsonl-codec'
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

const EMITTER_NATS_WS_URL = 'ws://127.0.0.1:9222'
const EMITTER_CODEC = StringCodec()
const EMITTER_TASK_IDS = ['rm-001', 'rm-002', 'rm-003', 'rm-004', 'rm-005'] as const
const EMITTER_LEVELS: ReadonlyArray<LogLevel> = [
  'DEBUG',
  'INFO',
  'INFO',
  'WARN',
  'ERROR',
]

const pickLevel = (): LogLevel =>
  EMITTER_LEVELS[Math.floor(Math.random() * EMITTER_LEVELS.length)] ?? 'INFO'

const resolveTaskSubject = (taskId: string): string => `agent.task.${taskId}.logs`

const randomEmitterTaskId = (): string =>
  EMITTER_TASK_IDS[Math.floor(Math.random() * EMITTER_TASK_IDS.length)] ?? 'rm-003'

const makeEmitterEntry = (taskId: string, seq: number): AgentTaskLogEntry => {
  const operation = faker.helpers.arrayElement([
    'archive-spill-checkpoint',
    'durability-ack',
    'hydrate-window',
    'tail-follow',
    'querydsl-filter',
    'outbox-drain',
  ])

  return new AgentTaskLogEntry({
    id: `rvn-testbed-${taskId}-${Date.now()}-${seq}`,
    timestamp: DateTime.unsafeNow(),
    level: pickLevel(),
    source: 'rvn.testbed.emitter',
    message: `${operation} :: ${faker.hacker.phrase()} [seq=${seq}]`,
    parentTaskId: taskId,
    traceId: faker.string.alphanumeric(16),
    spanId: faker.string.alphanumeric(16),
    metadata: {
      seq,
      taskId,
      operation,
      latencyMs: faker.number.int({ min: 3, max: 900 }),
      worker: faker.helpers.arrayElement(['alpha', 'beta', 'gamma', 'delta']),
      lane: faker.helpers.arrayElement(['hot', 'durability', 'archive', 'hydration']),
    },
    payload: {
      sample: faker.number.float({ min: 0, max: 1, precision: 0.001 }),
      status: faker.helpers.arrayElement(['ok', 'warn', 'retry', 'degraded']),
      note: faker.company.catchPhrase(),
    },
  })
}

export function RvnChatIsolatedTestbed() {
  const [activeAgentId, setActiveAgentId] = useState(AGENTS[0]?.id ?? 'agent-prime')
  const [connectionOnline, setConnectionOnline] = useState(true)
  const [messages, setMessages] = useState<ReadonlyArray<RvnChatIsolatedMessage>>(INITIAL_MESSAGES)
  const [draft, setDraft] = useState('')
  const [emitterRunning, setEmitterRunning] = useState(false)
  const [emitterError, setEmitterError] = useState<string | null>(null)
  const [emitterCount, setEmitterCount] = useState(0)

  const emitterNcRef = useRef<NatsConnection | null>(null)
  const emitterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const emitterSeqRef = useRef(0)

  const emitOne = useCallback(() => {
    const nc = emitterNcRef.current
    if (!nc) return

    const taskId = randomEmitterTaskId()
    emitterSeqRef.current += 1

    const entry = makeEmitterEntry(taskId, emitterSeqRef.current)
    const line = serializeLine(entry)

    nc.publish(resolveTaskSubject(taskId), EMITTER_CODEC.encode(line))
    setEmitterCount((prev) => prev + 1)
  }, [])

  const stopEmitter = useCallback(async () => {
    if (emitterTimerRef.current) {
      clearInterval(emitterTimerRef.current)
      emitterTimerRef.current = null
    }

    const nc = emitterNcRef.current
    emitterNcRef.current = null

    if (nc) {
      try {
        await nc.drain()
      } catch {
        await nc.close()
      }
    }

    setEmitterRunning(false)
  }, [])

  const startEmitter = useCallback(async () => {
    if (emitterRunning) return

    try {
      setEmitterError(null)
      const nc = await connect({ servers: EMITTER_NATS_WS_URL })
      emitterNcRef.current = nc

      emitterTimerRef.current = setInterval(() => {
        emitOne()
      }, 350)

      setEmitterRunning(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setEmitterError(`Emitter failed to start: ${message}`)
      await stopEmitter()
    }
  }, [emitOne, emitterRunning, stopEmitter])

  const burstEmit = useCallback(async () => {
    if (!emitterRunning) {
      await startEmitter()
    }

    for (let i = 0; i < 15; i += 1) {
      emitOne()
    }

    const nc = emitterNcRef.current
    if (nc) {
      await nc.flush()
    }
  }, [emitOne, emitterRunning, startEmitter])

  useEffect(() => {
    return () => {
      void stopEmitter()
    }
  }, [stopEmitter])

  const statusRows = useMemo<ReadonlyArray<RvnChatIsolatedStatusRow>>(() => {
    const rows: RvnChatIsolatedStatusRow[] = []

    if (connectionOnline) {
      rows.push({
        id: 'iso-info',
        tone: 'info',
        text: 'S1 • Isolated mount active — no conductor runtime dependency.',
      })
    } else {
      rows.push({
        id: 'iso-offline',
        tone: 'warn',
        text: 'S2 • Connection offline — draft is preserved in composer state.',
      })
    }

    rows.push({
      id: 'iso-emitter',
      tone: emitterRunning ? 'info' : 'warn',
      text: `S3 • Live emitter ${emitterRunning ? 'running' : 'stopped'} — ${emitterCount} logs published.`,
    })

    if (emitterError) {
      rows.push({
        id: 'iso-emitter-error',
        tone: 'error',
        text: `S4 • ${emitterError}`,
      })
    }

    return rows
  }, [connectionOnline, emitterCount, emitterError, emitterRunning])

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
        <div className="rvn-chat-testbed__controls" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="rvn-chat-testbed__toggle havoc-btn"
            onClick={() => setConnectionOnline((value) => !value)}
          >
            Toggle connection ({connectionOnline ? 'online' : 'offline'})
          </button>

          {emitterRunning ? (
            <button
              type="button"
              className="rvn-chat-testbed__toggle havoc-btn"
              onClick={() => {
                void stopEmitter()
              }}
            >
              Stop log emitter
            </button>
          ) : (
            <button
              type="button"
              className="rvn-chat-testbed__toggle havoc-btn"
              onClick={() => {
                void startEmitter()
              }}
            >
              Start log emitter
            </button>
          )}

          <button
            type="button"
            className="rvn-chat-testbed__toggle havoc-btn"
            onClick={() => {
              void burstEmit()
            }}
          >
            Burst ×15
          </button>
        </div>
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
