import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
} from 'react'
import { DateTime } from 'effect'
import { RvnChatShell } from './shell'
import {
  RvnChatMessageShell,
  RvnChatInlineTaskThread,
  getRvnChatRoleIcon,
  RVN_CHAT_ICON_STROKE_WIDTH,
  RVN_CHAT_ROLE_ICON_SIZE,
  RVN_CHAT_UTILITY_ICON_SIZE,
  type RvnChatMessageRole,
  AgentTask,
  type RvnChatInlineTaskItem,
} from './msg'
import { InlineTaskShell } from './msg/inline-task-shell'
import { RvnChatComposer } from './composer'
import { RvnStatusChip, type RvnChatConnectionState } from './status'
import {
  RvnChatCommandBtn,
  RvnChatPauseBtn,
  RvnChatReconnectBtn,
  RvnChatSendBtn,
} from './btn'
import { RvnChatAgentSelector } from './selector'
import { RvnChatInterruptionBanner } from './banner'
import { RvnChatEmptyState } from './empty'
import { RvnChatArtifactCard } from './card'
import { RvnChatFrameCorners } from './frame'
import {
  TransferOverlay,
  useTransferDroppable,
  type TransferReferenceToken,
} from '@/lib/transfer'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  Diamond,
  Mic,
  X,
  Zap,
} from 'lucide-react'

export interface RvnChatIsolatedAgent {
  readonly id: string
  readonly label: string
  readonly subtitle?: string
  readonly status?: string
}

export interface RvnChatIsolatedMessage {
  readonly id: string
  readonly role: RvnChatMessageRole
  readonly text: string
  readonly at: string
  readonly streaming?: boolean
  readonly tasks?: ReadonlyArray<RvnChatInlineTaskItem>
  readonly telemetryLabel?: string
}

export interface RvnChatIsolatedStatusRow {
  readonly id: string
  readonly tone: 'info' | 'warn' | 'error'
  readonly text: string
}

export interface RvnChatIsolatedSendPayload {
  readonly text: string
  readonly activeAgentId: string
}

export interface RvnChatIsolatedProps
  extends Omit<ComponentPropsWithoutRef<'section'>, 'onChange'> {
  title?: string
  subtitle?: string
  sessionLabel?: string
  expansionLevel?: 'l2' | 'l3'
  connectionState?: RvnChatConnectionState
  commandChips?: ReadonlyArray<string>
  statusRows?: ReadonlyArray<RvnChatIsolatedStatusRow>
  agents?: ReadonlyArray<RvnChatIsolatedAgent>
  activeAgentId?: string
  onActiveAgentIdChange?: (agentId: string) => void
  messages?: ReadonlyArray<RvnChatIsolatedMessage>
  draft?: string
  onDraftChange?: (next: string) => void
  onSend?: (payload: RvnChatIsolatedSendPayload) => void | Promise<void>
  onPause?: () => void | Promise<void>
  onReconnect?: () => void | Promise<void>
  onResetSession?: () => void | Promise<void>
  onClose?: () => void | Promise<void>
  disabled?: boolean
  placeholder?: string
  maxChars?: number
}

const DEFAULT_AGENTS: ReadonlyArray<RvnChatIsolatedAgent> = [
  {
    id: 'agent-primary',
    label: 'None',
    subtitle: 'assistant · Effect-TS',
    status: 'online',
  },
]

/**
 * 5 tasks that represent the actual pipeline for generating this artifact card.
 * Designed to stress every InlineTaskDetail field renderer:
 *   - ac-001: completed, no deps (leaf) — tests empty dep badge lane
 *   - ac-002: completed, single dep — tests single badge w/ resolved status dot
 *   - ac-003: running, multi-dep fan-in — tests multi-badge row + progress bar + handoff assignment
 *   - ac-004: blocked, dep on running task — tests blocked status color + unresolved dep
 *   - ac-005: queued, dep chain — tests queued pulse + multi-dep chain badge resolution
 */
