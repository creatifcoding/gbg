/**
 * Conductor Canvas Testbed
 *
 * Spatial orchestration surface for multi-agent workflows.
 * Agents live as draggable nodes on an infinite canvas.
 *
 * Integration surface:
 * - anime.js 4.3.2 animate for status transitions & FX
 * - RVN design system (panels, badges, status dots, context menu)
 * - NodeChrome (groupAccent + brutalist depth chrome + shift-drag overlay)
 * - @dnd-kit (pointer drag positioning)
 * - Framer Motion (viewport transitions, inspector panel)
 * - @base-ui-components (RvnContextMenu compound)
 * - effect-atom (Atom-as-State, Registry singleton)
 *
 * Route: /testbed/conductor
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ StatusBar                                                       │
 * ├───────┬─────────────────────────────────────────┬──────────────┤
 * │       │          CANVAS (infinite pan/zoom)     │              │
 * │ Tool  │          ┌──────┐   ┌──────┐           │  Inspector   │
 * │ Rail  │          │Agent │───│Agent │           │  Panel       │
 * │       │          └──────┘   └──────┘           │              │
 * ├───────┴─────────────────────────────────────────┴──────────────┤
 * │ TerminalPanel (expandable — operation log)                      │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * @module
 */

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useId,
  useLayoutEffect,
  type ReactNode,
} from 'react'
import { Link } from '@tanstack/react-router'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  FloatingPortal,
  useDismiss,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import { Atom } from '@effect-atom/atom'
import * as AtomResult from '@effect-atom/atom/Result'
import { Registry, RegistryContext } from '@effect-atom/atom-react'
import { useAtomSet, useAtomValue } from '@effect-atom/atom-react'
import { Effect, HashMap, HashSet, Option, Schema, Subscribable } from 'effect'
import * as React from 'react'

// anime.js 4.3.2
import {
  createLayout,
  createScope,
  createTimeline,
  animate as animeAnimate,
  stagger,
} from 'animejs'

// dnd-kit
import {
  DndContext,
  useDraggable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'

// RVN
import { RvnBadge } from '@/lib/rvn/display/RvnBadge'
import { RvnStatusDot } from '@/lib/rvn/display/RvnStatusDot'
import { useRvnAnimate } from '@/lib/rvn/hooks/useRvnAnimate'

// Conductor schemas
import type { AgentRole, AgentStatus } from '@/lib/conductor/schemas'

// MorphCard (headless + skins)
import {
  MorphCard,
  MorphCardRegistryProvider,
  defaultTransitionStrategy,
  sendIslandEvent,
  rvnMorphCardSlots,
  rvnMorphCardTheme,
} from '@/lib/morph-card'

// Icons
import {
  Play,
  Trash2,
  Terminal,
  Eye,
  EyeOff,
  Maximize2,
  Square,
  ChevronDown,
  ChevronUp,
  Search,
  Code,
  Shield,
  Bot,
  Activity,
  Network,
  MessageSquare,
} from 'lucide-react'
import { NodeChrome } from '@/components/testbed/conductor/NodeChrome'
import { MicrointeractionHitbox } from '@/components/testbed/conductor/MicrointeractionHitbox'
import type {
  ChatExpansionLevel,
  ConductorInspectorSurface,
} from '@/components/testbed/conductor/chat-surface-types'
import {
  DEFAULT_RVN_HARNESS_QUICK_ACTIONS,
  DEFAULT_RVN_HARNESS_SLASH_COMMANDS,
  extractMentions,
  mapRvnModeToExpansionLevel,
  toRvnHarnessChatViewModel,
  type RvnHarnessChatMode,
  type RvnHarnessChatSurfaceProps,
  type RvnHarnessThinkingLevel,
} from '@/components/testbed/conductor/rvn-harness-chat-view-model'
import {
  inlineTaskExpandedTasksByScopeAtom,
  toInlineTaskUiStateKey,
} from '@/lib/conductor/atoms'
import { RvnChat } from '@/lib/rvn/chat'
import {
  NodeChatAtomAccessors,
  type NodeAgentProvisionOutcome,
  type NodeChatAbortOutcome,
  type NodeChatReconnectOutcome,
  type NodeChatSendOutcome,
} from '@/components/testbed/conductor/agent-chat-stx'
import { ScrambleQuote, type ScrambleQuoteHandle } from '@/components/ui/scramble-quote'

// =============================================================================
// Canvas State (Atom-as-State — registry.set() mutates, React subscribes)
// =============================================================================

interface CanvasNodePosition { x: number; y: number }

interface AgentNode {
  id: string
  spec: {
    id: string
    name: string
    role: AgentRole
    model: string
    awareness: string
  }
  status: AgentStatus
  position: CanvasNodePosition
  output: string[]
  spawnedAt: string
  sessionId: string | null
}

interface CanvasViewport { panX: number; panY: number; zoom: number }

interface WorkflowDef {
  id: string
  name: string
  steps: { id: string; agentRole: AgentRole; prompt: string }[]
}

const LogViewerChannel = Schema.Literal('operations', 'tagrack', 'all')
type LogViewerChannel = typeof LogViewerChannel.Type

const LogOperationEvent = Schema.TaggedStruct('LogOperation', {
  channel: Schema.Literal('operations'),
  at: Schema.String,
  message: Schema.String,
})

const LogTagRackTransitionEvent = Schema.TaggedStruct('LogTagRackTransition', {
  channel: Schema.Literal('tagrack'),
  at: Schema.String,
  nodeId: Schema.String,
  label: Schema.String,
  details: Schema.NullOr(Schema.String),
})

const LogSystemEvent = Schema.TaggedStruct('LogSystem', {
  channel: Schema.Literal('operations', 'tagrack'),
  at: Schema.String,
  message: Schema.String,
})

const ConductorLogEvent = Schema.Union(LogOperationEvent, LogTagRackTransitionEvent, LogSystemEvent)
type ConductorLogEvent = typeof ConductorLogEvent.Type

// Registry singleton — all mutations go through this
const reg = Registry.make()

// Primary atoms
const nodesAtom = Atom.make(HashMap.empty<string, AgentNode>())
const viewportAtom = Atom.make<CanvasViewport>({ panX: 0, panY: 0, zoom: 1 })
const activeNodeIdAtom = Atom.make<string | null>(null)
const inspectorNodeIdAtom = Atom.make<string | null>(null)
const selectedNodeIdsAtom = Atom.make(HashSet.empty<string>())
const nodeRefsAtom = Atom.make(HashMap.empty<string, HTMLDivElement>())
const selectedNodeRefsAtom = Atom.make((get) => {
  const ids = get(selectedNodeIdsAtom)
  const refs = get(nodeRefsAtom)
  let selected = HashMap.empty<string, HTMLDivElement>()
  for (const id of HashSet.values(ids)) {
    const maybeRef = HashMap.get(refs, id)
    if (Option.isSome(maybeRef)) {
      selected = HashMap.set(selected, id, maybeRef.value)
    }
  }
  return selected
})
const selectedCountAtom = Atom.make((get) => HashSet.size(get(selectedNodeIdsAtom)))
const microHitboxDebugAtom = Atom.make(false)
const terminalExpandedAtom = Atom.make(false)
const logViewerChannelAtom = Atom.make<LogViewerChannel>('operations')
const logRetentionLimitAtom = Atom.make(1000)
const logEventsAtom = Atom.make<ReadonlyArray<ConductorLogEvent>>([])
const logEventsSubscribableAtom = Atom.subscribable((get) =>
  Subscribable.make({
    get: Effect.succeed(get(logEventsAtom)),
    changes: get.stream(logEventsAtom, { withoutInitialValue: true }),
  }))
const LOG_RETENTION_PRESETS = [250, 500, 1000, 2000] as const

const OrchestratorConnectivityStatus = Schema.Literal('checking', 'online', 'offline')
type OrchestratorConnectivityStatus = typeof OrchestratorConnectivityStatus.Type

interface OrchestratorConnectivityState {
  readonly status: OrchestratorConnectivityStatus
  readonly lastOkAt: string | null
  readonly lastError: string | null
  readonly latencyMs: number | null
}

const orchestratorConnectivityAtom = Atom.make<OrchestratorConnectivityState>({
  status: 'checking',
  lastOkAt: null,
  lastError: null,
  latencyMs: null,
})

const wfStatusAtom = Atom.make<'idle' | 'running' | 'complete' | 'failed'>('idle')
const wfProgressAtom = Atom.make<{ current: number; total: number }>({ current: 0, total: 0 })

// Derived (read-only)
const nodeListAtom = Atom.make((get) => Array.from(HashMap.values(get(nodesAtom))))
const activeNodeAtom = Atom.make((get) => {
  const id = get(activeNodeIdAtom)
  if (!id) return null
  const maybeNode = HashMap.get(get(nodesAtom), id)
  return Option.isSome(maybeNode) ? maybeNode.value : null
})
const inspectorNodeAtom = Atom.make((get) => {
  const id = get(inspectorNodeIdAtom)
  if (!id) return null
  const maybeNode = HashMap.get(get(nodesAtom), id)
  return Option.isSome(maybeNode) ? maybeNode.value : null
})
const activeCountAtom = Atom.make((get) =>
  get(nodeListAtom).filter((n) => n.status !== 'terminated' && n.status !== 'failed').length,
)

// =============================================================================
// Imperative helpers (mutate atoms via registry)
// =============================================================================

const appendLogEvent = (event: ConductorLogEvent) => {
  const retention = Math.max(1, reg.get(logRetentionLimitAtom))
  const next = [...reg.get(logEventsAtom), event]
  reg.set(logEventsAtom, next.slice(-retention))
}

const setLogRetentionLimit = (nextLimit: number) => {
  const normalized = Math.max(1, Math.floor(nextLimit))
  reg.set(logRetentionLimitAtom, normalized)
  reg.set(logEventsAtom, reg.get(logEventsAtom).slice(-normalized))
}

const log = (msg: string) => {
  appendLogEvent(LogOperationEvent.make({
    at: new Date().toISOString(),
    channel: 'operations',
    message: msg,
  }))
}

const logSystem = (msg: string, channel: 'operations' | 'tagrack' = 'operations') => {
  appendLogEvent(LogSystemEvent.make({
    at: new Date().toISOString(),
    channel,
    message: msg,
  }))
}

const logTagRackTransition = (nodeId: string, label: string, payload?: Record<string, unknown>) => {
  appendLogEvent(LogTagRackTransitionEvent.make({
    at: new Date().toISOString(),
    channel: 'tagrack',
    nodeId,
    label,
    details: payload ? JSON.stringify(payload) : null,
  }))
}

const resolveOrchestratorHealthUrls = (): ReadonlyArray<string> => {
  const direct = 'http://127.0.0.1:8787/health'

  if (typeof window === 'undefined') {
    return [direct]
  }

  const location = window.location

  if (location.host.length > 0 && location.protocol !== 'tauri:' && location.protocol !== 'file:') {
    return [
      direct,
      '/api/harness/health',
    ]
  }

  return [direct]
}

const isOrchestratorOnline = (): boolean => reg.get(orchestratorConnectivityAtom).status === 'online'

function failNodePromptAsOffline(nodeId: string, reason?: string) {
  const nodes = reg.get(nodesAtom)
  const maybeNode = HashMap.get(nodes, nodeId)
  if (Option.isNone(maybeNode)) return

  const message = reason ?? 'harness runtime offline'

  setNodeField(nodeId, 'status', 'failed')
  reg.set(NodeChatAtomAccessors.pending(nodeId), false)
  reg.set(NodeChatAtomAccessors.error(nodeId), message)
  appendNodeOutput(
    nodeId,
    `[${new Date().toLocaleTimeString()}] • trace:error ${message}`,
  )
}

function failWorkingNodesAsOffline(reason?: string) {
  const nodes = reg.get(nodeListAtom)
  for (const node of nodes) {
    if (node.status === 'working' || node.status === 'waiting') {
      failNodePromptAsOffline(node.id, reason)
    }
  }
}

const setOrchestratorConnectivity = (next: OrchestratorConnectivityState) => {
  const prev = reg.get(orchestratorConnectivityAtom)
  reg.set(orchestratorConnectivityAtom, next)

  if (prev.status !== next.status) {
    if (next.status === 'online') {
      logSystem(`harness runtime online (${next.latencyMs ?? 0}ms)`)
    }

    if (next.status === 'offline') {
      const reason = next.lastError ?? 'health check failed'
      logSystem(`harness runtime offline (${reason})`)
      failWorkingNodesAsOffline(`harness runtime offline (${reason})`)
    }
  }
}

const probeOrchestratorConnectivity = async (): Promise<void> => {
  const urls = resolveOrchestratorHealthUrls()

  let lastError = 'health check failed'

  for (const url of urls) {
    const startedAt = performance.now()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 2500)

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`health status ${response.status} (${url})`)
      }

      const latencyMs = Math.max(0, Math.round(performance.now() - startedAt))
      setOrchestratorConnectivity({
        status: 'online',
        lastOkAt: new Date().toISOString(),
        lastError: null,
        latencyMs,
      })
      window.clearTimeout(timeout)
      return
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    } finally {
      window.clearTimeout(timeout)
    }
  }

  setOrchestratorConnectivity({
    status: 'offline',
    lastOkAt: reg.get(orchestratorConnectivityAtom).lastOkAt,
    lastError,
    latencyMs: null,
  })
}

