/**
 * Mock Chat Adapter
 *
 * A full-fidelity mock adapter for testbed and demos.
 * Matches RvnChatIsolated data richness: seeded agents, inline task pipelines
 * (analysis + remediation), connection simulation, status rows, command chips,
 * streaming with token-level simulation, draft state, and active agent tracking.
 *
 * Designed so that when we swap to createHarnessAdapter (HarnessRuntimeBrowser),
 * the component tree needs zero changes — only the adapter instance differs.
 *
 * @module morphchat/adapters/mock-adapter
 */

import { Atom } from '@effect-atom/atom'
import { Effect } from 'effect'
import { DateTime } from 'effect'
import type { MorphChatAdapter, MockAdapterConfig } from '../schemas/adapter-types'
import type {
  ChatMessage,
  ConnectionState,
  StreamingState,
  AgentInfo,
  SendParams,
} from '../schemas/message-types'
import { CONNECTED, DISCONNECTED, STREAMING_IDLE } from '../schemas/message-types'
import { morphChatRegistry } from '../atoms/registry'
import { AgentTask } from '@/lib/chat/msg/inline-task-types'

// =============================================================================
// Status Row (used by StatusBannerView)
// =============================================================================

export interface MockStatusRow {
  readonly id: string
  readonly tone: 'info' | 'warn' | 'error'
  readonly text: string
}

// =============================================================================
// Adapter Config (surface-readable metadata)
// =============================================================================

export interface MockAdapterSurfaceConfig {
  readonly title: string
  readonly subtitle: string
  readonly sessionLabel?: string
  readonly maxChars: number
}

// =============================================================================
// Extended Mock Adapter Config
// =============================================================================

export interface MockAdapterFullConfig extends MockAdapterConfig {
  /** Surface metadata (title, subtitle, sessionLabel) */
  readonly surface?: Partial<MockAdapterSurfaceConfig>
  /** Seed inline tasks for messages that carry them */
  readonly seedTasks?: boolean
  /** Default /command chips */
  readonly commandChips?: ReadonlyArray<MockCommandChip>
}

// =============================================================================
// Mock ID Generation
// =============================================================================

let messageCounter = 0

function createMockId(): string {
  return `mock-${Date.now()}-${++messageCounter}`
}

function createMockTimestamp(): string {
  return new Date().toISOString()
}

// =============================================================================
// Mock Response Pool
// =============================================================================

const MOCK_RESPONSES = [
  'I understand. Let me process that for you.',
  'Interesting perspective. Here\'s what I think...',
  'Analysis complete. The results suggest a multi-layered approach would be optimal.',
  'I\'ve identified three potential solutions. Let me walk you through each one.',
  'That\'s a great question. The short answer is yes, but the nuance is important.',
  'Processing... I found 7 relevant data points across the codebase.',
  'The dependency graph shows a clean DAG with no cycles. Ready to proceed.',
  'I\'ve reviewed the architecture. The MorphChat abstraction is well-structured.',
]

function pickMockResponse(): string {
  return MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]!
}

// =============================================================================
// Seeded Agents — Match RVN's AGENTS array
// =============================================================================

const MOCK_AGENTS: ReadonlyArray<AgentInfo> = [
  {
    id: 'agent-prime',
    name: 'Prime-Architect',
    description: 'assistant · composition',
    isActive: true,
    capabilities: ['architecture', 'orchestration', 'effect-ts'],
  },
  {
    id: 'agent-val',
    name: 'Val-Guard',
    description: 'tool · boundary checks',
    isActive: true,
    capabilities: ['code-review', 'architecture', 'type-safety'],
  },
  {
    id: 'agent-watch',
    name: 'Ops-Watch',
    description: 'system · telemetry',
    isActive: true,
    capabilities: ['monitoring', 'telemetry', 'alerting'],
  },
]

// =============================================================================
// Seeded Inline Tasks — Analysis Pipeline (3 tasks)
// =============================================================================

const now = DateTime.unsafeNow()