const ARTIFACT_CARD_TASKS: ReadonlyArray<RvnChatInlineTaskItem> = (() => {
  const now = DateTime.unsafeNow()
  const t = (overrides: Omit<RvnChatInlineTaskItem, '_tag' | 'createdAt' | 'updatedAt'>): RvnChatInlineTaskItem =>
    new AgentTask({ createdAt: now, updatedAt: now, ...overrides })

  return [
    t({
      taskId: 'ac-001',
      title: 'Aggregate metric payload from telemetry variance envelope',
      status: 'completed',
      progress: 100,
      message: 'Peak 142.7 PSI, baseline 124.1 PSI, delta +15.0%',
      dependencies: [],
      assignmentMode: 'dispatcher-assigned',
      assignedAgentId: 'agent-data-01',
      claimedBy: 'data-agent',
      sessionId: 'sess-ac-01',
      nodeId: 'node-analytics-2',
      toolCallId: 'tc-metric-agg-001',
      toolName: 'metric-aggregator',
      lastSeq: 12,
      metadata: {
        phase: 'schema',
        owner: 'data-agent',
        deliverable: 'Schema.Struct<{ current: number; peak: number; baseline: number; delta: number }>',
      },
    }),
    t({
      taskId: 'ac-002',
      title: 'Classify severity from variance threshold rules',
      status: 'completed',
      progress: 100,
      message: 'Variance +15.0% exceeds warning gate (>10%), below critical (>25%) → severity: warning',
      dependencies: ['ac-001'],
      assignmentMode: 'self-select',
      claimedBy: 'stats-agent',
      sessionId: 'sess-ac-01',
      nodeId: 'node-analytics-2',
      toolCallId: 'tc-severity-002',
      toolName: 'threshold-classifier',
      lastSeq: 18,
      metadata: {
        phase: 'schema',
        owner: 'stats-agent',
        deliverable: 'SeverityTag (warning)',
        note: 'Threshold rules: >10% = warning, >25% = critical',
      },
    }),
    t({
      taskId: 'ac-003',
      title: 'Render ArtifactCard compound layout with metric + sparkline slots',
      status: 'running',
      progress: 64,
      message: 'Header + metric grid mounted, sparkline slot pending SVG data injection',
      dependencies: ['ac-001', 'ac-002'],
      assignmentMode: 'handoff',
      assignedAgentId: 'agent-viz-01',
      claimedBy: 'viz-agent',
      sessionId: 'sess-ac-02',
      nodeId: 'node-render-1',
      toolCallId: 'tc-card-render-003',
      toolName: 'component-scaffold',
      lastSeq: 22,
      metadata: {
        phase: 'layout',
        owner: 'viz-agent',
        deliverable: 'ArtifactCard.Root + ArtifactCard.Header + ArtifactCard.Metric',
        note: 'Sparkline SVG awaiting chart-renderer output',
      },
    }),
    t({
      taskId: 'ac-004',
      title: 'Wire action strip with severity-driven recommendation engine',
      status: 'blocked',
      dependencies: ['ac-003'],
      assignmentMode: 'policy-assigned',
      assignedAgentId: 'agent-correlation-01',
      sessionId: 'sess-ac-02',
      nodeId: 'node-analytics-2',
      lastSeq: 23,
      metadata: {
        phase: 'interaction',
        owner: 'correlation-agent',
        deliverable: 'ArtifactCard.Actions with context-aware next-step CTA',
        note: 'Blocked on ac-003 card layout — action strip requires slot geometry from rendered card frame',
      },
    }),
    t({
      taskId: 'ac-005',
      title: 'Validate card contrast, badge legibility, and dense-read accessibility',
      status: 'queued',
      dependencies: ['ac-003', 'ac-004'],
      assignmentMode: 'dispatcher-assigned',
      assignedAgentId: 'agent-qa-01',
      sessionId: 'sess-ac-03',
      nodeId: 'node-qa-1',
      lastSeq: 24,
      metadata: {
        phase: 'qa',
        owner: 'qa-agent',
        deliverable: 'WCAG 2.1 AA contrast report + dense-read legibility pass',
      },
    }),
  ]
})()

/** @deprecated alias — use ARTIFACT_CARD_TASKS directly */
const DEFAULT_ARTIFACT_CARD_TASKS = ARTIFACT_CARD_TASKS

/**
 * 6 tasks for the remediation pipeline — exercises InlineTaskShell compound.
 * Different status distribution than ARTIFACT_CARD_TASKS to show shell metrics.
 */