const formatLogLine = (event: ConductorLogEvent): string => {
  const ts = new Date(event.at).toLocaleTimeString()
  switch (event._tag) {
    case 'LogOperation':
      return `${ts} ${event.message}`
    case 'LogTagRackTransition':
      return `${ts} [${event.nodeId}] ${event.label}${event.details ? ` ${event.details}` : ''}`
    case 'LogSystem':
      return `${ts} [SYSTEM] ${event.message}`
  }
}

const clearLogEvents = (channel: LogViewerChannel) => {
  if (channel === 'all') {
    reg.set(logEventsAtom, [])
    return
  }
  reg.set(logEventsAtom, reg.get(logEventsAtom).filter((event) => event.channel !== channel))
}

const clearSelection = () => {
  reg.set(selectedNodeIdsAtom, HashSet.empty<string>())
}

const selectOnly = (id: string) => {
  reg.set(selectedNodeIdsAtom, HashSet.make(id))
}

const toggleSelection = (id: string) => {
  const next = HashSet.toggle(reg.get(selectedNodeIdsAtom), id)
  reg.set(selectedNodeIdsAtom, next)
}

const registerNodeRef = (id: string, el: HTMLDivElement | null) => {
  const refs = reg.get(nodeRefsAtom)
  reg.set(nodeRefsAtom, el ? HashMap.set(refs, id, el) : HashMap.remove(refs, id))
}

let nodeSeq = 0

const ROLE_CFG: Record<AgentRole, { icon: typeof Search; color: string }> = {
  scout:       { icon: Search,   color: '#f59e0b' },
  analyzer:    { icon: Activity, color: '#3b82f6' },
  planner:     { icon: Network,  color: '#8b5cf6' },
  implementer: { icon: Code,     color: '#10b981' },
  reviewer:    { icon: Shield,   color: '#f43f5e' },
  conductor:   { icon: Bot,      color: '#06b6d4' },
}

const STATUS_TO_RVN: Record<AgentStatus, 'active' | 'alert' | 'offline' | 'nominal'> = {
  spawning: 'alert', idle: 'nominal', working: 'active', waiting: 'alert',
  complete: 'nominal', failed: 'offline', terminated: 'offline',
}

const ROLE_NAMES: Record<AgentRole, string> = {
  scout: 'Recon', analyzer: 'Analyst', planner: 'Architect',
  implementer: 'Builder', reviewer: 'Auditor', conductor: 'Maestro',
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForSendPromptResult(nodeId: string, requestId: string, timeoutMs = 60000) {
  const opAtom = NodeChatAtomAccessors.sendPrompt(nodeId)
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (!isOrchestratorOnline()) {
      return {
        requestId,
        ok: false,
        agentId: null,
        assistantText: '',
        error: 'harness runtime offline',
      } satisfies NodeChatSendOutcome
    }

    const result = reg.get(opAtom)

    if (AtomResult.isSuccess(result)) {
      const outcome = result.value as NodeChatSendOutcome
      if (outcome.requestId === requestId) {
        return outcome
      }
    }

    if (AtomResult.isFailure(result)) {
      return {
        requestId,
        ok: false,
        agentId: null,
        assistantText: '',
        error: String(result.cause),
      } satisfies NodeChatSendOutcome
    }

    await sleep(40)
  }

  // Stream-first fallback: avoid false timeout failure while deltas continue.
  return {
    requestId,
    ok: true,
    agentId: null,
    assistantText: '',
    error: null,
  } satisfies NodeChatSendOutcome
}

const inFlightNodeProvision = new Set<string>()

async function waitForNodeProvisionResult(nodeId: string, requestId: string, timeoutMs = 20000) {
  const opAtom = NodeChatAtomAccessors.ensureNodeAgent(nodeId)
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    if (!isOrchestratorOnline()) {
      return {
        requestId,
        ok: false,
        agentId: null,
        error: 'harness runtime offline',
      } satisfies NodeAgentProvisionOutcome
    }

    const result = reg.get(opAtom)

    if (AtomResult.isSuccess(result)) {
      const outcome = result.value as NodeAgentProvisionOutcome
      if (outcome.requestId === requestId) {
        return outcome
      }
    }

    if (AtomResult.isFailure(result)) {
      return {
        requestId,
        ok: false,
        agentId: null,
        error: String(result.cause),
      } satisfies NodeAgentProvisionOutcome
    }

    await sleep(30)
  }

  return {
    requestId,
    ok: false,
    agentId: null,
    error: 'timed out waiting for node agent provision',
  } satisfies NodeAgentProvisionOutcome
}

async function provisionNodeAgentOnActivate(nodeId: string) {
  if (!isOrchestratorOnline()) return
  if (inFlightNodeProvision.has(nodeId)) return

  const maybeNode = HashMap.get(reg.get(nodesAtom), nodeId)
  if (Option.isNone(maybeNode)) return

  const node = maybeNode.value
  if (node.sessionId) return

  const requestId = `provision-${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const opAtom = NodeChatAtomAccessors.ensureNodeAgent(nodeId)

  inFlightNodeProvision.add(nodeId)

  if (node.status === 'idle') {
    setNodeField(nodeId, 'status', 'waiting')
  }

  try {
    reg.set(opAtom, {
      requestId,
      role: node.spec.role,
    })

    const outcome = await waitForNodeProvisionResult(nodeId, requestId)

    if (outcome.ok && outcome.agentId) {
      setNodeField(nodeId, 'sessionId', outcome.agentId)

      const current = HashMap.get(reg.get(nodesAtom), nodeId)
      if (Option.isSome(current) && current.value.status === 'waiting') {
        setNodeField(nodeId, 'status', 'idle')
      }

      logSystem(`agent prewarmed ${node.spec.name} (${outcome.agentId})`)
      return
    }

    const message = outcome.error ?? 'unknown node provision failure'
    setNodeField(nodeId, 'status', 'failed')
    reg.set(NodeChatAtomAccessors.error(nodeId), message)
    appendNodeOutput(
      nodeId,
      `[${new Date().toLocaleTimeString()}] • trace:error ${message}`,
    )
    logSystem(`agent prewarm failed ${node.spec.name}: ${message}`)
  } finally {
    inFlightNodeProvision.delete(nodeId)
  }
}

function spawnNode(role: AgentRole, position?: CanvasNodePosition): AgentNode {
  const id = `agent-${++nodeSeq}-${Date.now().toString(36)}`
  const vp = reg.get(viewportAtom)
  const worldX = -vp.panX / vp.zoom
  const worldY = -vp.panY / vp.zoom

  const node: AgentNode = {
    id,
    spec: { id, name: `${ROLE_NAMES[role]}-${nodeSeq}`, role, model: 'gpt-5.3-codex', awareness: 'briefed' },
    status: 'spawning',
    position: position ?? { x: worldX + 180 + Math.random() * 280, y: worldY + 120 + Math.random() * 220 },
    output: [],
    spawnedAt: new Date().toISOString(),
    sessionId: null,
  }
  reg.set(nodesAtom, HashMap.set(reg.get(nodesAtom), id, node))
  log(`⚡ SPAWN ${node.spec.name} [${role}]`)

  setTimeout(() => { setNodeField(id, 'status', 'idle'); log(`✓ ${node.spec.name} ready`) }, 300)
  return node
}

function setNodeField<K extends keyof AgentNode>(id: string, key: K, value: AgentNode[K]) {
  const nodes = reg.get(nodesAtom)
  const maybeNode = HashMap.get(nodes, id)
  if (Option.isNone(maybeNode)) return
  reg.set(nodesAtom, HashMap.set(nodes, id, { ...maybeNode.value, [key]: value }))
}

function appendNodeOutput(id: string, line: string) {
  const nodes = reg.get(nodesAtom)
  const maybeNode = HashMap.get(nodes, id)
  if (Option.isNone(maybeNode)) return

  const nextNode: AgentNode = {
    ...maybeNode.value,
    output: [...maybeNode.value.output, line],
  }

  reg.set(nodesAtom, HashMap.set(nodes, id, nextNode))
}

function removeNode(id: string) {
  const nodes = reg.get(nodesAtom)
  const maybeNode = HashMap.get(nodes, id)
  if (Option.isSome(maybeNode)) log(`✕ TERMINATED ${maybeNode.value.spec.name}`)
  reg.set(nodesAtom, HashMap.remove(nodes, id))

  reg.set(selectedNodeIdsAtom, HashSet.remove(reg.get(selectedNodeIdsAtom), id))
  reg.set(nodeRefsAtom, HashMap.remove(reg.get(nodeRefsAtom), id))

  if (reg.get(activeNodeIdAtom) === id) reg.set(activeNodeIdAtom, null)
  if (reg.get(inspectorNodeIdAtom) === id) reg.set(inspectorNodeIdAtom, null)
}

async function sendPrompt(id: string, prompt: string) {
  const nodes = reg.get(nodesAtom)
  const maybeNode = HashMap.get(nodes, id)
  if (Option.isNone(maybeNode)) {
    logSystem(`sendPrompt dropped: unknown node '${id}'`)
    return
  }
  const node = maybeNode.value

  if (!isOrchestratorOnline()) {
    failNodePromptAsOffline(id, 'harness runtime offline (prompt blocked)')
    logSystem(`prompt blocked ${node.spec.name}: harness runtime offline`)
    return
  }

  setNodeField(id, 'status', 'working')
  appendNodeOutput(id, `[${new Date().toLocaleTimeString()}] • trace: prompt dispatched`)
  log(`▸ PROMPT → ${node.spec.name}: "${prompt.slice(0, 60)}…"`)

  const requestId = `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const opAtom = NodeChatAtomAccessors.sendPrompt(id)
  reg.set(opAtom, {
    requestId,
    role: node.spec.role,
    prompt,
  })

  const outcome = await waitForSendPromptResult(id, requestId)

  if (outcome.ok) {
    if (outcome.agentId) {
      setNodeField(id, 'sessionId', outcome.agentId)
    }

    if (outcome.assistantText.length > 0) {
      appendNodeOutput(
        id,
        `[${new Date().toLocaleTimeString()}] • trace: ${outcome.assistantText}`,
      )
      setNodeField(id, 'status', 'complete')
      log(`✓ ${node.spec.name} complete (pi)`)
    } else {
      setNodeField(id, 'status', 'working')
      appendNodeOutput(
        id,
        `[${new Date().toLocaleTimeString()}] • trace: stream accepted`,
      )
    }

    return
  }

  const message = outcome.error ?? 'unknown error'
  setNodeField(id, 'status', 'failed')
  reg.set(NodeChatAtomAccessors.pending(id), false)
  reg.set(NodeChatAtomAccessors.error(id), message)
  appendNodeOutput(
    id,
    `[${new Date().toLocaleTimeString()}] • trace:error ${message}`,
  )
  log(`✕ ${node.spec.name} failed (pi): ${message}`)
}


// =============================================================================
// Workflows
// =============================================================================

const WORKFLOWS: WorkflowDef[] = [
  { id: 'review', name: 'Code Review', steps: [
    { id: 's1', agentRole: 'scout', prompt: 'Scan src/lib/ for recent changes' },
    { id: 's2', agentRole: 'analyzer', prompt: 'Analyze diff for issues' },
    { id: 's3', agentRole: 'reviewer', prompt: 'Generate review report' },
  ] },
  { id: 'build', name: 'Feature Build', steps: [
    { id: 's1', agentRole: 'planner', prompt: 'Design architecture' },
    { id: 's2', agentRole: 'implementer', prompt: 'Implement design' },
    { id: 's3', agentRole: 'reviewer', prompt: 'Review quality' },
  ] },
  { id: 'recon', name: 'Recon Sweep', steps: [
    { id: 's1', agentRole: 'scout', prompt: 'Map API endpoints' },
    { id: 's2', agentRole: 'scout', prompt: 'Find unused deps' },
    { id: 's3', agentRole: 'analyzer', prompt: 'Synthesize findings' },
  ] },
]

async function runWorkflow(wf: WorkflowDef) {
  reg.set(wfStatusAtom, 'running')
  reg.set(wfProgressAtom, { current: 0, total: wf.steps.length })
  log(`▶ WORKFLOW: ${wf.name}`)

  for (let i = 0; i < wf.steps.length; i++) {
    const step = wf.steps[i]
    reg.set(wfProgressAtom, { current: i, total: wf.steps.length })
    const node = spawnNode(step.agentRole, { x: 100 + i * 220, y: 200 })
    await sleep(250)
    await sendPrompt(node.id, step.prompt)
    reg.set(wfProgressAtom, { current: i + 1, total: wf.steps.length })
  }

  reg.set(wfStatusAtom, 'complete')
  log(`✓ WORKFLOW DONE: ${wf.name}`)
}

type TagDescriptorId = 'role' | 'status' | 'awareness' | 'model'

type TagDescriptor = {
  id: TagDescriptorId
  label: string
  theory: string
}

const ROLE_THEORY: Record<AgentRole, string> = {
  scout: 'Recon sweep role focused on broad discovery and uncertainty reduction.',
  analyzer: 'Analytical role focused on pattern extraction, anomaly triage, and synthesis.',
  planner: 'Architectural role focused on sequencing, constraints, and dependency choreography.',
  implementer: 'Execution role focused on deterministic artifact production and patch delivery.',
  reviewer: 'Assurance role focused on risk surfacing, contract validation, and quality gates.',
  conductor: 'Coordination role focused on orchestration topology, delegation, and state coherence.',
}

