/**
 * Conductor Canvas Testbed
 *
 * Spatial orchestration surface for multi-agent workflows.
 * Agents live as draggable nodes on an infinite canvas.
 *
 * Integration surface:
 * - anime.js 4.3.2 layout (createLayout for node enter/leave/rearrange)
 * - anime.js animate + createTimeline for status transitions & FX
 * - anime.js createScope for lifecycle cleanup
 * - RVN design system (panels, badges, status dots, context menu)
 * - Selection overlay (marquee select, Shift+click multi-select)
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
  useLayoutEffect,
  type ReactNode,
} from 'react'
import { Link } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
import { Atom } from '@effect-atom/atom'
import { Registry, RegistryContext } from '@effect-atom/atom-react'
import { useAtomValue } from '@effect-atom/atom-react'
import * as React from 'react'

// anime.js 4.3.2
import {
  createLayout,
  animate as animeAnimate,
  createScope,
  stagger,
  spring,
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

// Selection
import { SelectionOverlay } from '@/lib/selection/SelectionOverlay'
import {
  selectItem,
  deselectAll,
  subscribeToSelection,
} from '@/lib/selection/selection-stx'

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
  Zap,
  Search,
  Code,
  Shield,
  Bot,
  Activity,
  Network,
} from 'lucide-react'

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

// Registry singleton — all mutations go through this
const reg = Registry.make()

// Primary atoms
const nodesAtom = Atom.make<Map<string, AgentNode>>(new Map())
const viewportAtom = Atom.make<CanvasViewport>({ panX: 0, panY: 0, zoom: 1 })
const activeNodeIdAtom = Atom.make<string | null>(null)
const terminalExpandedAtom = Atom.make(false)
const inspectorExpandedAtom = Atom.make(true)
const logAtom = Atom.make<string[]>([])
const wfStatusAtom = Atom.make<'idle' | 'running' | 'complete' | 'failed'>('idle')
const wfProgressAtom = Atom.make<{ current: number; total: number }>({ current: 0, total: 0 })

// Derived (read-only)
const nodeListAtom = Atom.make((get) => Array.from(get(nodesAtom).values()))
const activeNodeAtom = Atom.make((get) => {
  const id = get(activeNodeIdAtom)
  return id ? get(nodesAtom).get(id) ?? null : null
})
const activeCountAtom = Atom.make((get) =>
  get(nodeListAtom).filter((n) => n.status !== 'terminated' && n.status !== 'failed').length,
)

// =============================================================================
// Imperative helpers (mutate atoms via registry)
// =============================================================================

const log = (msg: string) => {
  const ts = new Date().toLocaleTimeString()
  reg.set(logAtom, [...reg.get(logAtom).slice(-49), `${ts} ${msg}`])
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

function spawnNode(role: AgentRole, position?: CanvasNodePosition): AgentNode {
  const id = `agent-${++nodeSeq}-${Date.now().toString(36)}`
  const node: AgentNode = {
    id,
    spec: { id, name: `${ROLE_NAMES[role]}-${nodeSeq}`, role, model: 'claude-sonnet-4-20250514', awareness: 'briefed' },
    status: 'spawning',
    position: position ?? { x: 200 + Math.random() * 400, y: 150 + Math.random() * 300 },
    output: [],
    spawnedAt: new Date().toISOString(),
    sessionId: null,
  }
  const nodes = new Map(reg.get(nodesAtom))
  nodes.set(id, node)
  reg.set(nodesAtom, nodes)
  log(`⚡ SPAWN ${node.spec.name} [${role}]`)

  // Simulate boot
  setTimeout(() => { setNodeField(id, 'status', 'idle'); log(`✓ ${node.spec.name} ready`) }, 800 + Math.random() * 500)
  return node
}

function setNodeField<K extends keyof AgentNode>(id: string, key: K, value: AgentNode[K]) {
  const nodes = new Map(reg.get(nodesAtom))
  const n = nodes.get(id)
  if (!n) return
  nodes.set(id, { ...n, [key]: value })
  reg.set(nodesAtom, nodes)
}

function removeNode(id: string) {
  const nodes = new Map(reg.get(nodesAtom))
  const n = nodes.get(id)
  if (n) log(`✕ TERMINATED ${n.spec.name}`)
  nodes.delete(id)
  reg.set(nodesAtom, nodes)
  if (reg.get(activeNodeIdAtom) === id) reg.set(activeNodeIdAtom, null)
}

function sendPrompt(id: string, prompt: string) {
  const nodes = reg.get(nodesAtom)
  const n = nodes.get(id)
  if (!n) return
  setNodeField(id, 'status', 'working')
  log(`▸ PROMPT → ${n.spec.name}: "${prompt.slice(0, 60)}…"`)
  setTimeout(() => {
    const cur = reg.get(nodesAtom).get(id)
    if (!cur) return
    const updated = new Map(reg.get(nodesAtom))
    updated.set(id, { ...cur, status: 'complete', output: [...cur.output, `[${new Date().toLocaleTimeString()}] Done: ${prompt.slice(0, 40)}…`] })
    reg.set(nodesAtom, updated)
    log(`✓ ${n.spec.name} complete`)
  }, 2000 + Math.random() * 3000)
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
    await new Promise((r) => setTimeout(r, 1000))
    sendPrompt(node.id, step.prompt)
    await new Promise((r) => setTimeout(r, 3000 + Math.random() * 2000))
    reg.set(wfProgressAtom, { current: i + 1, total: wf.steps.length })
  }

  reg.set(wfStatusAtom, 'complete')
  log(`✓ WORKFLOW DONE: ${wf.name}`)
}

// =============================================================================
// AgentNodeCard — draggable + anime.js status FX
// =============================================================================

interface AgentNodeCardProps {
  node: AgentNode
  isSelected: boolean
  isActive: boolean
  onSelect: (id: string) => void
  onActivate: (id: string) => void
}

function AgentNodeCard({ node, isSelected, isActive, onSelect, onActivate }: AgentNodeCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: node.id })
  const cardRef = useRef<HTMLDivElement>(null)
  const prevStatusRef = useRef(node.status)

  const cfg = ROLE_CFG[node.spec.role]
  const RoleIcon = cfg.icon

  // Morph size based on active state
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      sendIslandEvent(node.id as any, {
        type: 'TRANSITION',
        sizeKey: isActive ? 'expanded' : 'compact',
        reticle: 'corners',
        complexity: isActive ? 'complex' : 'simple',
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [isActive, node.id])

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

  // anime.js: Spawn entrance — scaleIn with overshoot
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    animeAnimate(el, {
      scale: [0.6, 1],
      opacity: [0, 1],
      duration: 350,
      easing: 'easeOutBack',
    })
  }, [])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: node.position.x,
    top: node.position.y,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isActive ? 100 : isSelected ? 50 : 1,
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
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <MorphCard.Badge>{node.spec.role}</MorphCard.Badge>
          <MorphCard.Badge variant="info">{node.status}</MorphCard.Badge>
        </div>
        <div style={{ fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', color: '#666' }}>
          {node.spec.model.split('-').slice(-1)[0]}
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
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
          <MorphCard.Badge>{node.spec.role}</MorphCard.Badge>
          <MorphCard.Badge variant="info">{node.status}</MorphCard.Badge>
          <MorphCard.Badge variant="default">{node.spec.awareness}</MorphCard.Badge>
        </div>
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
        </MorphCard.Actions>
      </MorphCard.Footer>
    </MorphCard.Content>
  )

  return (
    <div
      ref={(el) => { setNodeRef(el); (cardRef as React.MutableRefObject<HTMLDivElement | null>).current = el }}
      style={style}
      {...listeners}
      {...attributes}
      data-selectable
      data-selectable-id={node.id}
      onClick={(e) => {
        e.stopPropagation()
        if (e.shiftKey) { selectItem(node.id, 'add') } else { onSelect(node.id); onActivate(node.id) }
      }}
    >
      <MorphCard
        cardId={node.id}
        initialSizeKey="compact"
        stateMachineConfig={{
          sizes: {
            compact: { width: 220, height: 120 },
            expanded: { width: 280, height: 200 },
            default: { width: 220, height: 120 },
          },
          reticle: 'corners',
        }}
        transitionStrategy={defaultTransitionStrategy}
        slots={rvnMorphCardSlots}
        theme={rvnMorphCardTheme}
        interactive={false}
        disableAnimations={false}
        dynamicSize={false}
        views={{
          compact: compactView,
          expanded: expandedView,
          default: compactView,
        }}
      >
        {null}
      </MorphCard>
    </div>
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

// =============================================================================
// Inspector Panel — right sidebar
// =============================================================================

function InspectorPanel() {
  const activeNode = useAtomValue(activeNodeAtom)
  const expanded = useAtomValue(inspectorExpandedAtom)

  if (!expanded) {
    return (
      <div style={{ width: 32, background: '#f4f4f4', borderLeft: '3px solid #000', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, flexShrink: 0 }}>
        <button onClick={() => reg.set(inspectorExpandedAtom, true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#000' }}>
          <Eye size={14} />
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 260, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ background: '#fff', borderLeft: '3px solid #000', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}
    >
      <div style={{ background: '#000', color: '#fff', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '3px solid #000' }}>
        <span style={{ fontFamily: 'var(--rvn-font-sans)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Inspector
        </span>
        <button onClick={() => reg.set(inspectorExpandedAtom, false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff' }}>
          <EyeOff size={12} />
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
        {activeNode ? <AgentInspector node={activeNode} /> : (
          <div style={{ color: '#999', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-sm, 14px)', textAlign: 'center', marginTop: 40 }}>
            Select an agent node
          </div>
        )}
      </div>
    </motion.div>
  )
}

function AgentInspector({ node }: { node: AgentNode }) {
  const [promptText, setPromptText] = useState('')
  const inspectorRef = useRef<HTMLDivElement>(null)

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

  return (
    <div ref={inspectorRef} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

      <div>
        <div style={{ fontFamily: 'var(--rvn-font-sans)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
          Send Prompt
        </div>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Enter a prompt…"
          style={{ width: '100%', height: 80, resize: 'vertical', border: '2px solid #000', padding: 8, fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', background: '#f4f4f4' }}
        />
        <button
          onClick={() => { if (promptText.trim()) { sendPrompt(node.id, promptText); setPromptText('') } }}
          disabled={!promptText.trim() || node.status === 'working'}
          style={{ width: '100%', marginTop: 4, padding: '6px 12px', background: node.status === 'working' ? '#ccc' : '#000', color: '#fff', border: '2px solid #000', fontFamily: 'var(--rvn-font-sans)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700, textTransform: 'uppercase', cursor: node.status === 'working' ? 'not-allowed' : 'pointer', letterSpacing: '0.05em' }}
        >
          {node.status === 'working' ? 'Working…' : 'Send'}
        </button>
      </div>

      {node.output.length > 0 && (
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

  return (
    <div style={{ height: 32, background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', borderBottom: '3px solid #000', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Link to="/" style={{ color: '#06b6d4', textDecoration: 'none' }}>← HOME</Link>
        <span style={{ fontWeight: 700, letterSpacing: '0.1em' }}>CONDUCTOR</span>
        <span style={{ color: '#666' }}>|</span>
        <span>AGENTS: {agentCount}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
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
        for (const [id] of reg.get(nodesAtom)) removeNode(id)
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
  const logLines = useAtomValue(logAtom)
  const logEndRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // anime.js: slide open
  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    animeAnimate(el, { height: expanded ? 200 : 28, duration: 200, easing: 'easeOutQuad' })
  }, [expanded])

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logLines])

  return (
    <div ref={panelRef} style={{ height: 28, background: '#000', borderTop: '3px solid #000', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
      <button
        onClick={() => reg.set(terminalExpandedAtom, !expanded)}
        style={{ height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: '#111', border: 'none', borderBottom: expanded ? '1px solid #333' : 'none', color: '#fff', cursor: 'pointer', fontFamily: 'var(--rvn-font-mono)', fontSize: 'var(--tmnl-text-xs, 12px)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, width: '100%', textAlign: 'left' }}
      >
        <Terminal size={12} style={{ color: '#06b6d4' }} />
        <span>{activeNode ? `TERMINAL — ${activeNode.spec.name}` : 'OPERATION LOG'}</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        <span style={{ marginLeft: 'auto', color: '#666' }}>{logLines.length}</span>
      </button>
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
  const containerRef = useRef<HTMLDivElement>(null!)
  const layoutRootRef = useRef<HTMLDivElement>(null)
  const layoutRef = useRef<ReturnType<typeof createLayout> | null>(null)
  const scopeRef = useRef<ReturnType<typeof createScope> | null>(null)
  const prevNodeCountRef = useRef(0)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // Subscribe to selection changes
  useEffect(() => subscribeToSelection((ids) => {
    setSelectedIds(ids)
    if (ids.size === 1) {
      const [first] = ids
      reg.set(activeNodeIdAtom, first)
    } else if (ids.size === 0) {
      reg.set(activeNodeIdAtom, null)
    }
  }), [])

  // anime.js Scope — auto-cleanup for all canvas animations
  useEffect(() => {
    const scope = createScope({ root: containerRef.current ?? document })
    scopeRef.current = scope
    return () => { scope.revert(); scopeRef.current = null }
  }, [])

  // anime.js Layout — auto-animate node enter/leave transitions
  useLayoutEffect(() => {
    const root = layoutRootRef.current
    if (!root) return

    const layout = createLayout(root, {
      ease: spring({ bounce: 0.3, duration: 500 }),
      enterFrom: {
        opacity: 0,
        transform: 'scale(0.7)',
        filter: 'blur(8px)',
      },
      leaveTo: {
        opacity: 0,
        transform: 'scale(0.5)',
        filter: 'blur(12px)',
      },
    })

    layoutRef.current = layout
    return () => { layout.revert(); layoutRef.current = null }
  }, [])

  // Trigger layout animation when nodes change
  useLayoutEffect(() => {
    if (!layoutRef.current) return
    const currentCount = nodes.length
    if (currentCount !== prevNodeCountRef.current) {
      layoutRef.current.record()
      // DOM has already changed via React re-render
      prevNodeCountRef.current = currentCount
    }
  })

  // Animate after record
  useEffect(() => {
    layoutRef.current?.animate()
  }, [nodes.length])

  // dnd-kit
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event
    const id = active.id as string
    const vp = reg.get(viewportAtom)
    const n = reg.get(nodesAtom).get(id)
    if (!n) return
    setNodeField(id, 'position', { x: n.position.x + delta.x / vp.zoom, y: n.position.y + delta.y / vp.zoom })
  }, [])

  // Pan (middle mouse)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) { e.preventDefault(); isPanning.current = true; panStart.current = { x: e.clientX, y: e.clientY } }
  }, [])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    const vp = reg.get(viewportAtom)
    reg.set(viewportAtom, { ...vp, panX: vp.panX + (e.clientX - panStart.current.x), panY: vp.panY + (e.clientY - panStart.current.y) })
    panStart.current = { x: e.clientX, y: e.clientY }
  }, [])
  const handleMouseUp = useCallback(() => { isPanning.current = false }, [])

  // Zoom (wheel)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const vp = reg.get(viewportAtom)
    reg.set(viewportAtom, { ...vp, zoom: Math.max(0.25, Math.min(3, vp.zoom - e.deltaY * 0.001)) })
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
        {Math.round(viewport.zoom * 100)}%
      </div>

      {/* Canvas transform + dnd-kit + layout root */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <MorphCardRegistryProvider>
          <div
            ref={layoutRootRef}
            style={{ position: 'absolute', left: viewport.panX, top: viewport.panY, transform: `scale(${viewport.zoom})`, transformOrigin: '0 0' }}
          >
            {nodes.map((node) => (
              <AgentNodeCard
                key={node.id}
                node={node}
                isSelected={selectedIds.has(node.id)}
                isActive={activeNodeId === node.id}
                onSelect={(id) => selectItem(id, 'replace')}
                onActivate={(id) => reg.set(activeNodeIdAtom, id)}
              />
            ))}
          </div>
        </MorphCardRegistryProvider>
      </DndContext>

      {/* Selection overlay */}
      <SelectionOverlay
        containerRef={containerRef as React.RefObject<HTMLElement>}
        selectableSelector="[data-selectable]"
        onDelete={(ids) => { for (const id of ids) removeNode(id) }}
      />

      {/* Context menu */}
      <AnimatePresence>
        {ctxMenu && (
          <CanvasContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            selectedCount={selectedIds.size}
            selectedIds={selectedIds}
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

function CanvasContextMenu({ x, y, selectedCount, selectedIds, containerRef, onClose }: {
  x: number; y: number; selectedCount: number; selectedIds: Set<string>
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

      {selectedCount > 0 && (<>
        <CtxLabel>Selection ({selectedCount})</CtxLabel>
        <CtxItem onClick={() => { for (const id of selectedIds) sendPrompt(id, 'Analyze and report'); onClose() }}>
          <Zap size={12} style={{ color: '#06b6d4' }} />PROMPT ALL
        </CtxItem>
        <CtxItem destructive onClick={() => { for (const id of selectedIds) removeNode(id); deselectAll(); onClose() }}>
          <Trash2 size={12} />KILL SELECTED
        </CtxItem>
        <div style={{ height: 1, background: '#333', margin: '4px 0' }} />
      </>)}

      <CtxItem onClick={() => { reg.set(viewportAtom, { panX: 0, panY: 0, zoom: 1 }); onClose() }}>
        <Maximize2 size={12} style={{ color: '#666' }} />RESET VIEW
      </CtxItem>
      <CtxItem onClick={() => { deselectAll(); onClose() }}>
        <Square size={12} style={{ color: '#666' }} />DESELECT ALL
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
        <InspectorPanel />
      </div>
      <TerminalPanel />
    </div>
  )
}

export function ConductorTestbed() {
  return (
    <RegistryContext.Provider value={reg as any}>
      <ConductorTestbedInner />
    </RegistryContext.Provider>
  )
}