const REMEDIATION_TASKS: ReadonlyArray<RvnChatInlineTaskItem> = (() => {
  const now = DateTime.unsafeNow()
  const t = (overrides: Omit<RvnChatInlineTaskItem, '_tag' | 'createdAt' | 'updatedAt'>): RvnChatInlineTaskItem =>
    new AgentTask({ createdAt: now, updatedAt: now, ...overrides })

  return [
    t({
      taskId: 'rm-001',
      title: 'Lock intake valve V-4821-A to safe position',
      status: 'completed',
      progress: 100,
      message: 'Valve locked at 62% open — safe operating position confirmed',
      dependencies: [],
      assignmentMode: 'dispatcher-assigned',
      assignedAgentId: 'agent-actuator-01',
      claimedBy: 'actuator-agent',
      sessionId: 'sess-rm-01',
      nodeId: 'node-field-3',
      toolCallId: 'tc-valve-lock-001',
      toolName: 'valve-controller',
      lastSeq: 4,
      metadata: { phase: 'interaction', owner: 'actuator-agent', deliverable: 'Valve lock confirmation' },
    }),
    t({
      taskId: 'rm-002',
      title: 'Deploy pressure relief bypass circuit',
      status: 'completed',
      progress: 100,
      message: 'Bypass circuit PR-4821B activated — relief path confirmed',
      dependencies: ['rm-001'],
      assignmentMode: 'self-select',
      claimedBy: 'circuit-agent',
      sessionId: 'sess-rm-01',
      nodeId: 'node-field-3',
      toolCallId: 'tc-bypass-002',
      toolName: 'circuit-manager',
      lastSeq: 8,
      metadata: { phase: 'interaction', owner: 'circuit-agent', deliverable: 'Bypass circuit activation' },
    }),
    t({
      taskId: 'rm-003',
      title: 'Monitor pressure decay curve for 60s window',
      status: 'running',
      progress: 72,
      message: 'Sample 43/60 — pressure trending toward baseline (2,180 PSI, target 2,100)',
      dependencies: ['rm-002'],
      assignmentMode: 'handoff',
      assignedAgentId: 'agent-monitor-01',
      claimedBy: 'monitor-agent',
      sessionId: 'sess-rm-02',
      nodeId: 'node-analytics-2',
      toolCallId: 'tc-decay-003',
      toolName: 'pressure-monitor',
      lastSeq: 43,
      metadata: { phase: 'qa', owner: 'monitor-agent', deliverable: 'Pressure decay report', note: 'Sampling at 1Hz' },
    }),
    t({
      taskId: 'rm-004',
      title: 'Validate pressure within operating envelope',
      status: 'queued',
      dependencies: ['rm-003'],
      assignmentMode: 'policy-assigned',
      assignedAgentId: 'agent-qa-02',
      sessionId: 'sess-rm-02',
      nodeId: 'node-qa-1',
      lastSeq: 44,
      metadata: { phase: 'qa', owner: 'qa-agent', deliverable: 'Operating envelope compliance report' },
    }),
    t({
      taskId: 'rm-005',
      title: 'Generate remediation incident report for WO-4821',
      status: 'queued',
      dependencies: ['rm-003', 'rm-004'],
      assignmentMode: 'dispatcher-assigned',
      assignedAgentId: 'agent-report-01',
      sessionId: 'sess-rm-03',
      nodeId: 'node-analytics-2',
      lastSeq: 45,
      metadata: { phase: 'brief', owner: 'report-agent', deliverable: 'Incident report PDF + structured JSON' },
    }),
    t({
      taskId: 'rm-006',
      title: 'Notify operations team via channel broadcast',
      status: 'queued',
      dependencies: ['rm-005'],
      assignmentMode: 'dispatcher-assigned',
      assignedAgentId: 'agent-comms-01',
      sessionId: 'sess-rm-03',
      nodeId: 'node-comms-1',
      lastSeq: 46,
      metadata: { phase: 'interaction', owner: 'comms-agent', deliverable: 'Slack + PagerDuty notification' },
    }),
  ]
})()

const formatNowTime = () => DateTime.toDate(DateTime.unsafeNow()).toLocaleTimeString()

const DEFAULT_MESSAGES: ReadonlyArray<RvnChatIsolatedMessage> = [
  {
    id: 'msg-system-boot',
    role: 'system',
    text: '> Connection established with Node Cluster Alpha.\n> Retrieving telemetry data... [COMPLETE]',
    at: 'SYSTEM • 09:14:02',
  },
  {
    id: 'msg-user-1',
    role: 'user',
    text: 'Analyze pressure variance in Sector 4 intake valves. Reference @WO-4821.',
    at: 'OPERATOR • 09:15:45',
  },
  {
    id: 'msg-assistant-1',
    role: 'assistant',
    text: 'Telemetry indicates pressure fluctuation exceeding normal operating parameters (+15%).',
    at: '09:15:48',
    tasks: DEFAULT_ARTIFACT_CARD_TASKS,
    telemetryLabel: 'telemetry',
  },
  {
    id: 'msg-user-2',
    role: 'user',
    text: 'Execute remediation protocol. Lock V-4821-A, deploy bypass, confirm pressure decay.',
    at: 'OPERATOR • 09:16:12',
  },
  {
    id: 'msg-assistant-2',
    role: 'assistant',
    text: 'Initiating remediation pipeline for Sector 4 intake valve V-4821-A. 6 tasks dispatched.',
    at: '09:16:15',
    tasks: REMEDIATION_TASKS,
    telemetryLabel: 'remediation',
  },
]

const DEFAULT_COMMAND_CHIPS = ['/status', '/alarm', '@WO-4821'] as const

function useControllableState<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): readonly [T, (next: T) => void] {
  const [internalValue, setInternalValue] = useState(defaultValue)
  const isControlled = controlledValue !== undefined
  const value = isControlled ? controlledValue : internalValue

  const setValue = (next: T) => {
    if (!isControlled) {
      setInternalValue(next)
    }
    onChange?.(next)
  }

  return [value, setValue] as const
}

function resolveRoleLabel(role: RvnChatMessageRole): string {
  switch (role) {
    case 'assistant':
      return 'AI AGENT'
    case 'user':
      return 'OPERATOR'
    case 'system':
      return 'SYSTEM'
    case 'tool':
      return 'TOOL'
  }
}

function formatReferenceChipLabel(token: TransferReferenceToken): string {
  if (token.reference.kind === 'task') {
    return `@task:${token.reference.taskId}`
  }

  return `@cluster:${token.reference.clusterId}`
}