const STATUS_THEORY: Record<AgentStatus, string> = {
  spawning: 'Bootstrap phase: runtime context and mission brief are being initialized.',
  idle: 'Ready phase: resources allocated and awaiting explicit tasking.',
  working: 'Execution phase: active reasoning and artifact production in progress.',
  waiting: 'Blocked phase: paused pending dependency, signal, or external response.',
  complete: 'Settled phase: objective satisfied and output emitted.',
  failed: 'Fault phase: execution aborted due to contract or runtime violation.',
  terminated: 'Stopped phase: lifecycle closed and node retired.',
}

function deriveTagDescriptors(node: AgentNode): ReadonlyArray<TagDescriptor> {
  return [
    {
      id: 'role',
      label: node.spec.role,
      theory: ROLE_THEORY[node.spec.role],
    },
    {
      id: 'status',
      label: node.status,
      theory: STATUS_THEORY[node.status],
    },
    {
      id: 'awareness',
      label: node.spec.awareness,
      theory: `Awareness profile \"${node.spec.awareness}\" determines how much contextual memory and mission state is loaded before execution.`,
    },
    {
      id: 'model',
      label: node.spec.model,
      theory: `Model binding \"${node.spec.model}\" defines latency, reasoning depth, and output style envelope for this node.`,
    },
  ]
}

function tagDescriptorAccent(id: TagDescriptorId): string {
  switch (id) {
    case 'status':
      return '#22d3ee'
    case 'role':
      return '#f97316'
    case 'awareness':
      return '#a78bfa'
    case 'model':
      return '#facc15'
  }
}

const GOLDEN_RATIO = 1.61803398875
const INV_GOLDEN_RATIO = 1 / GOLDEN_RATIO

/**
 * TagRack descriptor choreography storyboard (temporal budget)
 *
 * HOVER IN:   [hover intent 540ms] -> [handoff 96ms] -> [enter 190ms] -> [settle 64ms]
 * SWITCH TAG: [record] -> [switch 150ms] -> [settle 64ms]
 * HOVER OUT:  [handoff 96ms] -> [exit 118ms]
 */
const TAGRACK_TEMPORAL_BUDGET_MS = {
  hoverIntent: 540,
  handoff: 96,
  enter: 190,
  switch: 150,
  exit: 118,
  settle: 64,
} as const

const TAGRACK_DISCLOSURE_CADENCE_MS = {
  tagStart: 0,
  roleStart: 320,
  descriptionStart: 640,
  segmentDuration: 320,
} as const

let tagRackMeasureContext: CanvasRenderingContext2D | null = null

function measureTagRackTextWidth(text: string, sizePx: number, weight: number = 500): number {
  if (typeof document === 'undefined') {
    return Math.max(1, text.length) * sizePx * 0.62
  }

  if (!tagRackMeasureContext) {
    tagRackMeasureContext = document.createElement('canvas').getContext('2d')
  }

  if (!tagRackMeasureContext) {
    return Math.max(1, text.length) * sizePx * 0.62
  }

  tagRackMeasureContext.font = `${weight} ${sizePx}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`
  return tagRackMeasureContext.measureText(text).width
}

type TagDescriptorPanelGeometry = {
  panelWidthPx: number
  descriptorWidthPx: number
  descriptorMinHeightPx: number
}

function estimateWrappedLineCount(text: string, maxWidthPx: number, sizePx: number, weight: number = 500): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 1

  const spaceWidth = measureTagRackTextWidth(' ', sizePx, weight)
  let lines = 1
  let currentLineWidth = 0

  for (const word of words) {
    const wordWidth = measureTagRackTextWidth(word, sizePx, weight)

    if (currentLineWidth === 0) {
      currentLineWidth = wordWidth
      continue
    }

    if (currentLineWidth + spaceWidth + wordWidth <= maxWidthPx) {
      currentLineWidth += spaceWidth + wordWidth
    } else {
      lines += 1
      currentLineWidth = wordWidth
    }
  }

  return lines
}

function computeDescriptorPanelGeometry(descriptor: TagDescriptor, node: AgentNode): TagDescriptorPanelGeometry {
  const badgeText = `${descriptor.id} ${descriptor.label}`.toUpperCase()
  const badgePx = measureTagRackTextWidth(badgeText, 12) + 28

  const nodeNamePx = measureTagRackTextWidth(node.spec.name, 14, 700) + 48

  const theoryPx = measureTagRackTextWidth(descriptor.theory, 12, 500)
  const targetLines = Math.max(3, Math.min(8, Math.round(Math.sqrt(descriptor.theory.length) / 2.15)))
  const estimatedDescriptorWidthPx = Math.round(theoryPx / targetLines + 30)

  const descriptorWidthPx = Math.round(
    Math.max(
      132,
      Math.min(188, Math.max(estimatedDescriptorWidthPx, badgePx * INV_GOLDEN_RATIO, nodeNamePx * 0.52)),
    ),
  )

  const panelWidthPx = Math.round(
    Math.max(
      184,
      Math.min(248, Math.max(descriptorWidthPx * GOLDEN_RATIO, badgePx + 40, nodeNamePx * INV_GOLDEN_RATIO + 24)),
    ),
  )

  const contentWidthPx = Math.max(96, descriptorWidthPx - 16)
  const wrappedLines = estimateWrappedLineCount(descriptor.theory, contentWidthPx, 14, 500)
  const descriptorMinHeightPx = Math.round(Math.max(72, wrappedLines * 20 + 8))

  return {
    panelWidthPx,
    descriptorWidthPx,
    descriptorMinHeightPx,
  }
}

const tagRackOpenTagIdAtomFamily = Atom.family((nodeId: string) => Atom.make<TagDescriptorId | null>(null))
const tagRackReferenceElAtomFamily = Atom.family((nodeId: string) => Atom.make<HTMLElement | null>(null))
const tagRackPanelLayoutReadyAtomFamily = Atom.family((nodeId: string) => Atom.make(false))
const tagRackPanelBodyVisibleAtomFamily = Atom.family((nodeId: string) => Atom.make(false))
const tagRackIsClosingAtomFamily = Atom.family((nodeId: string) => Atom.make(false))
const tagRackIsPanelHoveredAtomFamily = Atom.family((nodeId: string) => Atom.make(false))

type TagRackScopeMethods = {
  runLayoutTransition: (args: {
    duration: number
    ease: string
    delay?: number
    onBegin?: () => void
    onComplete?: () => void
  }) => void
  runDisclosureCadence: () => void
  stopDisclosureCadence: () => void
  traceTransition: (label: string, payload?: Record<string, unknown>) => void
}

/**
 * TAGRACK (Lexicon #4): informational tag rail.
 * Reference: ./conductor/NODE_STATE_LEXICON.md
 */