function makeTask(
  overrides: Omit<AgentTask, '_tag' | 'createdAt' | 'updatedAt' | 'dependencies'> & {
    dependencies?: ReadonlyArray<string>
  },
): AgentTask {
  return new AgentTask({
    createdAt: now,
    updatedAt: now,
    dependencies: [],
    ...overrides,
  })
}

const ANALYSIS_TASKS: ReadonlyArray<AgentTask> = [
  makeTask({
    taskId: 'iso-shell-01',
    title: 'Hydrate shell bands',
    status: 'completed',
    progress: 100,
    assignmentMode: 'dispatcher-assigned',
    claimedBy: 'prime-agent',
    metadata: { phase: 'layout', owner: 'prime-agent' },
  }),
  makeTask({
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
  makeTask({
    taskId: 'iso-shell-03',
    title: 'Finalize transport actions',
    status: 'queued',
    dependencies: ['iso-shell-02'],
    assignmentMode: 'policy-assigned',
    metadata: { phase: 'qa' },
  }),
]

// =============================================================================
// Seeded Inline Tasks — Remediation Pipeline (5 tasks)
// =============================================================================

const REMEDIATION_TASKS: ReadonlyArray<AgentTask> = [
  makeTask({
    taskId: 'rm-001',
    title: 'Lock intake valve V-4821-A to safe position',
    status: 'completed',
    progress: 100,
    message: 'Valve locked at 62% open — safe operating position confirmed',
    assignmentMode: 'dispatcher-assigned',
    claimedBy: 'actuator-agent',
    metadata: { phase: 'interaction', owner: 'actuator-agent', deliverable: 'Valve lock confirmation' },
  }),
  makeTask({
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
  makeTask({
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
  makeTask({
    taskId: 'rm-004',
    title: 'Validate pressure within operating envelope',
    status: 'queued',
    dependencies: ['rm-003'],
    assignmentMode: 'policy-assigned',
    metadata: { phase: 'qa', owner: 'qa-agent' },
  }),
  makeTask({
    taskId: 'rm-005',
    title: 'Generate incident report for WO-4821',
    status: 'queued',
    dependencies: ['rm-003', 'rm-004'],
    assignmentMode: 'dispatcher-assigned',
    metadata: { phase: 'brief', owner: 'report-agent' },
  }),
]

// =============================================================================
// Seeded Messages — Match RVN's INITIAL_MESSAGES with task payloads
// =============================================================================

function createSeedMessages(seedTasks: boolean): ReadonlyArray<ChatMessage> {
  const base: ChatMessage[] = [
    {
      id: 'boot-1',
      role: 'system',
      authorName: 'System',
      content: 'MorphChat surface initialized. Conductor visual grammar is mounted.',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      status: 'complete',
    },
    {
      id: 'user-1',
      role: 'operator',
      authorName: 'Prime',
      content: 'Compose the shell and inline task lane in isolation.',
      timestamp: new Date(Date.now() - 90000).toISOString(),
      status: 'complete',
    },
    {
      id: 'assistant-1',
      role: 'agent',
      authorName: 'Val',
      agentId: 'agent-val',
      content: 'Composition complete. Inline task feed attached.',
      timestamp: new Date(Date.now() - 75000).toISOString(),
      status: 'complete',
      ...(seedTasks ? { taskIds: ANALYSIS_TASKS.map(t => t.taskId) } : {}),
    },
    {
      id: 'user-2',
      role: 'operator',
      authorName: 'Prime',
      content: 'Execute remediation protocol. Lock V-4821-A, deploy bypass, confirm pressure decay.',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      status: 'complete',
    },
    {
      id: 'assistant-2',
      role: 'agent',
      authorName: 'Val',
      agentId: 'agent-val',
      content: 'Initiating remediation pipeline for Sector 4 intake valve V-4821-A. 5 tasks dispatched.',
      timestamp: new Date(Date.now() - 45000).toISOString(),
      status: 'complete',
      ...(seedTasks ? { taskIds: REMEDIATION_TASKS.map(t => t.taskId) } : {}),
    },
  ]

  return base
}

// =============================================================================
// Default Command Chips
// =============================================================================

/** Typed command chip with label, slash command, and optional description. */
export interface MockCommandChip {
  readonly id: string
  readonly label: string
  readonly command: string
  readonly description?: string
}

const DEFAULT_COMMAND_CHIPS: ReadonlyArray<MockCommandChip> = [
  { id: 'cmd-analyze', label: 'analyze', command: '/analyze', description: 'Run analysis pipeline' },
  { id: 'cmd-remediate', label: 'remediate', command: '/remediate', description: 'Execute remediation' },
  { id: 'cmd-status', label: 'status', command: '/status', description: 'Show system status' },
  { id: 'cmd-help', label: 'help', command: '/help', description: 'Display available commands' },
  { id: 'cmd-export', label: 'export', command: '/export', description: 'Export session data' },
]

// =============================================================================
// Default Status Rows
// =============================================================================

function createDefaultStatusRows(connected: boolean): ReadonlyArray<MockStatusRow> {
  const rows: MockStatusRow[] = []

  if (connected) {
    rows.push({
      id: 'status-info',
      tone: 'info',
      text: 'S1 • MorphChat surface active — adapter bridged, all axes nominal.',
    })
  } else {
    rows.push({
      id: 'status-offline',
      tone: 'warn',
      text: 'S2 • Connection offline — draft is preserved in composer state.',
    })
  }

  return rows
}

// =============================================================================
// Extended MorphChat Adapter (with mock-specific extras)
// =============================================================================

export interface MockChatAdapter extends MorphChatAdapter {
  // ── Mock-specific reactive state ──────────────────────────

  /** Active agent ID (for agent selector) */
  readonly activeAgentId$: Atom.Atom<string>

  /** Status rows (for interruption banners) */
  readonly statusRows$: Atom.Atom<ReadonlyArray<MockStatusRow>>

  /** Command chips (for command band + suggestions) */
  readonly commandChips$: Atom.Atom<ReadonlyArray<MockCommandChip>>

  /** Composer draft text (for command suggestions, char counter) */
  readonly draft$: Atom.Atom<string>

  /** Surface config metadata (title, subtitle, session label) */
  readonly surfaceConfig: MockAdapterSurfaceConfig

  /** Task map: messageId → tasks (for rich message rendering) */
  readonly messageTasks: ReadonlyMap<string, ReadonlyArray<AgentTask>>

  // ── Mock-specific operations ──────────────────────────────

  /** Toggle connection online/offline */
  readonly toggleConnection: () => void

  /** Set active agent */
  readonly setActiveAgent: (agentId: string) => void

  /** Update draft text */
  readonly setDraft: (text: string) => void
}

// =============================================================================
// createMockChatAdapter
// =============================================================================

/**
 * Create a full-fidelity mock chat adapter.
 *
 * Seeds agents, inline tasks (analysis + remediation pipelines), connection
 * simulation, status rows, command chips, streaming, and active agent tracking.
 *
 * When we swap to `createHarnessAdapter()`, the component tree doesn't change —
 * only the adapter instance differs.
 *
 * ```ts
 * const adapter = createMockChatAdapter({
 *   surface: { title: 'COP ASSISTANT', subtitle: 'HAVOC // SYSTEM L2' },
 *   seedTasks: true,
 *   autoRespond: true,
 * })
 * ```
 */
export function createMockChatAdapter(
  config: MockAdapterFullConfig = {},
): MockChatAdapter {
  const {
    initialMessages,
    latencyMs = 100,
    autoRespond = true,
    responseDelayMs = 800,
    surface = {},
    seedTasks = true,
    commandChips: configChips,
  } = config

  const adapterId = `mock-${Date.now()}`

  // ── Surface config ────────────────────────────────────────

  const surfaceConfig: MockAdapterSurfaceConfig = {
    title: surface.title ?? 'COP ASSISTANT',
    subtitle: surface.subtitle ?? 'HAVOC // SYSTEM L2',
    sessionLabel: surface.sessionLabel,
    maxChars: surface.maxChars ?? 2000,
  }

  // ── Seed data ─────────────────────────────────────────────

  const seedMessages = initialMessages ?? createSeedMessages(seedTasks)

  // Message → Tasks mapping (for rich rendering)
  const messageTasks = new Map<string, ReadonlyArray<AgentTask>>()
  if (seedTasks) {
    messageTasks.set('assistant-1', ANALYSIS_TASKS)
    messageTasks.set('assistant-2', REMEDIATION_TASKS)
  }

  // All seeded tasks flattened for the inlineTasks$ atom
  const allTasks: ReadonlyArray<AgentTask> = seedTasks
    ? [...ANALYSIS_TASKS, ...REMEDIATION_TASKS]
    : []

  // ── Create atoms ──────────────────────────────────────────

  const messages$ = Atom.make<ReadonlyArray<ChatMessage>>([...seedMessages])
  morphChatRegistry.mount(messages$)

  const connection$ = Atom.make<ConnectionState>(CONNECTED)
  morphChatRegistry.mount(connection$)

  const streaming$ = Atom.make<StreamingState>(STREAMING_IDLE)
  morphChatRegistry.mount(streaming$)

  const agents$ = Atom.make<ReadonlyArray<AgentInfo>>(MOCK_AGENTS)
  morphChatRegistry.mount(agents$)

  const activeAgentId$ = Atom.make<string>(MOCK_AGENTS[0]?.id ?? 'agent-prime')
  morphChatRegistry.mount(activeAgentId$)

  const inlineTasks$ = Atom.make<ReadonlyArray<unknown>>(allTasks)
  morphChatRegistry.mount(inlineTasks$)

  const statusRows$ = Atom.make<ReadonlyArray<MockStatusRow>>(createDefaultStatusRows(true))
  morphChatRegistry.mount(statusRows$)

  const commandChips$ = Atom.make<ReadonlyArray<MockCommandChip>>(configChips ?? DEFAULT_COMMAND_CHIPS)
  morphChatRegistry.mount(commandChips$)

  const draft$ = Atom.make<string>('')
  morphChatRegistry.mount(draft$)

  // ── Internal helpers ──────────────────────────────────────

  let streamTimeout: ReturnType<typeof setTimeout> | null = null

  function appendMessage(msg: ChatMessage): void {
    const current = morphChatRegistry.get(messages$)
    morphChatRegistry.set(messages$, [...current, msg])
  }

  function simulateStreamResponse(content: string, agentId?: string): void {
    const resolvedAgentId = agentId ?? morphChatRegistry.get(activeAgentId$)
    const agent = MOCK_AGENTS.find(a => a.id === resolvedAgentId)
    const agentName = agent?.name ?? 'Val'

    const msgId = createMockId()
    const words = content.split(' ')
    let buffer = ''
    let wordIndex = 0

    // Start streaming
    morphChatRegistry.set(streaming$, {
      isStreaming: true,
      buffer: '',
      messageId: msgId,
      tokensReceived: 0,
    })

    const streamWord = () => {
      if (wordIndex < words.length) {
        buffer += (wordIndex > 0 ? ' ' : '') + words[wordIndex]
        wordIndex++

        morphChatRegistry.set(streaming$, {
          isStreaming: true,
          buffer,
          messageId: msgId,
          tokensReceived: wordIndex,
        })

        streamTimeout = setTimeout(streamWord, 30 + Math.random() * 60)
      } else {
        // Streaming complete — finalize message
        appendMessage({
          id: msgId,
          role: 'agent',
          authorName: agentName,
          agentId: resolvedAgentId,
          content: buffer,
          timestamp: createMockTimestamp(),
          status: 'complete',
        })

        morphChatRegistry.set(streaming$, STREAMING_IDLE)
        streamTimeout = null
      }
    }

    streamTimeout = setTimeout(streamWord, latencyMs)
  }

  // ── Operations ────────────────────────────────────────────

  const send = (params: SendParams) =>
    Effect.sync(() => {
      const userMsg: ChatMessage = {
        id: createMockId(),
        role: 'operator',
        authorName: 'Prime',
        content: params.content,
        timestamp: createMockTimestamp(),
        status: 'complete',
        thinkingLevel: params.thinkingLevel,
      }
      appendMessage(userMsg)
      morphChatRegistry.set(draft$, '')

      if (autoRespond) {
        setTimeout(() => {
          simulateStreamResponse(pickMockResponse(), params.agentId)
        }, responseDelayMs)
      }
    })

  const cancel = () =>
    Effect.sync(() => {
      if (streamTimeout) {
        clearTimeout(streamTimeout)
        streamTimeout = null
      }
      const current = morphChatRegistry.get(streaming$)
      if (current.isStreaming && current.messageId) {
        appendMessage({
          id: current.messageId,
          role: 'agent',
          authorName: 'Val',
          agentId: 'agent-val',
          content: current.buffer + ' [cancelled]',
          timestamp: createMockTimestamp(),
          status: 'complete',
        })
      }
      morphChatRegistry.set(streaming$, STREAMING_IDLE)
    })

  const reconnect = () =>
    Effect.sync(() => {
      morphChatRegistry.set(connection$, { phase: 'reconnecting', reconnectAttempt: 1 })
      morphChatRegistry.set(statusRows$, [{
        id: 'status-reconnecting',
        tone: 'warn',
        text: 'S3 • Reconnecting to backend…',
      }])
      setTimeout(() => {
        morphChatRegistry.set(connection$, CONNECTED)
        morphChatRegistry.set(statusRows$, createDefaultStatusRows(true))
      }, latencyMs * 3)
    })

  const clear = () =>
    Effect.sync(() => {
      morphChatRegistry.set(messages$, [])
    })

  const dispose = () =>
    Effect.sync(() => {
      if (streamTimeout) {
        clearTimeout(streamTimeout)
        streamTimeout = null
      }
      morphChatRegistry.set(connection$, DISCONNECTED)
      morphChatRegistry.set(streaming$, STREAMING_IDLE)
    })

  // ── Mock-specific operations ──────────────────────────────

  const toggleConnection = (): void => {
    const current = morphChatRegistry.get(connection$)
    if (current.phase === 'connected') {
      morphChatRegistry.set(connection$, DISCONNECTED)
      morphChatRegistry.set(statusRows$, createDefaultStatusRows(false))
    } else {
      morphChatRegistry.set(connection$, { phase: 'reconnecting', reconnectAttempt: 1 })
      morphChatRegistry.set(statusRows$, [{
        id: 'status-reconnecting',
        tone: 'warn',
        text: 'S3 • Reconnecting…',
      }])
      setTimeout(() => {
        morphChatRegistry.set(connection$, CONNECTED)
        morphChatRegistry.set(statusRows$, createDefaultStatusRows(true))
      }, latencyMs * 3)
    }
  }

  const setActiveAgent = (agentId: string): void => {
    morphChatRegistry.set(activeAgentId$, agentId)
  }

  const setDraft = (text: string): void => {
    morphChatRegistry.set(draft$, text)
  }

  // ── Transfer config ───────────────────────────────────────

  const transferConfig = {
    surfaceId: adapterId,
    clusterLabel: 'morphchat-mock',
    enableDrag: true,
    enableDrop: true,
  }

  // ── Return adapter ────────────────────────────────────────

  return {
    adapterId,
    label: 'Mock Adapter',
    messages$,
    connection$,
    streaming$,
    agents$,
    activeAgentId$,
    inlineTasks$,
    statusRows$,
    commandChips$,
    draft$,
    surfaceConfig,
    messageTasks,
    transferConfig,
    send,
    cancel,
    reconnect,
    clear,
    dispose,
    toggleConnection,
    setActiveAgent,
    setDraft,
  }
}