function RoleRail({ role }: { role: RvnChatMessageRole }) {
  if (role === 'system') {
    return (
      <div className="rvn-chat__bubble-rail rvn-chat__bubble-rail--system" aria-hidden="true">
        <span className="rvn-chat__bubble-marker rvn-chat__bubble-marker--diamond" />
      </div>
    )
  }

  const Icon = getRvnChatRoleIcon(role)

  if (role === 'user') {
    return (
      <div className="rvn-chat__bubble-rail rvn-chat__bubble-rail--user" aria-hidden="true">
        <span className="rvn-chat__bubble-marker rvn-chat__bubble-marker--square">
          <Icon size={RVN_CHAT_ROLE_ICON_SIZE} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} />
        </span>
      </div>
    )
  }

  return (
    <div className="rvn-chat__bubble-rail rvn-chat__bubble-rail--assistant" aria-hidden="true">
      <span className="rvn-chat__bubble-marker rvn-chat__bubble-marker--solid">
        <Icon size={RVN_CHAT_ROLE_ICON_SIZE} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} />
      </span>
    </div>
  )
}

function AssistantAnalysisCard({
  summary,
  messageId,
  expansionLevel,
  tasks,
}: {
  summary: string
  messageId: string
  expansionLevel: 'l2' | 'l3'
  tasks?: ReadonlyArray<RvnChatInlineTaskItem>
}) {
  return (
    <RvnChatArtifactCard className="rvn-chat__analysis-card">
      <RvnChatArtifactCard.Header className="rvn-chat__analysis-card-header">
        <span className="rvn-chat__analysis-title">
          <BarChart3 size={RVN_CHAT_UTILITY_ICON_SIZE} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} className="rvn-chat__analysis-title-icon" />
          ANALYSIS: SECTOR 4
        </span>
        <span className="rvn-chat__analysis-variance">
          <AlertTriangle size={RVN_CHAT_UTILITY_ICON_SIZE} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} className="rvn-chat__analysis-variance-icon" />
          VARIANCE DETECTED
        </span>
      </RvnChatArtifactCard.Header>

      <RvnChatArtifactCard.Body className="rvn-chat__analysis-card-body">
        <p className="rvn-chat__analysis-copy">{summary}</p>

        <div className="rvn-chat__analysis-grid">
          <RvnChatArtifactCard.Metric className="rvn-chat__analysis-metric">
            <span className="rvn-chat__analysis-metric-label">Target Pressure</span>
            <span className="rvn-chat__analysis-metric-value">2,100 PSI</span>
          </RvnChatArtifactCard.Metric>

          <RvnChatArtifactCard.Metric className="rvn-chat__analysis-metric rvn-chat__analysis-metric--alert">
            <span className="rvn-chat__analysis-metric-label">Current Reading</span>
            <span className="rvn-chat__analysis-metric-value">2,415 PSI</span>
          </RvnChatArtifactCard.Metric>
        </div>

        <RvnChatArtifactCard.Actions className="rvn-chat__analysis-actions">
          <button type="button" className="rvn-chat__analysis-action havoc-btn">View Logs</button>
          <button type="button" className="rvn-chat__analysis-action havoc-btn">Override Safety</button>
        </RvnChatArtifactCard.Actions>
      </RvnChatArtifactCard.Body>

      {tasks && tasks.length > 0 ? (
        <RvnChatMessageShell.AttachmentLane.Root messageAnchorId={messageId}>
          <RvnChatMessageShell.AttachmentLane.InlineTaskThread>
            <InlineTaskShell
              threadId={`assistant:${messageId}`}
              tasks={tasks}
              defaultExpanded
            >
              <InlineTaskShell.ExpandBand />
              <InlineTaskShell.MetricsBand />
              <InlineTaskShell.ThreadBand estimatedRowHeight={44} overscan={8} />
              <InlineTaskShell.SearchBand placeholder="Filter tasks…" />
            </InlineTaskShell>
          </RvnChatMessageShell.AttachmentLane.InlineTaskThread>
        </RvnChatMessageShell.AttachmentLane.Root>
      ) : null}
    </RvnChatArtifactCard>
  )
}

/**
 * Remediation card — uses InlineTaskShell compound instead of VirtualizedList.
 * This is the v2 rendering path.
 */
function AssistantRemediationCard({
  summary,
  messageId,
  tasks,
}: {
  summary: string
  messageId: string
  tasks: ReadonlyArray<RvnChatInlineTaskItem>
}) {
  return (
    <RvnChatArtifactCard className="rvn-chat__analysis-card">
      <RvnChatArtifactCard.Header className="rvn-chat__analysis-card-header">
        <span className="rvn-chat__analysis-title">
          <Zap size={RVN_CHAT_UTILITY_ICON_SIZE} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} className="rvn-chat__analysis-title-icon" />
          REMEDIATION: V-4821-A
        </span>
        <span className="rvn-chat__analysis-variance">
          <Diamond size={RVN_CHAT_UTILITY_ICON_SIZE} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} className="rvn-chat__analysis-variance-icon" />
          PIPELINE ACTIVE
        </span>
      </RvnChatArtifactCard.Header>

      <RvnChatArtifactCard.Body className="rvn-chat__analysis-card-body">
        <p className="rvn-chat__analysis-copy">{summary}</p>
      </RvnChatArtifactCard.Body>

      <RvnChatMessageShell.AttachmentLane.Root messageAnchorId={messageId}>
        <RvnChatMessageShell.AttachmentLane.InlineTaskThread>
          <InlineTaskShell
            threadId={`remediation:${messageId}`}
            tasks={tasks}
            defaultExpanded
          >
            <InlineTaskShell.ExpandBand label="Remediation Pipeline" />
            <InlineTaskShell.MetricsBand />
            <InlineTaskShell.ThreadBand estimatedRowHeight={44} overscan={8} />
            <InlineTaskShell.SearchBand placeholder="Filter remediation tasks…" />
          </InlineTaskShell>
        </RvnChatMessageShell.AttachmentLane.InlineTaskThread>
      </RvnChatMessageShell.AttachmentLane.Root>
    </RvnChatArtifactCard>
  )
}