function TagRack({
  node,
  mode,
  onActivate,
}: {
  node: AgentNode
  mode: 'compact' | 'expanded'
  onActivate: () => void
}) {
  const descriptors = useMemo(() => deriveTagDescriptors(node), [node])
  const visibleDescriptors = mode === 'compact'
    ? descriptors.filter((d) => d.id === 'role' || d.id === 'status')
    : descriptors
  const hitboxDebug = useAtomValue(microHitboxDebugAtom)

  const openTagId = useAtomValue(tagRackOpenTagIdAtomFamily(node.id))
  const setOpenTagId = useAtomSet(tagRackOpenTagIdAtomFamily(node.id))

  const referenceEl = useAtomValue(tagRackReferenceElAtomFamily(node.id))
  const setReferenceEl = useAtomSet(tagRackReferenceElAtomFamily(node.id))

  const panelLayoutReady = useAtomValue(tagRackPanelLayoutReadyAtomFamily(node.id))
  const setPanelLayoutReady = useAtomSet(tagRackPanelLayoutReadyAtomFamily(node.id))

  const panelBodyVisible = useAtomValue(tagRackPanelBodyVisibleAtomFamily(node.id))
  const setPanelBodyVisible = useAtomSet(tagRackPanelBodyVisibleAtomFamily(node.id))

  const isClosing = useAtomValue(tagRackIsClosingAtomFamily(node.id))
  const setIsClosing = useAtomSet(tagRackIsClosingAtomFamily(node.id))

  const isPanelHovered = useAtomValue(tagRackIsPanelHoveredAtomFamily(node.id))
  const setIsPanelHovered = useAtomSet(tagRackIsPanelHoveredAtomFamily(node.id))

  const quoteRef = useRef<ScrambleQuoteHandle>(null)
  const panelTagTokenRef = useRef<HTMLSpanElement | null>(null)
  const panelRoleTypeRef = useRef<HTMLSpanElement | null>(null)
  const panelDescriptionRef = useRef<HTMLDivElement | null>(null)
  const scopeHostRef = useRef<HTMLDivElement | null>(null)
  const tagRackScopeRef = useRef<{ methods?: Partial<TagRackScopeMethods>; revert?: () => void } | null>(null)
  const panelRootRef = useRef<HTMLDivElement | null>(null)
  const panelLayoutRef = useRef<ReturnType<typeof createLayout> | null>(null)
  const pendingTransitionRef = useRef<'open' | 'switch' | 'close' | null>(null)
  const transitionRunIdRef = useRef(0)
  const closeIntentTimerRef = useRef<number | null>(null)
  const hoverAnchorByTagIdRef = useRef(new Map<TagDescriptorId, HTMLElement>())
  const lastAnimatedTagIdRef = useRef<TagDescriptorId | null>(null)

  useEffect(() => {
    const scopeRoot = scopeHostRef.current
    if (!scopeRoot) return

    tagRackScopeRef.current = createScope({ root: scopeRoot }).add((self: any) => {
      let disclosureTimeline: { cancel?: () => void } | null = null

      self.add('runLayoutTransition', (args: Parameters<TagRackScopeMethods['runLayoutTransition']>[0]) => {
        const layout = panelLayoutRef.current
        if (!layout) return
        layout.animate(args)
      })

      self.add('stopDisclosureCadence', () => {
        disclosureTimeline?.cancel?.()
        disclosureTimeline = null
      })

      self.add('runDisclosureCadence', () => {
        disclosureTimeline?.cancel?.()

        const tagEl = panelTagTokenRef.current
        const roleEl = panelRoleTypeRef.current
        const descriptionEl = panelDescriptionRef.current
        if (!tagEl || !roleEl || !descriptionEl) return

        const prepare = (el: HTMLElement) => {
          el.style.opacity = '0'
          el.style.transform = 'translateY(8px)'
          el.style.filter = 'blur(2px)'
        }

        prepare(tagEl)
        prepare(roleEl)
        prepare(descriptionEl)

        logTagRackTransition(node.id, 'disclosure:start')

        const segment = (marker: string, replayQuote: boolean = false) => ({
          opacity: [0, 1],
          y: [8, 0],
          filter: ['blur(2px)', 'blur(0px)'],
          duration: TAGRACK_DISCLOSURE_CADENCE_MS.segmentDuration,
          onBegin: () => {
            logTagRackTransition(node.id, marker)
            if (replayQuote) {
              quoteRef.current?.replay()
            }
          },
        })

        disclosureTimeline = createTimeline({
          defaults: {
            ease: 'out(3)',
          },
        })
          .add(tagEl, segment('disclosure:tag'), TAGRACK_DISCLOSURE_CADENCE_MS.tagStart)
          .add(roleEl, segment('disclosure:role'), TAGRACK_DISCLOSURE_CADENCE_MS.roleStart)
          .add(descriptionEl, {
            ...segment('disclosure:description', true),
            onComplete: () => {
              logTagRackTransition(node.id, 'disclosure:complete')
            },
          }, TAGRACK_DISCLOSURE_CADENCE_MS.descriptionStart)
      })

      self.add('traceTransition', (label: string, payload?: Record<string, unknown>) => {
        logTagRackTransition(node.id, label, payload)
      })
    })

    return () => {
      tagRackScopeRef.current?.methods?.stopDisclosureCadence?.()
      tagRackScopeRef.current?.revert?.()
      tagRackScopeRef.current = null
    }
  }, [node.id])

  const openTag = useMemo(
    () => visibleDescriptors.find((d) => d.id === openTagId) ?? null,
    [openTagId, visibleDescriptors]
  )

  const geometryByTagId = useMemo(() => {
    const mapping = new Map<TagDescriptorId, TagDescriptorPanelGeometry>()
    for (const descriptor of visibleDescriptors) {
      mapping.set(descriptor.id, computeDescriptorPanelGeometry(descriptor, node))
    }
    return mapping
  }, [node, visibleDescriptors])

  const activeGeometry = openTag
    ? geometryByTagId.get(openTag.id) ?? { panelWidthPx: 204, descriptorWidthPx: 148, descriptorMinHeightPx: 72 }
    : { panelWidthPx: 204, descriptorWidthPx: 148, descriptorMinHeightPx: 72 }

  const panelWidthPx = activeGeometry.panelWidthPx
  const descriptorWidthPx = activeGeometry.descriptorWidthPx
  const descriptorMinHeightPx = activeGeometry.descriptorMinHeightPx
  const popoverOpen = (!!openTagId || isClosing) && !!referenceEl

  const clearLayoutArtifacts = useCallback(() => {
    const root = panelRootRef.current
    if (!root) return

    const nodes = [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
    for (const node of nodes) {
      node.style.opacity = ''
      node.style.filter = ''
      node.style.transform = ''
      node.style.transition = ''
      node.style.willChange = ''
      node.style.height = ''
      node.style.width = ''
      node.style.maxHeight = ''
    }
  }, [])

  const clearCloseIntent = useCallback(() => {
    if (closeIntentTimerRef.current !== null) {
      window.clearTimeout(closeIntentTimerRef.current)
      closeIntentTimerRef.current = null
    }
  }, [])

  const resetPanelState = useCallback(() => {
    transitionRunIdRef.current += 1
    tagRackScopeRef.current?.methods?.stopDisclosureCadence?.()
    setOpenTagId(null)
    setReferenceEl(null)
    setPanelBodyVisible(false)
    setIsPanelHovered(false)
    setIsClosing(false)
    pendingTransitionRef.current = null
    lastAnimatedTagIdRef.current = null
  }, [])

  const closeDescriptorPanel = useCallback(() => {
    clearCloseIntent()

    if (isClosing || !openTagId) return

    const layout = panelLayoutRef.current
    if (layout && panelLayoutReady) {
      layout.record()
      pendingTransitionRef.current = 'close'
      setIsClosing(true)
      setPanelBodyVisible(false)
      return
    }

    resetPanelState()
  }, [clearCloseIntent, isClosing, openTagId, panelLayoutReady, resetPanelState])

  const queueCloseDescriptorPanel = useCallback(() => {
    clearCloseIntent()
    closeIntentTimerRef.current = window.setTimeout(() => {
      if (!isPanelHovered) {
        closeDescriptorPanel()
      }
    }, TAGRACK_TEMPORAL_BUDGET_MS.handoff)
  }, [clearCloseIntent, closeDescriptorPanel, isPanelHovered])

  const { refs, floatingStyles, context, update } = useFloating({
    open: popoverOpen,
    onOpenChange: (open) => {
      if (!open) {
        closeDescriptorPanel()
      }
    },
    placement: 'top-start',
    strategy: 'fixed',
    middleware: [offset(9), flip({ fallbackAxisSideDirection: 'start' }), shift({ padding: 8 })],
    whileElementsMounted: (...args) => autoUpdate(...args, { animationFrame: true }),
    elements: {
      reference: referenceEl,
    },
  })

  const setPanelLayoutRoot = useCallback((el: HTMLDivElement | null) => {
    if (panelLayoutRef.current) {
      panelLayoutRef.current.revert()
      panelLayoutRef.current = null
    }

    panelRootRef.current = el
    setPanelLayoutReady(false)

    if (!el) return

    panelLayoutRef.current = createLayout(el, {
      enterFrom: {
        opacity: 0,
        transform: 'translateY(-4px) scale(0.965)',
      },
      leaveTo: {
        opacity: 0,
        transform: 'translateY(14px) scale(0.9)',
      },
      duration: TAGRACK_TEMPORAL_BUDGET_MS.enter,
      ease: 'out(3)',
    })

    setPanelLayoutReady(true)
  }, [])

  const openDescriptorPanel = useCallback((tagId: TagDescriptorId, anchor: HTMLElement) => {
    clearCloseIntent()
    setReferenceEl(anchor)

    if (isClosing) {
      transitionRunIdRef.current += 1
      pendingTransitionRef.current = null
      setIsClosing(false)
    }

    const layout = panelLayoutRef.current
    const hasOpenTag = openTagId !== null
    const isSwitch = hasOpenTag && openTagId !== tagId

    if (!hasOpenTag) {
      pendingTransitionRef.current = 'open'
      lastAnimatedTagIdRef.current = null
      setOpenTagId(tagId)
      return
    }

    if (isSwitch) {
      if (layout && panelLayoutReady) {
        layout.record()
      }
      pendingTransitionRef.current = 'switch'
      lastAnimatedTagIdRef.current = null
      setOpenTagId(tagId)
      if (!panelBodyVisible) {
        setPanelBodyVisible(true)
      }
      return
    }

    if (!panelBodyVisible) {
      if (layout && panelLayoutReady) {
        layout.record()
      }
      pendingTransitionRef.current = 'open'
      setPanelBodyVisible(true)
    }
  }, [clearCloseIntent, isClosing, openTagId, panelBodyVisible, panelLayoutReady, setPanelBodyVisible])

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true })
  const role = useRole(context, { role: 'dialog' })
  const { getFloatingProps } = useInteractions([dismiss, role])

  useLayoutEffect(() => {
    const transition = pendingTransitionRef.current
    if (!transition || !panelLayoutReady) return

    const layout = panelLayoutRef.current
    if (!layout) return

    if (transition !== 'close' && !openTagId) {
      pendingTransitionRef.current = null
      return
    }

    if (transition === 'open' && !panelBodyVisible) {
      layout.record()
      setPanelBodyVisible(true)
      return
    }

    if (transition === 'switch' && !panelBodyVisible) {
      layout.record()
      setPanelBodyVisible(true)
      return
    }

    pendingTransitionRef.current = null

    const duration = transition === 'switch'
      ? TAGRACK_TEMPORAL_BUDGET_MS.switch
      : transition === 'close'
        ? TAGRACK_TEMPORAL_BUDGET_MS.exit
        : TAGRACK_TEMPORAL_BUDGET_MS.enter

    const runId = transitionRunIdRef.current + 1
    transitionRunIdRef.current = runId

    const scopeTransition = tagRackScopeRef.current?.methods?.runLayoutTransition as
      | TagRackScopeMethods['runLayoutTransition']
      | undefined

    const scopeTrace = tagRackScopeRef.current?.methods?.traceTransition as
      | ((label: string, payload?: Record<string, unknown>) => void)
      | undefined

    scopeTrace?.('layout-transition:dispatch', {
      transition,
      runId,
      panelBodyVisible,
      hasOpenTag: openTagId !== null,
    })

    const transitionParams = {
      duration,
      ease: transition === 'close' ? 'inExpo' : 'out(3)',
      delay: transition === 'open' ? TAGRACK_TEMPORAL_BUDGET_MS.settle : 0,
      onBegin: () => {
        scopeTrace?.('layout-transition:begin', { transition, runId })
        if (transition === 'close') {
          tagRackScopeRef.current?.methods?.stopDisclosureCadence?.()
        }
      },
      onComplete: () => {
        if (transitionRunIdRef.current !== runId) return

        clearLayoutArtifacts()

        if (transition === 'close') {
          scopeTrace?.('layout-transition:complete', { transition, runId })
          resetPanelState()
          return
        }

        if (openTagId) {
          lastAnimatedTagIdRef.current = openTagId
        }

        update()
        const runDisclosureCadence = tagRackScopeRef.current?.methods?.runDisclosureCadence
        if (runDisclosureCadence) {
          runDisclosureCadence()
        } else {
          quoteRef.current?.replay()
        }
        scopeTrace?.('layout-transition:complete', { transition, runId })
      },
    }

    if (scopeTransition) {
      scopeTransition(transitionParams)
    } else {
      layout.animate(transitionParams)
    }
  }, [clearLayoutArtifacts, openTagId, panelBodyVisible, panelLayoutReady, resetPanelState, setPanelBodyVisible, update])

  useEffect(() => {
    if (!openTagId || openTag || isClosing) return
    resetPanelState()
  }, [isClosing, openTag, openTagId, resetPanelState])

  useEffect(() => {
    const liveIds = new Set(visibleDescriptors.map((descriptor) => descriptor.id))
    const staleIds: TagDescriptorId[] = []

    for (const id of hoverAnchorByTagIdRef.current.keys()) {
      if (!liveIds.has(id)) {
        staleIds.push(id)
      }
    }

    for (const id of staleIds) {
      hoverAnchorByTagIdRef.current.delete(id)
    }
  }, [visibleDescriptors])

  useEffect(() => {
    return () => {
      clearCloseIntent()
      hoverAnchorByTagIdRef.current.clear()
      pendingTransitionRef.current = null
      transitionRunIdRef.current += 1
      if (panelLayoutRef.current) {
        panelLayoutRef.current.revert()
        panelLayoutRef.current = null
      }
    }
  }, [clearCloseIntent])

  const accent = openTag ? tagDescriptorAccent(openTag.id) : '#22d3ee'

  return (
    <div ref={scopeHostRef} style={{ display: 'contents' }}>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        {visibleDescriptors.map((tag) => {
          const hitboxId = `tag-${node.id}-${tag.id}`

          const hitboxPriority = tag.id === 'status'
            ? 30
            : tag.id === 'role'
              ? 20
              : tag.id === 'awareness'
                ? 10
                : 0

          return (
            <MicrointeractionHitbox.Root
              key={tag.id}
              id={hitboxId}
              label={`Tag ${tag.label}`}
              dwellMs={TAGRACK_TEMPORAL_BUDGET_MS.hoverIntent}
              hoverLeaveGraceMs={52}
              priority={hitboxPriority}
              debug={hitboxDebug ? {
                polygonFill: true,
                polygonStroke: true,
                boundsBox: true,
                stateBadge: true,
                timingMs: true,
              } : false}
              onArmedChange={(armed) => {
                if (!armed) return
                const anchor = hoverAnchorByTagIdRef.current.get(tag.id)
                if (!anchor) return
                openDescriptorPanel(tag.id, anchor)
              }}
              onHoverChange={(hovered) => {
                if (hovered) {
                  clearCloseIntent()
                  return
                }

                if (openTagId === tag.id && !isPanelHovered) {
                  queueCloseDescriptorPanel()
                }
              }}
            >
              <MicrointeractionHitbox.Target
                onMouseEnter={(event) => {
                  hoverAnchorByTagIdRef.current.set(tag.id, event.currentTarget)
                }}
                onMouseMove={(event) => {
                  hoverAnchorByTagIdRef.current.set(tag.id, event.currentTarget)
                }}
                onClick={(event) => {
                  event.stopPropagation()
                  onActivate()
                  hoverAnchorByTagIdRef.current.set(tag.id, event.currentTarget)
                  openDescriptorPanel(tag.id, event.currentTarget)
                }}
              >
                <MorphCard.Badge variant={tag.id === 'status' ? 'info' : 'default'}>{tag.label}</MorphCard.Badge>
              </MicrointeractionHitbox.Target>
            </MicrointeractionHitbox.Root>
          )
        })}
      </div>

      {popoverOpen && openTag && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={{ ...floatingStyles, zIndex: 9999, width: panelWidthPx, maxWidth: panelWidthPx }}
            {...getFloatingProps()}
          >
            <div
              ref={setPanelLayoutRoot}
              onMouseEnter={() => {
                clearCloseIntent()
                setIsPanelHovered(true)
              }}
              onMouseLeave={() => {
                setIsPanelHovered(false)
                queueCloseDescriptorPanel()
              }}
              style={{
                background: '#f6f6f2',
                border: isClosing ? '0 solid transparent' : '2px solid #000',
                boxShadow: isClosing ? 'none' : '5px 5px 0 #000',
                padding: 0,
                overflow: 'hidden',
                width: panelWidthPx,
                transformOrigin: 'left bottom',
              }}
            >
              {panelBodyVisible && (
                <section key={openTag.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 10px', transformOrigin: 'left bottom' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(0,0,0,0.2)', paddingBottom: 6 }}>
                    <span
                      ref={panelTagTokenRef}
                      style={{
                        fontFamily: 'var(--rvn-font-mono)',
                        fontSize: 'var(--tmnl-text-xs, 12px)',
                        color: accent,
                        background: '#0a0a0a',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        border: '1px solid #000',
                        padding: '1px 6px',
                        opacity: 0,
                      }}
                    >
                      {openTag.id}
                    </span>
                    <span
                      ref={panelRoleTypeRef}
                      style={{
                        fontFamily: 'var(--rvn-font-sans)',
                        fontSize: 'var(--tmnl-text-sm, 14px)',
                        color: '#111111',
                        fontWeight: 700,
                        textTransform: 'capitalize',
                        flex: 1,
                        minWidth: 0,
                        opacity: 0,
                      }}
                    >
                      {openTag.label}
                    </span>
                  </div>
                  <div
                    ref={panelDescriptionRef}
                    style={{
                      border: '1px solid #111111',
                      background: '#111111',
                      padding: '6px 7px',
                      width: descriptorWidthPx,
                      minHeight: descriptorMinHeightPx,
                      opacity: 0,
                      fontFamily: 'var(--rvn-font-mono)',
                      display: 'grid',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        gridArea: '1 / 1',
                        visibility: 'hidden',
                        whiteSpace: 'pre-wrap',
                        fontSize: 'var(--tmnl-text-sm, 14px)',
                        lineHeight: 1.45,
                      }}
                    >
                      "{openTag.theory}"
                    </div>
                    <div style={{ gridArea: '1 / 1' }}>
                      <ScrambleQuote
                        ref={quoteRef}
                        text={openTag.theory}
                        preset="rapid"
                        manual
                        className="border-none bg-transparent p-0 rounded-none"
                      />
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  )
}

// =============================================================================
// AgentNodeCard — draggable + anime.js status FX
// =============================================================================

interface AgentNodeCardProps {
  node: AgentNode
  isSelected: boolean
  isActive: boolean
  chatExpansionLevel: ChatExpansionLevel
  onChatExpansionLevelChange: (id: string, next: ChatExpansionLevel) => void
  onSelect: (id: string) => void
  onActivate: (id: string) => void
  onOpenChat: (id: string) => void
  onOpenInspector: (id: string) => void
}

function AgentNodeCard({
  node,
  isSelected,
  isActive,
  chatExpansionLevel,
  onChatExpansionLevelChange,
  onSelect,
  onActivate,
  onOpenChat,
  onOpenInspector,
}: AgentNodeCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: node.id })
  const [shiftDragArmed, setShiftDragArmed] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef(node.status)

  const cfg = ROLE_CFG[node.spec.role]
  const RoleIcon = cfg.icon
  const prefersReducedMotion = useReducedMotion()

  const iconMotionProps = prefersReducedMotion
    ? {}
    : {
        whileHover: { y: -1, scale: 1.03 },
        whileTap: { scale: 0.95 },
        transition: { duration: 0.12, ease: 'easeOut' },
      }

  // Node card expansion follows node state and explicit chat intent.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      sendIslandEvent(node.id as any, {
        type: 'TRANSITION',
        sizeKey: chatExpansionLevel === 'l3' ? 'chat' : isActive ? 'expanded' : 'compact',
        reticle: 'corners',
        complexity: 'simple',
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [chatExpansionLevel, isActive, node.id])

  // anime.js: Status-change FX — flash border color on transition
  useEffect(() => {
    if (prevStatusRef.current === node.status) return
    prevStatusRef.current = node.status

    const el = cardRef.current
    if (!el) return

    if (node.status === 'working') {
      animeAnimate(el, {
        borderColor: [cfg.color, '#000'],
        duration: 600,
        easing: 'easeInOutQuad',
        loop: 3,
        direction: 'alternate',
      })
    } else if (node.status === 'complete') {
      animeAnimate(el, {
        borderColor: ['#10b981', '#000'],
        boxShadow: ['0 0 16px rgba(16,185,129,0.4)', '4px 4px 0 rgba(0,0,0,1)'],
        duration: 400,
        easing: 'easeOutQuad',
      })
    } else if (node.status === 'failed') {
      animeAnimate(el, {
        translateX: () => Math.random() * 4 - 2,
        duration: 50,
        easing: 'linear',
        loop: 3,
        direction: 'alternate',
      })
    }
  }, [node.status, cfg.color])

  const style: React.CSSProperties = {
    left: node.position.x,
    top: node.position.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isActive ? 120 : isSelected ? 95 : transform ? 90 : 1,
    userSelect: 'none',
  }

  const compactView = (
    <MorphCard.Content padding="sm">
      <MorphCard.Header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <RoleIcon size={12} style={{ color: cfg.color, flexShrink: 0 }} />
          <MorphCard.Title size="sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.spec.name}
          </MorphCard.Title>
        </div>
        <RvnStatusDot status={STATUS_TO_RVN[node.status]} size={6} />
      </MorphCard.Header>
      <MorphCard.Body>
        <TagRack node={node} mode="compact" onActivate={() => onActivate(node.id)} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', color: '#666', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.spec.model.split('-').slice(-1)[0]}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <motion.button
              type="button"
              {...iconMotionProps}
              aria-label={`Open inspector for ${node.spec.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onOpenInspector(node.id)
              }}
              style={{
                border: '1px solid #000',
                minHeight: 24,
                minWidth: 24,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <Eye size={12} />
            </motion.button>
            <motion.button
              type="button"
              {...iconMotionProps}
              aria-label={`Open chat for ${node.spec.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onOpenChat(node.id)
              }}
              style={{
                border: '1px solid #000',
                minHeight: 24,
                minWidth: 24,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#fff',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <MessageSquare size={12} />
            </motion.button>
          </div>
        </div>
        {node.status === 'working' && <WorkingBar color={cfg.color} />}
      </MorphCard.Body>
    </MorphCard.Content>
  )

  const expandedView = (
    <MorphCard.Content padding="sm">
      <MorphCard.Header>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <RoleIcon size={12} style={{ color: cfg.color, flexShrink: 0 }} />
          <MorphCard.Title size="md" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.spec.name}
          </MorphCard.Title>
        </div>
        <RvnStatusDot status={STATUS_TO_RVN[node.status]} size={6} />
      </MorphCard.Header>
      <MorphCard.Body>
        <TagRack node={node} mode="expanded" onActivate={() => onActivate(node.id)} />
        <div style={{ fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', color: '#666' }}>
          {node.spec.model}
        </div>
        {node.status === 'working' && <WorkingBar color={cfg.color} />}
        {node.output.length > 0 && (
          <div style={{ marginTop: 6, padding: 4, background: '#f4f4f4', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', color: '#333', maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis', border: '1px solid #ddd' }}>
            {node.output[node.output.length - 1]}
          </div>
        )}
      </MorphCard.Body>
      <MorphCard.Footer>
        <span style={{ fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', color: '#666' }}>
          {new Date(node.spawnedAt).toLocaleTimeString()}
        </span>
        <MorphCard.Actions>
          <span style={{ fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', color: '#666' }}>
            {node.output.length} logs
          </span>
          <motion.button
            type="button"
            {...iconMotionProps}
            aria-label={`Open inspector for ${node.spec.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onOpenInspector(node.id)
            }}
            style={{
              border: '1px solid #000',
              minHeight: 24,
              minWidth: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <Eye size={12} />
          </motion.button>
          <motion.button
            type="button"
            {...iconMotionProps}
            aria-label={`Open chat for ${node.spec.name}`}
            onClick={(event) => {
              event.stopPropagation()
              onOpenChat(node.id)
            }}
            style={{
              border: '1px solid #000',
              minHeight: 24,
              minWidth: 24,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fff',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <MessageSquare size={12} />
          </motion.button>
        </MorphCard.Actions>
      </MorphCard.Footer>
    </MorphCard.Content>
  )

  const chatView = (
    <MorphCard.Content padding="sm">
      <AgentInspector
        node={node}
        surface="chat"
        chatExpansionLevel={chatExpansionLevel}
        onChatExpansionLevelChange={(next) => {
          onChatExpansionLevelChange(node.id, next)
        }}
      />
    </MorphCard.Content>
  )

  useEffect(() => {
    if (!transform) {
      setShiftDragArmed(false)
    }
  }, [transform])

  const setChromeRef = useCallback((el: HTMLDivElement | null) => {
    setNodeRef(el)
    cardRef.current = el
    registerNodeRef(node.id, el)
  }, [setNodeRef, node.id])

  return (
    <NodeChrome
      nodeId={node.id}
      isActive={isActive}
      isSelected={isSelected}
      style={style}
      setNodeRef={setChromeRef}
      listeners={listeners as Record<string, unknown>}
      attributes={attributes as Record<string, unknown>}
      groupAccent="#000"
      showShiftDragOverlay={shiftDragArmed && !!transform}
      onPointerDownCapture={(e) => {
        setShiftDragArmed(e.shiftKey)
      }}
      onPointerUpCapture={() => {
        setShiftDragArmed(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.shiftKey) {
          onSelect(node.id)
        } else {
          selectOnly(node.id)
          onActivate(node.id)
        }
      }}
    >
      <MorphCard
        cardId={node.id}
        initialSizeKey="compact"
        stateMachineConfig={{
          sizes: {
            compact: { width: 220, height: 120 },
            expanded: { width: 280, height: 200 },
            chat: { width: 560, height: 460 },
            default: { width: 220, height: 120 },
          },
          reticle: 'corners',
        }}
        transitionStrategy={defaultTransitionStrategy}
        slots={rvnMorphCardSlots}
        theme={rvnMorphCardTheme}
        interactive={false}
        disableAnimations={false}
        dynamicSize
        minWidth={220}
        maxWidth={980}
        minHeight={120}
        maxHeight={860}
        views={{
          compact: compactView,
          expanded: expandedView,
          chat: chatView,
          default: compactView,
        }}
      >
        {null}
      </MorphCard>
    </NodeChrome>
  )
}

/** anime.js indeterminate progress bar */
function WorkingBar({ color }: { color: string }) {
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = barRef.current
    if (!el) return

    const anim = animeAnimate(el, {
      translateX: ['-100%', '200%'],
      duration: 1200,
      easing: 'easeInOutQuad',
      loop: true,
      direction: 'alternate',
    })

    return () => { anim.pause() }
  }, [])

  return (
    <div style={{ marginTop: 6, height: 2, background: '#eee', overflow: 'hidden', position: 'relative' }}>
      <div ref={barRef} style={{ width: '40%', height: '100%', background: color, position: 'absolute', left: 0 }} />
    </div>
  )
}

// =============================================================================
// ToolRail — left sidebar with spawn buttons
// =============================================================================

const ROLES: AgentRole[] = ['scout', 'analyzer', 'planner', 'implementer', 'reviewer', 'conductor']

function ToolRail() {
  // anime.js: staggered entrance for buttons
  const railRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = railRef.current
    if (!el) return
    animeAnimate(el.querySelectorAll('button'), {
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 250,
      easing: 'easeOutQuad',
      delay: stagger(40),
    })
  }, [])

  return (
    <div
      ref={railRef}
      style={{ width: 52, background: '#000', borderRight: '3px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0', gap: 2, flexShrink: 0 }}
    >
      {ROLES.map((role) => {
        const c = ROLE_CFG[role]
        const I = c.icon
        return (
          <RailButton key={role} title={`Spawn ${role}`} onClick={() => spawnNode(role)}>
            <I size={16} style={{ color: c.color }} />
          </RailButton>
        )
      })}
      <div style={{ height: 1, background: '#333', width: '70%', margin: '4px 0' }} />
      {WORKFLOWS.map((wf) => (
        <RailButton key={wf.id} title={wf.name} onClick={() => runWorkflow(wf)}>
          <Play size={14} style={{ color: '#06b6d4' }} />
        </RailButton>
      ))}
    </div>
  )
}

function RailButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  // useRvnAnimate for press feedback
  const { ref, play } = useRvnAnimate<HTMLButtonElement>('press')

  return (
    <button
      ref={ref}
      title={title}
      onClick={() => { play(); onClick() }}
      style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid #333', color: '#fff', cursor: 'pointer', transition: 'background 0.1s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#222' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      {children}
    </button>
  )
}

function ConductorAssistantInlineTaskAttachment({
  threadId,
  messageAnchorId,
  streaming,
  expansionLevel,
}: {
  threadId: string
  messageAnchorId: string
  streaming: boolean
  expansionLevel: ChatExpansionLevel
}) {
  const scopeKey = useMemo(
    () => toInlineTaskUiStateKey(threadId, messageAnchorId),
    [messageAnchorId, threadId],
  )
  const tasksAtom = useMemo(() => inlineTaskExpandedTasksByScopeAtom(scopeKey), [scopeKey])
  const tasks = useAtomValue(tasksAtom)

  if (tasks.length === 0 && !streaming) {
    return null
  }

  return (
    <RvnChat.MessageShell.AttachmentLane.Root messageAnchorId={messageAnchorId}>
      <RvnChat.MessageShell.AttachmentLane.InlineTaskThread>
        <RvnChat.InlineTaskThread.VirtualizedList
          threadId={threadId}
          messageAnchorId={messageAnchorId}
          expansionLevel={expansionLevel}
          streaming={streaming}
          autoOpenOnStreaming
        />
      </RvnChat.MessageShell.AttachmentLane.InlineTaskThread>
    </RvnChat.MessageShell.AttachmentLane.Root>
  )
}

function AgentInspector({
  node,
  surface,
  chatExpansionLevel,
  onChatExpansionLevelChange,
}: {
  node: AgentNode
  surface: ConductorInspectorSurface
  chatExpansionLevel: ChatExpansionLevel
  onChatExpansionLevelChange: (next: ChatExpansionLevel) => void
}) {
  const inspectorRef = useRef<HTMLDivElement>(null)
  const nodeList = useAtomValue(nodeListAtom)

  const activeAgentAtom = useMemo(() => NodeChatAtomAccessors.activeAgent(node.id), [node.id])
  const activeAgentIdForNode = useAtomValue(activeAgentAtom)
  const setActiveAgentForNode = useAtomSet(activeAgentAtom)

  const activeAgentId =
    activeAgentIdForNode && nodeList.some((item) => item.id === activeAgentIdForNode)
      ? activeAgentIdForNode
      : node.id

  const chatMessagesAtom = useMemo(() => NodeChatAtomAccessors.messages(activeAgentId), [activeAgentId])
  const chatPendingAtom = useMemo(() => NodeChatAtomAccessors.pending(activeAgentId), [activeAgentId])
  const chatErrorAtom = useMemo(() => NodeChatAtomAccessors.error(activeAgentId), [activeAgentId])
  const chatStreamingMessageIdAtom = useMemo(() => NodeChatAtomAccessors.streamingMessageId(activeAgentId), [activeAgentId])
  const chatSessionIdAtom = useMemo(() => NodeChatAtomAccessors.sessionId(activeAgentId), [activeAgentId])
  const chatLastSeqAtom = useMemo(() => NodeChatAtomAccessors.lastSeq(activeAgentId), [activeAgentId])
  const chatDraftAtom = useMemo(() => NodeChatAtomAccessors.draft(activeAgentId), [activeAgentId])
  const chatScrollTopAtom = useMemo(() => NodeChatAtomAccessors.scrollTop(activeAgentId), [activeAgentId])
  const chatReliabilityMetricsAtom = useMemo(() => NodeChatAtomAccessors.reliabilityMetrics(activeAgentId), [activeAgentId])
  const sendPromptOpAtom = useMemo(() => NodeChatAtomAccessors.sendPrompt(activeAgentId), [activeAgentId])
  const reconnectNodeOpAtom = useMemo(() => NodeChatAtomAccessors.reconnectNode(activeAgentId), [activeAgentId])
  const abortNodeOpAtom = useMemo(() => NodeChatAtomAccessors.abortNode(activeAgentId), [activeAgentId])

  const chatMessages = useAtomValue(chatMessagesAtom)
  const isPending = useAtomValue(chatPendingAtom)
  const chatError = useAtomValue(chatErrorAtom)
  const chatStreamingMessageId = useAtomValue(chatStreamingMessageIdAtom)
  const chatSessionId = useAtomValue(chatSessionIdAtom)
  const chatLastSeq = useAtomValue(chatLastSeqAtom)
  const chatDraft = useAtomValue(chatDraftAtom)
  const chatScrollTop = useAtomValue(chatScrollTopAtom)
  const chatReliabilityMetrics = useAtomValue(chatReliabilityMetricsAtom)
  const setChatMessages = useAtomSet(chatMessagesAtom)
  const setChatPending = useAtomSet(chatPendingAtom)
  const setChatError = useAtomSet(chatErrorAtom)
  const setChatStreamingMessageId = useAtomSet(chatStreamingMessageIdAtom)
  const setChatSessionId = useAtomSet(chatSessionIdAtom)
  const setChatLastSeq = useAtomSet(chatLastSeqAtom)
  const setChatDraft = useAtomSet(chatDraftAtom)
  const setChatScrollTop = useAtomSet(chatScrollTopAtom)
  const orchestratorConnectivity = useAtomValue(orchestratorConnectivityAtom)
  const runChatPrompt = useAtomSet(sendPromptOpAtom, { mode: 'promise' })
  const runReconnectNode = useAtomSet(reconnectNodeOpAtom, { mode: 'promise' })
  const runAbortNode = useAtomSet(abortNodeOpAtom, { mode: 'promise' })

  const chatDisabled = isPending || orchestratorConnectivity.status !== 'online'
  const [chatReconnectInFlight, setChatReconnectInFlight] = useState(false)
  const [chatResyncInFlight, setChatResyncInFlight] = useState(false)

  const connectionState = useMemo(() => {
    if (chatResyncInFlight) return 'resyncing' as const
    if (chatReconnectInFlight) return 'reconnecting' as const
    if (orchestratorConnectivity.status === 'online') return 'online' as const
    if (orchestratorConnectivity.status === 'checking') return 'connecting' as const
    return 'offline' as const
  }, [chatReconnectInFlight, chatResyncInFlight, orchestratorConnectivity.status])

  const messageState = useMemo(() => {
    if (chatError) return 'error' as const
    if (isPending && chatStreamingMessageId !== null) return 'assistant_streaming' as const
    if (isPending) return 'send_accepted' as const

    const hasDraft = chatDraft.trim().length > 0
    if (hasDraft) return 'typing' as const

    const lastMessage = chatMessages.at(-1)
    if (lastMessage?.role === 'assistant') return 'assistant_finalized' as const

    return 'idle' as const
  }, [chatDraft, chatError, chatMessages, chatStreamingMessageId, isPending])

  const chatStatusRows = useMemo(() => {
    const rows: { id: string; tone: 'info' | 'warn' | 'error'; text: string }[] = []

    if (isPending) {
      rows.push({
        id: 's1-pending',
        tone: 'info',
        text: 'S1 • Message queued — waiting for assistant stream…',
      })
    }

    if (chatReconnectInFlight) {
      rows.push({
        id: 's1-reconnecting',
        tone: 'info',
        text: 'S1 • Reconnecting — restoring node session stream…',
      })
    }

    if (chatResyncInFlight) {
      rows.push({
        id: 's2-resyncing',
        tone: 'warn',
        text: 'S2 • Resyncing — replaying missed events for this node…',
      })
    }

    if (orchestratorConnectivity.status !== 'online') {
      rows.push({
        id: 's2-offline',
        tone: 'warn',
        text: 'S2 • Connection lost — live stream interrupted. Draft is preserved for this node.',
      })
    }

    if (chatError) {
      const normalized = chatError.toLowerCase()

      if (normalized.includes('session')) {
        rows.push({
          id: 's4-session',
          tone: 'error',
          text: 'S4 • Session unavailable — cannot open chat session for this node.',
        })
      } else if (normalized.includes('timeout')) {
        rows.push({
          id: 's3-timeout',
          tone: 'error',
          text: 'S3 • Request timed out — control plane did not respond in time.',
        })
      } else if (normalized.includes('decode') || normalized.includes('format')) {
        rows.push({
          id: 's3-sync-format',
          tone: 'error',
          text: 'S3 • Sync format error — received invalid payload. Please reconnect.',
        })
      } else if (normalized.includes('prompt')) {
        rows.push({
          id: 's3-prompt',
          tone: 'error',
          text: 'S3 • Send failed — agent could not process this prompt. Try again or switch agent.',
        })
      } else {
        rows.push({
          id: 's3-generic',
          tone: 'error',
          text: `S3 • chat-error: ${chatError}`,
        })
      }
    }

    if (chatReliabilityMetrics.sendCount > 0) {
      const ack = chatReliabilityMetrics.avgAckLatencyMs === null
        ? '—'
        : `${Math.round(chatReliabilityMetrics.avgAckLatencyMs)}ms`
      const delta = chatReliabilityMetrics.avgFirstDeltaLagMs === null
        ? '—'
        : `${Math.round(chatReliabilityMetrics.avgFirstDeltaLagMs)}ms`

      rows.push({
        id: 's1-metrics',
        tone: 'info',
        text: `S1 • metrics ack(avg)=${ack} delta(avg)=${delta} replay=${chatReliabilityMetrics.replayEventCount} reconnects=${chatReliabilityMetrics.reconnectCount}`,
      })
    }

    return rows
  }, [
    chatError,
    chatReconnectInFlight,
    chatReliabilityMetrics,
    chatResyncInFlight,
    isPending,
    orchestratorConnectivity.status,
  ])

  // anime.js: cascade entrance when node changes
  useEffect(() => {
    const el = inspectorRef.current
    if (!el) return
    animeAnimate(el.querySelectorAll('[data-inspector-row]'), {
      opacity: [0, 1],
      translateX: [8, 0],
      duration: 200,
      easing: 'easeOutQuad',
      delay: stagger(30),
    })
  }, [node.id])

  const agentOptions = nodeList.map((item) => ({
    id: item.id,
    name: item.spec.name,
    role: item.spec.role,
    model: item.spec.model,
    status: item.status,
  }))

  const activeSessionLabel = useMemo(() => {
    const active = nodeList.find((item) => item.id === activeAgentId)
    const resolvedSessionId = chatSessionId ?? active?.sessionId ?? node.sessionId ?? null
    if (!resolvedSessionId) return undefined

    return chatLastSeq > 0
      ? `${resolvedSessionId} · seq:${chatLastSeq}`
      : resolvedSessionId
  }, [activeAgentId, chatLastSeq, chatSessionId, node.sessionId, nodeList])

  const chatTitle = useMemo(() => {
    const active = nodeList.find((item) => item.id === activeAgentId)
    const nodeName = active?.spec.name ?? node.spec.name
    const resolvedSessionId = chatSessionId ?? active?.sessionId ?? node.sessionId ?? null

    if (!resolvedSessionId) {
      return `${nodeName} Session`
    }

    return `${nodeName} · ${resolvedSessionId}`
  }, [activeAgentId, chatSessionId, node.sessionId, node.spec.name, nodeList])

  useEffect(() => {
    if (activeAgentIdForNode && !nodeList.some((item) => item.id === activeAgentIdForNode)) {
      setActiveAgentForNode(node.id)
    }
  }, [activeAgentIdForNode, node.id, nodeList, setActiveAgentForNode])

  const showInspectorDetails = surface === 'inspector'
  const showChatSurface = surface === 'chat'

  return (
    <div ref={inspectorRef} style={{ display: 'flex', flexDirection: 'column', gap: showInspectorDetails ? 12 : 8 }}>
      {showInspectorDetails && (
        <>
          <div>
            <div style={{ fontFamily: 'var(--rvn-font-sans)', fontSize: 'var(--tmnl-text-sm, 14px)', fontWeight: 700, marginBottom: 4 }}>
              {node.spec.name}
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <RvnBadge variant="filled">{node.spec.role}</RvnBadge>
              <RvnBadge>{node.status}</RvnBadge>
              <RvnBadge variant="muted">{node.spec.awareness}</RvnBadge>
            </div>
          </div>

          <div style={{ border: '2px solid #000', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {([
              ['ID', node.id],
              ['MODEL', node.spec.model],
              ['SPAWNED', new Date(node.spawnedAt).toLocaleTimeString()],
              ['SESSION', node.sessionId ?? '—'],
              ['OUTPUT', `${node.output.length} lines`],
            ] as const).map(([label, value]) => (
              <div key={label} data-inspector-row style={{ display: 'flex', borderBottom: '1px solid #ddd', padding: '4px 8px' }}>
                <span style={{ width: 70, fontWeight: 700, flexShrink: 0, color: '#666' }}>{label}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#000' }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            <ActionBtn icon={<Terminal size={12} />} label="Terminal" onClick={() => { reg.set(terminalExpandedAtom, true); log(`📺 Terminal → ${node.spec.name}`) }} />
            <ActionBtn icon={<Trash2 size={12} />} label="Kill" destructive onClick={() => removeNode(node.id)} />
          </div>
        </>
      )}

      {showChatSurface && (
        <RvnHarnessChatSurface
          nodeId={node.id}
          title={chatTitle}
          agents={agentOptions}
          activeAgentId={activeAgentId}
          onActiveAgentChange={(nextAgentId) => {
            setActiveAgentForNode(nextAgentId)
            void provisionNodeAgentOnActivate(nextAgentId)
          }}
          messages={chatMessages}
          disabled={chatDisabled}
          quickActions={['/status', '/alarm', '@WO-4821']}
          slashCommands={[
            { id: 'status', command: '/status', description: 'System overview' },
            { id: 'status-wo', command: '/status:wo', description: 'Work order status summary' },
            { id: 'alarm', command: '/alarm', description: 'Active alarms' },
            { id: 'escalate', command: '/escalate', description: 'Escalate selected work order' },
          ]}
          mentionEntities={nodeList.map((item) => ({
            id: item.id,
            label: item.spec.name,
            subtitle: `${item.spec.role} · ${item.status}`,
          }))}
          statusRows={chatStatusRows}
          streamingMessageId={chatStreamingMessageId}
          draft={chatDraft}
          onDraftChange={setChatDraft}
          threadScrollTop={chatScrollTop}
          onThreadScrollTopChange={setChatScrollTop}
          expansionLevel={chatExpansionLevel}
          onToggleExpansion={(nextLevel) => {
            onChatExpansionLevelChange(nextLevel)
          }}
          onExitChat={() => {
            onChatExpansionLevelChange('l2')
          }}
          connectionState={connectionState}
          messageState={messageState}
          sessionLabel={activeSessionLabel}
          onPause={async (targetAgentId) => {
            const target = nodeList.find((item) => item.id === targetAgentId)
            if (!target) {
              logSystem(`chat-pause dropped: unknown target '${targetAgentId}'`)
              return
            }

            const requestId = `abort-${targetAgentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            const outcome = await (runAbortNode({ requestId }) as Promise<NodeChatAbortOutcome>)

            if (outcome.ok) {
              logSystem(`chat-pause ${targetAgentId} ok`)
              return
            }

            const message = outcome.error ?? 'unknown pause failure'
            reg.set(NodeChatAtomAccessors.error(targetAgentId), message)
            logSystem(`chat-pause failed ${targetAgentId}: ${message}`)
          }}
          onReconnect={async (targetAgentId) => {
            setChatReconnectInFlight(true)

            try {
              await probeOrchestratorConnectivity()
              if (!isOrchestratorOnline()) {
                return
              }

              const target = nodeList.find((item) => item.id === targetAgentId)
              if (!target) {
                logSystem(`chat-reconnect dropped: unknown target '${targetAgentId}'`)
                return
              }

              const requestId = `reconnect-${targetAgentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

              setChatResyncInFlight(true)
              const outcome = await (runReconnectNode({
                requestId,
                role: target.spec.role,
              }) as Promise<NodeChatReconnectOutcome>)

              if (outcome.ok) {
                logSystem(`chat-reconnect ${targetAgentId} ok replayed=${outcome.replayedEventCount}`)
                return
              }

              const message = outcome.error ?? 'unknown reconnect failure'
              reg.set(NodeChatAtomAccessors.error(targetAgentId), message)
              logSystem(`chat-reconnect failed ${targetAgentId}: ${message}`)
            } finally {
              setChatReconnectInFlight(false)
              setTimeout(() => {
                setChatResyncInFlight(false)
              }, 300)
            }
          }}
          onResetSession={async (targetAgentId) => {
            const target = nodeList.find((item) => item.id === targetAgentId)
            if (!target) {
              logSystem(`chat-reset dropped: unknown target '${targetAgentId}'`)
              return
            }

            const requestId = `reset-${targetAgentId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            const outcome = await (runAbortNode({ requestId }) as Promise<NodeChatAbortOutcome>)

            setChatPending(false)
            setChatStreamingMessageId(null)
            setChatDraft('')
            setChatScrollTop(0)
            setChatMessages([])
            setChatLastSeq(0)
            setChatSessionId(null)
            setChatReconnectInFlight(false)
            setChatResyncInFlight(false)
            setNodeField(targetAgentId, 'status', 'idle')
            setNodeField(targetAgentId, 'sessionId', null)
            appendNodeOutput(targetAgentId, `[${new Date().toLocaleTimeString()}] • trace: session reset`)

            if (outcome.ok || chatSessionId === null) {
              setChatError(null)
              logSystem(`chat-reset ${targetAgentId} ok`)
              return
            }

            const message = outcome.error ?? 'unknown reset failure'
            setChatError(message)
            logSystem(`chat-reset failed ${targetAgentId}: ${message}`)
          }}
          onSend={async (payload) => {
            const targetNodeId = nodeList.some((item) => item.id === payload.targetAgentId)
              ? payload.targetAgentId
              : activeAgentId

            const maybeTarget = HashMap.get(reg.get(nodesAtom), targetNodeId)
            if (Option.isNone(maybeTarget)) {
              logSystem(`chat-send dropped: unknown target '${targetNodeId}'`)
              return
            }

            const targetNode = maybeTarget.value

            if (!isOrchestratorOnline()) {
              failNodePromptAsOffline(targetNodeId, 'harness runtime offline (chat blocked)')
              logSystem(`chat-send blocked ${node.id} -> ${targetNodeId}: harness runtime offline`)
              return
            }

            const requestId = `${targetNodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

            setNodeField(targetNodeId, 'status', 'working')
            appendNodeOutput(targetNodeId, `[${new Date().toLocaleTimeString()}] • trace: prompt dispatched`)
            logSystem(`chat-send ${node.id} -> ${targetNodeId}`)

            try {
              const outcome = await (runChatPrompt({
                requestId,
                role: targetNode.spec.role,
                prompt: payload.text,
                thinkingLevel: payload.thinkingLevel,
              }) as Promise<NodeChatSendOutcome>)

              if (outcome.ok) {
                if (outcome.agentId) {
                  setNodeField(targetNodeId, 'sessionId', outcome.agentId)
                }

                if (outcome.assistantText.length > 0) {
                  appendNodeOutput(
                    targetNodeId,
                    `[${new Date().toLocaleTimeString()}] • trace: ${outcome.assistantText}`,
                  )
                  setNodeField(targetNodeId, 'status', 'complete')
                } else {
                  setNodeField(targetNodeId, 'status', 'working')
                  appendNodeOutput(
                    targetNodeId,
                    `[${new Date().toLocaleTimeString()}] • trace: stream accepted`,
                  )
                }
                return
              }

              const message = outcome.error ?? 'unknown error'
              setNodeField(targetNodeId, 'status', 'failed')
              reg.set(NodeChatAtomAccessors.pending(targetNodeId), false)
              reg.set(NodeChatAtomAccessors.error(targetNodeId), message)
              appendNodeOutput(
                targetNodeId,
                `[${new Date().toLocaleTimeString()}] • trace:error ${message}`,
              )
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              setNodeField(targetNodeId, 'status', 'failed')
              reg.set(NodeChatAtomAccessors.pending(targetNodeId), false)
              reg.set(NodeChatAtomAccessors.error(targetNodeId), message)
              appendNodeOutput(
                targetNodeId,
                `[${new Date().toLocaleTimeString()}] • trace:error ${message}`,
              )
              logSystem(`chat-send failed ${targetNodeId}: ${message}`)
            }
          }}
          onBreakout={(message) => {
            log(`▶ BREAKOUT ${node.spec.name}: ${message.text.slice(0, 80)}`)
          }}
        />
      )}


      {showInspectorDetails && node.output.length > 0 && (
        <div>
          <div style={{ fontFamily: 'var(--rvn-font-sans)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
            Output ({node.output.length})
          </div>
          <div style={{ border: '2px solid #000', maxHeight: 160, overflow: 'auto', background: '#f4f4f4', padding: 8, fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            {node.output.map((line, i) => <div key={i} style={{ marginBottom: 2 }}>{line}</div>)}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * INSPECT-TRAP follow-through (Lexicon #11): inline detached inspector surface.
 * Reference: ./conductor/NODE_STATE_LEXICON.md
 */
function InlineInspectorOverlay({
  node,
  referenceElement,
  portalRoot,
  chatExpansionLevel,
  onChatExpansionLevelChange,
  onClose,
}: {
  node: AgentNode | null
  referenceElement: HTMLElement | null
  portalRoot: HTMLElement | null
  chatExpansionLevel: ChatExpansionLevel
  onChatExpansionLevelChange: (next: ChatExpansionLevel) => void
  onClose: () => void
}) {
  const open = !!node && !!referenceElement

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) onClose()
    },
    placement: 'right-start',
    middleware: [
      offset(12),
      flip({ fallbackAxisSideDirection: 'start' }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
    elements: {
      reference: referenceElement,
    },
  })

  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true })
  const role = useRole(context, { role: 'dialog' })
  const { getFloatingProps } = useInteractions([dismiss, role])
  const prefersReducedMotion = useReducedMotion()

  const panelWidth = useMemo(() => {
    if (chatExpansionLevel !== 'l3') {
      return 320
    }

    if (typeof window === 'undefined') {
      return 960
    }

    return Math.min(960, Math.max(460, window.innerWidth - 80))
  }, [chatExpansionLevel])

  const panelTitle = chatExpansionLevel === 'l3' ? 'Node Chat' : 'Inline Inspector'

  if (!open || !node) return null

  return (
    <FloatingPortal root={portalRoot}>
      <motion.div
        key={`inline-inspector-${node.id}`}
        ref={refs.setFloating}
        initial={prefersReducedMotion ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0, y: 6, scale: 0.98 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: 'easeOut' }}
        style={{ ...floatingStyles, zIndex: 12000, width: panelWidth }}
        {...getFloatingProps()}
      >
        <div style={{ background: '#fff', border: '3px solid #000', boxShadow: '6px 6px 0 rgba(0,0,0,0.24)', maxHeight: chatExpansionLevel === 'l3' ? '84vh' : '70vh', overflow: 'auto' }}>
          <div style={{ background: '#000', color: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #000' }}>
            <span style={{ fontFamily: 'var(--rvn-font-sans)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {panelTitle}
            </span>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff' }}>
              <EyeOff size={12} />
            </button>
          </div>
          <div style={{ padding: 12 }}>
            <AgentInspector
              node={node}
              surface="inspector"
              chatExpansionLevel={chatExpansionLevel}
              onChatExpansionLevelChange={onChatExpansionLevelChange}
            />
          </div>
        </div>
      </motion.div>
    </FloatingPortal>
  )
}

function ActionBtn({ icon, label, onClick, destructive = false }: { icon: ReactNode; label: string; onClick: () => void; destructive?: boolean }) {
  const { ref, play } = useRvnAnimate<HTMLButtonElement>('press')
  const [hover, setHover] = useState(false)
  return (
    <button
      ref={ref}
      onClick={() => { play(); onClick() }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
        background: hover ? (destructive ? '#ff6b6b' : '#000') : 'transparent',
        color: hover ? '#fff' : destructive ? '#ff6b6b' : '#000',
        border: `2px solid ${destructive ? '#ff6b6b' : '#000'}`,
        fontFamily: 'var(--rvn-font-sans)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      {icon}{label}
    </button>
  )
}

// =============================================================================
// StatusBar
// =============================================================================

function StatusBar() {
  const agentCount = useAtomValue(activeCountAtom)
  const status = useAtomValue(wfStatusAtom)
  const progress = useAtomValue(wfProgressAtom)
  const microHitboxDebug = useAtomValue(microHitboxDebugAtom)
  const setMicroHitboxDebug = useAtomSet(microHitboxDebugAtom)
  const orchestratorConnectivity = useAtomValue(orchestratorConnectivityAtom)

  const connectivityColor =
    orchestratorConnectivity.status === 'online'
      ? '#10b981'
      : orchestratorConnectivity.status === 'offline'
        ? '#f43f5e'
        : '#f59e0b'

  const connectivityText =
    orchestratorConnectivity.status === 'online'
      ? `PI WS ONLINE ${orchestratorConnectivity.latencyMs ?? 0}ms`
      : orchestratorConnectivity.status === 'offline'
        ? 'PI WS OFFLINE'
        : 'PI WS CHECKING'

  return (
    <div style={{ height: 32, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '3px solid #000', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/" style={{ color: '#06b6d4', textDecoration: 'none' }}>← HOME</Link>
        <span style={{ fontWeight: 700, letterSpacing: '0.1em' }}>CONDUCTOR</span>
        <span style={{ color: '#666' }}>|</span>
        <span>AGENTS: {agentCount}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={() => { void probeOrchestratorConnectivity() }}
          style={{
            background: 'transparent',
            color: connectivityColor,
            border: `1px solid ${connectivityColor}`,
            padding: '2px 8px',
            cursor: 'pointer',
            fontFamily: 'var(--rvn-font-mono)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
          title={orchestratorConnectivity.lastError ?? 'Probe pi orchestrator remote websocket health'}
        >
          {connectivityText}
        </button>

        <button
          type="button"
          onClick={() => setMicroHitboxDebug(!microHitboxDebug)}
          style={{
            background: microHitboxDebug ? '#ec4899' : 'transparent',
            color: microHitboxDebug ? '#fff' : '#ec4899',
            border: '1px solid #ec4899',
            padding: '2px 8px',
            cursor: 'pointer',
            fontFamily: 'var(--rvn-font-mono)',
            fontSize: 'var(--tmnl-text-xs, 12px)',
            fontWeight: 700,
            textTransform: 'uppercase',
          }}
          title="Toggle Microinteraction Hitbox debug overlay"
        >
          HBX DBG {microHitboxDebug ? 'ON' : 'OFF'}
        </button>

        {status !== 'idle' && (
          <span style={{ color: status === 'running' ? '#06b6d4' : status === 'complete' ? '#10b981' : '#f43f5e' }}>
            ● {status.toUpperCase()} {status === 'running' && `${progress.current}/${progress.total}`}
          </span>
        )}
        <KillAllButton />
      </div>
    </div>
  )
}

function KillAllButton() {
  const { ref, play } = useRvnAnimate<HTMLButtonElement>('press')
  return (
    <button
      ref={ref}
      onClick={() => {
        play()
        for (const id of HashMap.keys(reg.get(nodesAtom))) removeNode(id)
        reg.set(wfStatusAtom, 'idle')
        log('⚠ All agents terminated')
      }}
      style={{ background: 'transparent', border: '1px solid #333', color: '#ff6b6b', padding: '2px 8px', cursor: 'pointer', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700, textTransform: 'uppercase' }}
    >
      KILL ALL
    </button>
  )
}

// =============================================================================
// TerminalPanel — expandable log
// =============================================================================

function TerminalPanel() {
  const expanded = useAtomValue(terminalExpandedAtom)
  const activeNode = useAtomValue(activeNodeAtom)
  const channel = useAtomValue(logViewerChannelAtom)
  const setChannel = useAtomSet(logViewerChannelAtom)
  const retentionLimit = useAtomValue(logRetentionLimitAtom)
  const logEvents = useAtomValue(logEventsSubscribableAtom)
  const logEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const counts = useMemo(() => {
    let operations = 0
    let tagrack = 0
    for (const event of logEvents) {
      if (event.channel === 'operations') operations += 1
      if (event.channel === 'tagrack') tagrack += 1
    }
    return {
      operations,
      tagrack,
      all: logEvents.length,
    }
  }, [logEvents])

  const logLines = useMemo(() => {
    const scoped = channel === 'all'
      ? logEvents
      : logEvents.filter((event) => event.channel === channel)
    return scoped.map(formatLogLine)
  }, [channel, logEvents])

  // anime.js: slide open
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    animeAnimate(el, { height: expanded ? 220 : 28, duration: 200, easing: 'easeOutQuad' })
  }, [expanded])

  useEffect(() => {
    logSystem('Conductor log viewer online')
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logLines])

  const tabs: ReadonlyArray<{ id: LogViewerChannel; label: string; count: number }> = [
    { id: 'operations', label: 'OPERATIONS', count: counts.operations },
    { id: 'tagrack', label: 'TAGRACK', count: counts.tagrack },
    { id: 'all', label: 'ALL', count: counts.all },
  ]

  return (
    <div ref={panelRef} style={{ height: 28, background: '#000', borderTop: '3px solid #000', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      <button
        onClick={() => reg.set(terminalExpandedAtom, !expanded)}
        style={{ height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: '#111', border: 'none', borderBottom: expanded ? '1px solid #333' : 'none', color: '#fff', cursor: 'pointer', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, width: '100%', textAlign: 'left' }}
      >
        <Terminal size={12} style={{ color: '#06b6d4' }} />
        <span>{activeNode ? `TERMINAL — ${activeNode.spec.name}` : 'LOG VIEWER'}</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        <span style={{ marginLeft: 'auto', color: '#666' }}>{logLines.length}</span>
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 12px', borderBottom: '1px solid #222', background: '#0d0d0d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {tabs.map((tab) => {
              const active = tab.id === channel
              return (
                <button
                  key={tab.id}
                  onClick={() => setChannel(tab.id)}
                  style={{
                    border: active ? '1px solid #22d3ee' : '1px solid #334155',
                    background: active ? '#083344' : '#0f172a',
                    color: active ? '#ecfeff' : '#94a3b8',
                    boxShadow: active ? 'inset 0 0 0 1px rgba(34,211,238,0.35)' : 'none',
                    padding: '2px 8px',
                    cursor: 'pointer',
                    fontFamily: 'var(--rvn-font-mono)',
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {tab.label} {tab.count}
                </button>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: '#94a3b8', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', textTransform: 'uppercase' }}>
              Retention
            </span>

            <input
              type="number"
              min={1}
              step={1}
              value={retentionLimit}
              onChange={(event) => {
                const parsed = Number(event.currentTarget.value)
                if (!Number.isFinite(parsed) || parsed <= 0) return
                setLogRetentionLimit(parsed)
              }}
              style={{
                width: 84,
                background: '#020617',
                color: '#cbd5e1',
                border: '1px solid #334155',
                padding: '2px 6px',
                fontFamily: 'var(--rvn-font-mono)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {LOG_RETENTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setLogRetentionLimit(preset)}
                  style={{
                    border: '1px solid #334155',
                    background: preset === retentionLimit ? '#164e63' : '#0f172a',
                    color: preset === retentionLimit ? '#cffafe' : '#94a3b8',
                    padding: '2px 6px',
                    cursor: 'pointer',
                    fontFamily: 'var(--rvn-font-mono)',
                    fontSize: 'var(--tmnl-text-xs, 12px)',
                    fontWeight: 700,
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>

            <button
              onClick={() => clearLogEvents(channel)}
              style={{
                marginLeft: 'auto',
                border: '1px solid #7f1d1d',
                background: '#1f0a0a',
                color: '#fecaca',
                padding: '2px 8px',
                cursor: 'pointer',
                fontFamily: 'var(--rvn-font-mono)',
                fontSize: 'var(--tmnl-text-xs, 12px)',
                fontWeight: 700,
                textTransform: 'uppercase',
              }}
            >
              Clear {channel.toUpperCase()}
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 12px', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', color: '#aaa' }}>
        {logLines.map((line, i) => <div key={i} style={{ padding: '1px 0', whiteSpace: 'pre-wrap' }}>{line}</div>)}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}

// =============================================================================
// Canvas Surface — the main stage
// =============================================================================

function CanvasSurface() {
  const nodes = useAtomValue(nodeListAtom)
  const viewport = useAtomValue(viewportAtom)
  const activeNodeId = useAtomValue(activeNodeIdAtom)
  const inspectorNode = useAtomValue(inspectorNodeAtom)
  const inspectorNodeId = useAtomValue(inspectorNodeIdAtom)
  const selectedNodeIds = useAtomValue(selectedNodeIdsAtom)
  const selectedCount = useAtomValue(selectedCountAtom)
  const nodeRefs = useAtomValue(nodeRefsAtom)
  const containerRef = useRef<HTMLDivElement>(null!)

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)
  const [chatExpansionByNodeId, setChatExpansionByNodeId] = useState<Record<string, ChatExpansionLevel>>({})

  const activeReferenceElement = useMemo(() => {
    if (!inspectorNodeId) return null
    const maybeRef = HashMap.get(nodeRefs, inspectorNodeId)
    return Option.isSome(maybeRef) ? maybeRef.value : null
  }, [inspectorNodeId, nodeRefs])

  const activeChatExpansionLevel: ChatExpansionLevel =
    inspectorNodeId === null
      ? 'l2'
      : (chatExpansionByNodeId[inspectorNodeId] ?? 'l2')

  // Swallow browser/page zoom gestures within canvas (portable ctrl/cmd+wheel guard)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const preventZoomWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
      }
    }

    const preventGesture = (event: Event) => {
      event.preventDefault()
    }

    el.addEventListener('wheel', preventZoomWheel, { passive: false })
    el.addEventListener('gesturestart', preventGesture as EventListener, { passive: false } as AddEventListenerOptions)
    el.addEventListener('gesturechange', preventGesture as EventListener, { passive: false } as AddEventListenerOptions)

    return () => {
      el.removeEventListener('wheel', preventZoomWheel)
      el.removeEventListener('gesturestart', preventGesture as EventListener)
      el.removeEventListener('gesturechange', preventGesture as EventListener)
    }
  }, [])

  // dnd-kit
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event
    const id = active.id as string
    const vp = reg.get(viewportAtom)
    const maybeNode = HashMap.get(reg.get(nodesAtom), id)
    if (Option.isNone(maybeNode)) return
    const n = maybeNode.value
    setNodeField(id, 'position', { x: n.position.x + delta.x / vp.zoom, y: n.position.y + delta.y / vp.zoom })
  }, [])

  // Pan (middle mouse)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY }
      return
    }

    if (e.button === 0 && e.target === containerRef.current) {
      reg.set(activeNodeIdAtom, null)
      reg.set(inspectorNodeIdAtom, null)
      clearSelection()
    }
  }, [])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const vp = reg.get(viewportAtom)
    reg.set(viewportAtom, { ...vp, panX: vp.panX + (e.clientX - panStart.current.x), panY: vp.panY + (e.clientY - panStart.current.y) })
    panStart.current = { x: e.clientX, y: e.clientY }
  }, [])
  const handleMouseUp = useCallback(() => { isPanning.current = false }, [])

  // Wheel: pan by default, ctrl/cmd+wheel zooms (canvas-like)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const vp = reg.get(viewportAtom)

    if (e.ctrlKey || e.metaKey) {
      reg.set(viewportAtom, {
        ...vp,
        zoom: Math.max(0.25, Math.min(3, vp.zoom - e.deltaY * 0.001)),
      })
      return
    }

    reg.set(viewportAtom, {
      ...vp,
      panX: vp.panX - e.deltaX,
      panY: vp.panY - e.deltaY,
    })
  }, [])

  const activateNode = useCallback((id: string) => {
    reg.set(activeNodeIdAtom, id)
    void provisionNodeAgentOnActivate(id)
  }, [])

  const setActiveChatExpansionLevel = useCallback((next: ChatExpansionLevel) => {
    if (!inspectorNodeId) return
    setChatExpansionByNodeId((previous) => ({
      ...previous,
      [inspectorNodeId]: next,
    }))
  }, [inspectorNodeId])

  const openNodeInspector = useCallback((id: string) => {
    reg.set(inspectorNodeIdAtom, id)
    reg.set(activeNodeIdAtom, id)
    setChatExpansionByNodeId((previous) => ({
      ...previous,
      [id]: 'l2',
    }))
  }, [])

  const openNodeChat = useCallback((id: string) => {
    reg.set(inspectorNodeIdAtom, null)
    reg.set(activeNodeIdAtom, id)
    setChatExpansionByNodeId((previous) => ({
      ...previous,
      [id]: 'l3',
    }))
    void provisionNodeAgentOnActivate(id)
  }, [])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        overscrollBehavior: 'none',
        background: '#e6e6e6',
        cursor: isPanning.current ? 'grabbing' : 'default',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onWheelCapture={handleWheel}
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
    >
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)', backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`, backgroundPosition: `${viewport.panX}px ${viewport.panY}px`, pointerEvents: 'none' }} />

      {/* Zoom label */}
      <div style={{ position: 'absolute', bottom: 8, right: 8, background: '#000', color: '#fff', padding: '2px 8px', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', zIndex: 10, border: '2px solid #000' }}>
        {Math.round(viewport.zoom * 100)}% | sel:{selectedCount}
      </div>

      {/* Canvas transform + dnd-kit + layout root */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <MorphCardRegistryProvider>
          <div
            style={{ position: 'absolute', left: viewport.panX, top: viewport.panY, transform: `scale(${viewport.zoom})`, transformOrigin: '0 0' }}
          >
            {nodes.map((node) => (
              <AgentNodeCard
                key={node.id}
                node={node}
                isSelected={HashSet.has(selectedNodeIds, node.id)}
                isActive={activeNodeId === node.id}
                chatExpansionLevel={chatExpansionByNodeId[node.id] ?? 'l2'}
                onChatExpansionLevelChange={(id, next) => {
                  setChatExpansionByNodeId((previous) => ({
                    ...previous,
                    [id]: next,
                  }))
                }}
                onSelect={(id) => toggleSelection(id)}
                onActivate={activateNode}
                onOpenChat={openNodeChat}
                onOpenInspector={openNodeInspector}
              />
            ))}
          </div>
        </MorphCardRegistryProvider>
      </DndContext>

      <AnimatePresence>
        <InlineInspectorOverlay
          node={inspectorNode}
          referenceElement={activeReferenceElement}
          portalRoot={containerRef.current}
          chatExpansionLevel={activeChatExpansionLevel}
          onChatExpansionLevelChange={setActiveChatExpansionLevel}
          onClose={() => reg.set(inspectorNodeIdAtom, null)}
        />
      </AnimatePresence>

      {/* Context menu */}
      <AnimatePresence>
        {ctxMenu && (
          <CanvasContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            containerRef={containerRef}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// =============================================================================
// Context Menu — RVN brutalist + Framer entrance
// =============================================================================

function CanvasContextMenu({ x, y, containerRef, onClose }: {
  x: number; y: number
  containerRef: React.RefObject<HTMLDivElement | null>; onClose: () => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  // anime.js: list reveal on mount
  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    animeAnimate(el.querySelectorAll('[data-ctx-item]'), {
      opacity: [0, 1],
      translateX: [-6, 0],
      duration: 150,
      easing: 'easeOutQuad',
      delay: stagger(20),
    })
  }, [])

  // Close on outside click / escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose() }
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleKey) }
  }, [onClose])

  const spawnAt = useCallback((role: AgentRole) => {
    const rect = containerRef.current?.getBoundingClientRect()
    const vp = reg.get(viewportAtom)
    if (rect) spawnNode(role, { x: (x - rect.left - vp.panX) / vp.zoom, y: (y - rect.top - vp.panY) / vp.zoom })
    onClose()
  }, [x, y, containerRef, onClose])

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      style={{ position: 'fixed', left: x, top: y, zIndex: 9999, background: '#000', border: '3px solid #000', boxShadow: '6px 6px 0 rgba(0,0,0,0.3)', minWidth: 200, padding: '4px 0' }}
    >
      <CtxLabel>Spawn Agent</CtxLabel>
      {ROLES.map((role) => {
        const c = ROLE_CFG[role]; const I = c.icon
        return <CtxItem key={role} onClick={() => spawnAt(role)}><I size={12} style={{ color: c.color }} />{role.toUpperCase()}</CtxItem>
      })}
      <div style={{ height: 1, background: '#333', margin: '4px 0' }} />

      <CtxItem onClick={() => { reg.set(viewportAtom, { panX: 0, panY: 0, zoom: 1 }); onClose() }}>
        <Maximize2 size={12} style={{ color: '#666' }} />RESET VIEW
      </CtxItem>
      <CtxItem onClick={() => { reg.set(activeNodeIdAtom, null); reg.set(inspectorNodeIdAtom, null); clearSelection(); onClose() }}>
        <Square size={12} style={{ color: '#666' }} />CLEAR ACTIVE
      </CtxItem>
    </motion.div>
  )
}

function CtxLabel({ children }: { children: ReactNode }) {
  return <div style={{ padding: '4px 12px', color: '#666', fontFamily: 'var(--rvn-font-mono)', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{children}</div>
}

function CtxItem({ children, onClick, destructive = false }: { children: ReactNode; onClick: () => void; destructive?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      data-ctx-item
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', background: hover ? '#222' : 'transparent', color: destructive ? '#ff6b6b' : '#fff', border: 'none', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', cursor: 'pointer', textAlign: 'left' }}
    >
      {children}
    </button>
  )
}

// =============================================================================
// Main Testbed
// =============================================================================

function ConductorTestbedInner() {
  useEffect(() => {
    let mounted = true

    const run = async () => {
      if (!mounted) return
      await probeOrchestratorConnectivity()
    }

    void run()
    const interval = window.setInterval(() => {
      void run()
    }, 5000)

    return () => {
      mounted = false
      window.clearInterval(interval)
    }
  }, [])

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: '#e6e6e6',
      }}
    >
      <StatusBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ToolRail />
        <CanvasSurface />
      </div>
      <TerminalPanel />
    </div>
  )
}

export function ConductorTestbed() {
  return (
    <RegistryContext.Provider value={reg as any}>
      <MicrointeractionHitbox.Provider>
        <ConductorTestbedInner />
      </MicrointeractionHitbox.Provider>
    </RegistryContext.Provider>
  )
}