export function RvnChatIsolated({
  title = 'COP ASSISTANT',
  subtitle = 'HAVOC // SYSTEM L2',
  sessionLabel,
  expansionLevel = 'l3',
  connectionState = 'connecting',
  commandChips = DEFAULT_COMMAND_CHIPS,
  statusRows = [],
  agents = DEFAULT_AGENTS,
  activeAgentId,
  onActiveAgentIdChange,
  messages,
  draft,
  onDraftChange,
  onSend,
  onPause,
  onReconnect,
  onResetSession,
  onClose,
  disabled = false,
  placeholder = 'Ask about work orders, alarms, sensors...',
  maxChars = 2000,
  style,
  className,
  ...props
}: RvnChatIsolatedProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [mode, setMode] = useState<'terminal' | 'ai'>('ai')
  const [thinkingLevel, setThinkingLevel] = useState<'none' | 'low' | 'med' | 'high'>('med')

  const [internalMessages, setInternalMessages] = useState<ReadonlyArray<RvnChatIsolatedMessage>>(
    DEFAULT_MESSAGES,
  )
  const resolvedMessages = messages ?? internalMessages

  const [resolvedDraft, setResolvedDraft] = useControllableState(draft, '', onDraftChange)
  const [composerReferences, setComposerReferences] = useState<
    ReadonlyArray<TransferReferenceToken>
  >([])
  const [composerDropError, setComposerDropError] = useState<string | null>(null)
  const [inspectedClusterTokenId, setInspectedClusterTokenId] = useState<string | null>(null)

  const defaultAgentId = agents[0]?.id ?? 'agent-primary'
  const [resolvedActiveAgentId, setResolvedActiveAgentId] = useControllableState(
    activeAgentId,
    defaultAgentId,
    onActiveAgentIdChange,
  )

  useEffect(() => {
    if (!agents.some((agent) => agent.id === resolvedActiveAgentId) && agents[0]) {
      setResolvedActiveAgentId(agents[0].id)
    }
  }, [agents, resolvedActiveAgentId, setResolvedActiveAgentId])

  const activeAgent = useMemo(
    () => agents.find((agent) => agent.id === resolvedActiveAgentId) ?? agents[0],
    [agents, resolvedActiveAgentId],
  )

  const composerDropIntent = useMemo(
    () => ({
      targetId: `rvn-composer:${activeAgent?.id ?? 'none'}`,
      acceptedKinds: ['task', 'task-cluster'] as const,
      insertMode: 'inline-chip' as const,
    }),
    [activeAgent?.id],
  )

  const { droppableProps: composerDroppableProps, hoverState: composerHoverState } =
    useTransferDroppable({
      intent: composerDropIntent,
      onDropToken: (token) => {
        setComposerDropError(null)
        setComposerReferences((prev) => {
          if (prev.some((entry) => entry.tokenId === token.tokenId)) {
            return prev
          }
          return [...prev, token]
        })
      },
      onRejected: (_token, reason) => {
        setComposerDropError(reason)
      },
    })

  const composerRef = useRef<HTMLDivElement | null>(null)
  const streaming = resolvedMessages.some((entry) => entry.streaming)

  const filteredSuggestions = useMemo(() => {
    const query = resolvedDraft.trim().toLowerCase()
    if (!query.startsWith('/')) {
      return []
    }

    return commandChips
      .filter((chip) => chip.toLowerCase().startsWith(query))
      .slice(0, 4)
  }, [commandChips, resolvedDraft])

  const inspectedCluster = useMemo(() => {
    if (!inspectedClusterTokenId) {
      return null
    }

    const token = composerReferences.find((entry) => entry.tokenId === inspectedClusterTokenId)
    if (!token || token.reference.kind !== 'task-cluster') {
      return null
    }

    return token
  }, [composerReferences, inspectedClusterTokenId])

  const submit = async () => {
    const text = resolvedDraft.trim()
    const hasReferences = composerReferences.length > 0
    if ((!text && !hasReferences) || disabled || !activeAgent) {
      return
    }

    const referenceText = composerReferences.map(formatReferenceChipLabel).join(' ')
    const payloadText = [text, referenceText].filter(Boolean).join('\n').trim()

    if (!messages) {
      setInternalMessages((prev) => [
        ...prev,
        {
          id: `msg-user-${Date.now()}`,
          role: 'user',
          text: payloadText,
          at: `OPERATOR • ${formatNowTime()}`,
        },
      ])
    }

    setResolvedDraft('')
    setComposerReferences([])
    setComposerDropError(null)
    setInspectedClusterTokenId(null)

    if (onSend) {
      await onSend({ text: payloadText, activeAgentId: activeAgent.id })
      return
    }

    if (!messages) {
      window.setTimeout(() => {
        setInternalMessages((prev) => [
          ...prev,
          {
            id: `msg-assistant-${Date.now()}`,
            role: 'assistant',
            text: `Telemetry indicates pressure fluctuation exceeding normal operating parameters after command: ${text}`,
            at: `${formatNowTime()}`,
            tasks: [
              new AgentTask({
                taskId: `task-${Date.now()}-a`,
                title: 'Analyze incoming telemetry',
                status: 'running',
                progress: 64,
                dependencies: [],
                createdAt: DateTime.unsafeNow(),
                updatedAt: DateTime.unsafeNow(),
              }),
              new AgentTask({
                taskId: `task-${Date.now()}-b`,
                title: 'Draft remediation options',
                status: 'queued',
                dependencies: [],
                createdAt: DateTime.unsafeNow(),
                updatedAt: DateTime.unsafeNow(),
              }),
            ],
          },
        ])
      }, 180)
    }
  }

  const onComposerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (streaming) {
        if (onPause) {
          void onPause()
        }
        return
      }

      void submit()
    }
  }

  return (
    <RvnChatShell.Root
      expansionLevel={expansionLevel}
      guardMode="strict"
      className={cn('rvn-chat--react-app', className)}
      style={style}
      {...props}
    >
      <RvnChatShell.HeaderBand data-slot="rvn-chat-shell-header-band">
        <RvnChatShell.HeaderBand.Left>
          <RvnChatShell.HeaderBand.Title>{title}</RvnChatShell.HeaderBand.Title>
          <RvnChatShell.HeaderBand.Subtitle>{subtitle}</RvnChatShell.HeaderBand.Subtitle>
        </RvnChatShell.HeaderBand.Left>

        <RvnChatShell.HeaderBand.Center>
          <RvnChatShell.HeaderBand.Badges>
            <RvnStatusChip state={connectionState} showDot>
              {connectionState}
            </RvnStatusChip>
            <RvnStatusChip state="idle" showDot>
              idle
            </RvnStatusChip>
          </RvnChatShell.HeaderBand.Badges>
        </RvnChatShell.HeaderBand.Center>

        <RvnChatShell.HeaderBand.Right>
          <RvnChatShell.HeaderBand.Controls>
            <button
              type="button"
              className="rvn-chat__control-btn rvn-chat__control-btn--primary havoc-btn"
              onClick={() => void onResetSession?.()}
            >
              Collapse L2
            </button>
            <button
              type="button"
              className="rvn-chat__control-btn havoc-btn"
              onClick={() => void onResetSession?.()}
            >
              Reset Session
            </button>
            <button
              type="button"
              aria-label="Close chat"
              className="rvn-chat__control-btn rvn-chat__control-btn--icon havoc-btn"
              onClick={() => void onClose?.()}
            >
              <X size={RVN_CHAT_ROLE_ICON_SIZE} strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH} aria-hidden="true" />
            </button>

            <RvnChatAgentSelector open={menuOpen}>
              <RvnChatAgentSelector.Trigger
                className="havoc-btn rvn-chat__agent-selector-trigger"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <span>agent: {activeAgent?.label ?? 'none'}</span>
                <ChevronDown
                  size={RVN_CHAT_UTILITY_ICON_SIZE}
                  strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
                  aria-hidden="true"
                />
              </RvnChatAgentSelector.Trigger>

              {menuOpen ? (
                <RvnChatAgentSelector.Menu>
                  {agents.map((agent) => (
                    <RvnChatAgentSelector.Option
                      key={agent.id}
                      aria-selected={agent.id === resolvedActiveAgentId}
                      data-state={agent.id === resolvedActiveAgentId ? 'active' : 'idle'}
                      onClick={() => {
                        setResolvedActiveAgentId(agent.id)
                        setMenuOpen(false)
                      }}
                    >
                      <span className="rvn-chat__agent-selector-option-title">{agent.label}</span>
                      <span className="rvn-chat__agent-selector-option-subtitle">
                        {agent.subtitle ?? agent.status ?? 'available'}
                      </span>
                    </RvnChatAgentSelector.Option>
                  ))}
                </RvnChatAgentSelector.Menu>
              ) : null}
            </RvnChatAgentSelector>

            {sessionLabel ? <RvnStatusChip state="idle">{sessionLabel}</RvnStatusChip> : null}
          </RvnChatShell.HeaderBand.Controls>
        </RvnChatShell.HeaderBand.Right>
      </RvnChatShell.HeaderBand>

      <RvnChatShell.CommandBand data-slot="rvn-chat-shell-command-band">
        {commandChips.map((chip) => (
          <RvnChatCommandBtn
            key={chip}
            className="havoc-btn"
            active={resolvedDraft.trim().toLowerCase().startsWith(chip.toLowerCase())}
            onClick={() => {
              setResolvedDraft(chip)
              composerRef.current?.focus()
            }}
          >
            {chip}
          </RvnChatCommandBtn>
        ))}

        <div className="rvn-chat__command-spacer" />
        <span className="rvn-chat__monitor-active">
          <Zap
            size={RVN_CHAT_UTILITY_ICON_SIZE}
            strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
            className="rvn-chat__monitor-active-icon"
            aria-hidden="true"
          />
          SYS_MONITOR_ACTIVE
        </span>
      </RvnChatShell.CommandBand>

      <RvnChatShell.ThreadBand data-slot="rvn-chat-shell-thread-band" autoScroll="follow">
        {statusRows.map((row) => (
          <RvnChatInterruptionBanner key={row.id} tone={row.tone}>
            <span className="rvn-chat__thread-status-row">
              <AlertTriangle
                size={RVN_CHAT_UTILITY_ICON_SIZE}
                strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
                aria-hidden="true"
              />
              <span>{row.text}</span>
            </span>
          </RvnChatInterruptionBanner>
        ))}

        {resolvedMessages.length === 0 ? (
          <RvnChatEmptyState>◇ No messages yet. Start from the composer below.</RvnChatEmptyState>
        ) : (
          resolvedMessages.map((message) => (
            <div key={message.id} className={cn('rvn-chat__bubble-row', `rvn-chat__bubble-row--${message.role}`)}>
              <RoleRail role={message.role} />

              <div className="rvn-chat__bubble-main">
                <RvnChatMessageShell.Root
                  role={message.role}
                  streaming={message.streaming}
                  messageAnchorId={message.id}
                >
                  <RvnChatMessageShell.HeaderCluster.Root>
                    <span className="rvn-chat__message-tag">{resolveRoleLabel(message.role)}</span>
                    <RvnChatMessageShell.HeaderCluster.Timestamp>
                      {message.at}
                    </RvnChatMessageShell.HeaderCluster.Timestamp>
                  </RvnChatMessageShell.HeaderCluster.Root>

                  {message.role === 'assistant' && message.telemetryLabel === 'remediation' && message.tasks ? (
                    <AssistantRemediationCard
                      summary={message.text}
                      messageId={message.id}
                      tasks={message.tasks}
                    />
                  ) : message.role === 'assistant' ? (
                    <AssistantAnalysisCard
                      summary={message.text}
                      messageId={message.id}
                      expansionLevel={expansionLevel}
                      tasks={message.tasks}
                    />
                  ) : message.role === 'user' ? (
                    <RvnChatMessageShell.BodyContent.Root className="rvn-chat__user-bubble">
                      {message.text}
                    </RvnChatMessageShell.BodyContent.Root>
                  ) : (
                    <RvnChatMessageShell.BodyContent.Root className="rvn-chat__system-log">
                      {message.text}
                      {message.streaming ? <RvnChatMessageShell.BodyContent.StreamCursor /> : null}
                    </RvnChatMessageShell.BodyContent.Root>
                  )}
                </RvnChatMessageShell.Root>
              </div>
            </div>
          ))
        )}

        <div className="rvn-chat__thread-tail">
          <span className="rvn-chat__thread-tail-marker" aria-hidden="true" />
          No new messages. Use /commands or @mentions.
        </div>
      </RvnChatShell.ThreadBand>

      <RvnChatShell.ComposerBand data-slot="rvn-chat-shell-composer-band">
        <RvnChatComposer.Root>
          {filteredSuggestions.length > 0 ? (
            <RvnChatComposer.Suggestions.Root>
              {filteredSuggestions.map((entry) => (
                <RvnChatComposer.Suggestions.Item
                  key={entry}
                  onClick={() => {
                    setResolvedDraft(entry)
                    composerRef.current?.focus()
                  }}
                >
                  {entry}
                </RvnChatComposer.Suggestions.Item>
              ))}
            </RvnChatComposer.Suggestions.Root>
          ) : null}

          <RvnChatComposer.Input.Root
            className="rvn-chat__composer-dropzone"
            data-transfer-hover-state={composerHoverState}
            {...composerDroppableProps}
          >
            {composerReferences.length > 0 ? (
              <>
                <div className="rvn-chat__composer-reference-lane" data-slot="rvn-chat-composer-reference-lane">
                  {composerReferences.map((token) => (
                    <button
                      key={token.tokenId}
                      type="button"
                      className="rvn-chat__composer-reference-chip"
                      onClick={(event) => {
                        if (token.reference.kind === 'task-cluster' && !(event.metaKey || event.ctrlKey || event.shiftKey)) {
                          setInspectedClusterTokenId((current) =>
                            current === token.tokenId ? null : token.tokenId,
                          )
                          return
                        }

                        setComposerReferences((prev) =>
                          prev.filter((entry) => entry.tokenId !== token.tokenId),
                        )

                        if (inspectedClusterTokenId === token.tokenId) {
                          setInspectedClusterTokenId(null)
                        }
                      }}
                      title={
                        token.reference.kind === 'task-cluster'
                          ? `Inspect cluster (${token.reference.taskIds.length} tasks) · hold modifier and click to remove`
                          : 'Remove reference'
                      }
                    >
                      {formatReferenceChipLabel(token)}
                    </button>
                  ))}
                </div>

                {inspectedCluster ? (
                  <div
                    data-slot="rvn-chat-composer-reference-cluster-inspector"
                    style={{
                      fontFamily: 'var(--rvn-font-mono)',
                      fontSize: 'var(--tmnl-text-xs, 12px)',
                      color: 'var(--rvn-text-muted)',
                      marginBottom: '6px',
                    }}
                  >
                    cluster tasks: {inspectedCluster.reference.taskIds.join(', ')}
                  </div>
                ) : null}
              </>
            ) : null}

            {composerDropError ? (
              <div className="rvn-chat__composer-drop-error" role="status" aria-live="polite">
                drop rejected: {composerDropError}
              </div>
            ) : null}

            <RvnChatComposer.Input.Field
              ref={composerRef}
              value={resolvedDraft}
              onValueChange={setResolvedDraft}
              onKeyDown={onComposerKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              aria-label="Isolated chat composer"
            />
            <RvnChatComposer.Input.Counter current={resolvedDraft.length} max={maxChars} />
          </RvnChatComposer.Input.Root>

          <RvnChatComposer.Toolbar.Root>
            <RvnChatComposer.Toolbar.ModeGroup>
              <RvnChatComposer.Toolbar.ToolBtn
                className="havoc-btn"
                active={mode === 'terminal'}
                onClick={() => setMode('terminal')}
              >
                Terminal
              </RvnChatComposer.Toolbar.ToolBtn>
              <RvnChatComposer.Toolbar.ToolBtn
                className="havoc-btn"
                active={mode === 'ai'}
                onClick={() => setMode('ai')}
              >
                AI
              </RvnChatComposer.Toolbar.ToolBtn>
              <RvnChatComposer.Toolbar.ToolBtn className="havoc-btn rvn-chat__tool-btn--thinking">
                <Diamond
                  size={RVN_CHAT_UTILITY_ICON_SIZE}
                  strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
                  aria-hidden="true"
                />
                {thinkingLevel}
              </RvnChatComposer.Toolbar.ToolBtn>
            </RvnChatComposer.Toolbar.ModeGroup>

            <RvnChatComposer.Toolbar.InsertGroup>
              <RvnChatComposer.Toolbar.ToolBtn
                className="havoc-btn rvn-chat__tool-btn--insert"
                onClick={() => {
                  const nextDraft = resolvedDraft.startsWith('/') ? resolvedDraft : '/'
                  setResolvedDraft(nextDraft)
                  composerRef.current?.focus()
                }}
              >
                /cmd
              </RvnChatComposer.Toolbar.ToolBtn>
              <RvnChatComposer.Toolbar.ToolBtn
                className="havoc-btn rvn-chat__tool-btn--insert"
                onClick={() => {
                  setResolvedDraft(`${resolvedDraft}@`)
                  composerRef.current?.focus()
                }}
              >
                @entity
              </RvnChatComposer.Toolbar.ToolBtn>
              <RvnChatComposer.Toolbar.ToolBtn className="havoc-btn rvn-chat__tool-btn--voice" aria-label="Voice input">
                <Mic
                  size={RVN_CHAT_UTILITY_ICON_SIZE}
                  strokeWidth={RVN_CHAT_ICON_STROKE_WIDTH}
                  aria-hidden="true"
                />
              </RvnChatComposer.Toolbar.ToolBtn>
            </RvnChatComposer.Toolbar.InsertGroup>

            <RvnChatComposer.Toolbar.TransportGroup>
              <RvnChatComposer.Transport.Root>
                {connectionState !== 'online' ? (
                  <RvnChatReconnectBtn
                    className="havoc-btn"
                    onClick={() => {
                      if (onReconnect) {
                        void onReconnect()
                      }
                    }}
                  >
                    Reconnect
                  </RvnChatReconnectBtn>
                ) : null}

                {streaming ? (
                  <RvnChatPauseBtn
                    className="havoc-btn"
                    disabled={disabled || !onPause}
                    onClick={() => {
                      if (onPause) {
                        void onPause()
                      }
                    }}
                  >
                    Pause
                  </RvnChatPauseBtn>
                ) : (
                  <RvnChatSendBtn
                    className="havoc-btn"
                    disabled={disabled || (resolvedDraft.trim().length === 0 && composerReferences.length === 0)}
                    onClick={() => void submit()}
                  >
                    Send
                  </RvnChatSendBtn>
                )}
              </RvnChatComposer.Transport.Root>
            </RvnChatComposer.Toolbar.TransportGroup>
          </RvnChatComposer.Toolbar.Root>
        </RvnChatComposer.Root>
      </RvnChatShell.ComposerBand>

      <TransferOverlay />
      <RvnChatFrameCorners />
    </RvnChatShell.Root>
  )
}
