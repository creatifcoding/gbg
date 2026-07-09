/**
 * NodeDetail — right DIIKW panel.
 *
 * The sidebar turns raw RCA graph/evidence/questionnaire/model rows into the
 * Data → Information → Intelligence → Knowledge → Wisdom ladder. No raw JSON
 * dumps: each layer exposes summaries, facts, interpretations, and actions.
 */
import { type ReactNode, useMemo, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import {
  useAtomValue,
  useAtom,
  selectedSessionIdAtom,
  selectedNodeIdAtom,
  detailPanelModeAtom,
  type DetailPanelMode,
} from '../lib/atoms.ts'
import {
  useGraphQuery,
  useEvidenceQuery,
  useQuestionnairesQuery,
  useModelViewsQuery,
} from '../lib/query.ts'
import type { RcaNode, Evidence, Questionnaire, ModelView, GraphData } from '../lib/schema.ts'

type JsonRecord = Record<string, unknown>
type KeyValue = readonly [string, string]

type SidebarData = {
  readonly graph: GraphData | undefined
  readonly selectedNode: RcaNode | null
  readonly evidence: readonly Evidence[]
  readonly questionnaires: readonly Questionnaire[]
  readonly modelViews: readonly ModelView[]
}

const TABS: { key: DetailPanelMode; label: string; title: string }[] = [
  { key: 'data', label: 'data', title: 'Raw records, cleaned' },
  { key: 'information', label: 'info', title: 'Context and relationships' },
  { key: 'intelligence', label: 'intel', title: 'Interpreted signals' },
  { key: 'knowledge', label: 'know', title: 'Learned model and answers' },
  { key: 'wisdom', label: 'act', title: 'Recommended next moves' },
]

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseMaybeJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return text
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return text
  }
}

function scalarText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return null
}

function compactText(value: unknown, limit = 120): string {
  const scalar = scalarText(value)
  if (scalar !== null) return scalar.length > limit ? `${scalar.slice(0, limit - 1)}…` : scalar
  if (Array.isArray(value)) return `${value.length} items`
  if (isRecord(value)) return `${Object.keys(value).length} fields`
  return String(value)
}

function keyTitle(key: string): string {
  return key.replace(/[_-]/g, ' ')
}

function pairsFromRecord(value: unknown, limit = 8): KeyValue[] {
  if (!isRecord(value)) return []
  return Object.entries(value)
    .filter(([, entry]) => scalarText(entry) !== null)
    .slice(0, limit)
    .map(([key, entry]) => [keyTitle(key), compactText(entry, 80)] as const)
}

function formatTs(ts: string): string {
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? ts : date.toLocaleString('en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function asEvidencePayload(item: Evidence): unknown {
  return parseMaybeJson(item.content)
}

function evidenceSummary(item: Evidence): string {
  const payload = asEvidencePayload(item)
  if (typeof payload === 'string') return compactText(payload, 180)
  if (isRecord(payload)) {
    const summary = scalarText(payload.summary) ?? scalarText(payload.reason) ?? scalarText(payload.status)
    if (summary) return compactText(summary, 180)
    const pairs = pairsFromRecord(payload, 4)
    if (pairs.length > 0) return pairs.map(([key, value]) => `${key}: ${value}`).join(' · ')
  }
  return compactText(payload, 180)
}

function modelSummary(view: ModelView): string {
  if (isRecord(view.view_data)) {
    const summary = scalarText(view.view_data.summary) ?? scalarText(view.view_data.reason) ?? scalarText(view.view_data.status)
    if (summary) return compactText(summary, 180)
    const pairs = pairsFromRecord(view.view_data, 4)
    if (pairs.length > 0) return pairs.map(([key, value]) => `${key}: ${value}`).join(' · ')
  }
  return compactText(view.view_data, 180)
}

function directEdges(graph: GraphData | undefined, nodeId: string | null) {
  if (!graph || !nodeId) return []
  return graph.edges.filter((edge) => edge.source_id === nodeId || edge.target_id === nodeId)
}

function relatedNodes(graph: GraphData | undefined, nodeId: string | null): RcaNode[] {
  if (!graph || !nodeId) return []
  const edges = directEdges(graph, nodeId)
  const ids = new Set(edges.map((edge) => edge.source_id === nodeId ? edge.target_id : edge.source_id))
  return graph.nodes.filter((node) => ids.has(node.id))
}

function countByKind(graph: GraphData | undefined): KeyValue[] {
  if (!graph) return []
  const counts: Record<string, number> = {}
  for (const node of graph.nodes) counts[node.node_type] = (counts[node.node_type] ?? 0) + 1
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, count]) => [kind, String(count)] as const)
}

function EvidenceCard({ item }: { item: Evidence }) {
  return (
    <article className="gbm-card">
      <div className="gbm-card__kicker">{item.kind}</div>
      <div className="gbm-card__body">{evidenceSummary(item)}</div>
      <div className="gbm-card__meta">{item.source ? `${item.source} · ` : ''}{formatTs(item.timestamp)}</div>
    </article>
  )
}

function PairGrid({ pairs }: { pairs: readonly KeyValue[] }) {
  if (pairs.length === 0) return <div className="gbm-empty">no structured fields</div>
  return (
    <div className="gbm-pair-grid">
      {pairs.map(([key, value]) => (
        <div className="gbm-pair" key={key}>
          <span className="gbm-pair__key">{key}</span>
          <span className="gbm-pair__value">{value}</span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="gbm-dikw-section">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function TabBar() {
  const [mode, setMode] = useAtom(detailPanelModeAtom)
  return (
    <div className="gbm-detail__tabs" role="tablist" aria-label="DIIKW sidebar layers">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={mode === tab.key}
          className={`gbm-tab ${mode === tab.key ? 'gbm-tab--active' : ''}`}
          onClick={() => setMode(tab.key)}
          title={tab.title}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function EmptySelection() {
  return (
    <div className="gbm-empty gbm-empty--callout">
      select a graph node to climb the DIIKW ladder for one finding
    </div>
  )
}

function DataPanel({ selectedNode, evidence, questionnaires, modelViews, graph }: SidebarData) {
  const nodePairs: KeyValue[] = selectedNode
    ? [
        ['id', selectedNode.id],
        ['type', selectedNode.node_type],
        ['severity', selectedNode.severity === null ? 'unscored' : String(selectedNode.severity)],
        ['created', formatTs(selectedNode.created_at)],
      ]
    : []
  const metricPairs = pairsFromRecord(selectedNode?.metrics, 10)

  return (
    <div className="gbm-dikw">
      <div className="gbm-dikw__lede">Cleaned source records. Still close to the database, but readable.</div>
      <Section title="record counts">
        <PairGrid pairs={[
          ['nodes', String(graph?.nodes.length ?? 0)],
          ['edges', String(graph?.edges.length ?? 0)],
          ['evidence rows', String(evidence.length)],
          ['questions', String(questionnaires.length)],
          ['model views', String(modelViews.length)],
        ]} />
      </Section>
      {selectedNode ? (
        <>
          <Section title="selected node record"><PairGrid pairs={nodePairs} /></Section>
          <Section title="selected node metrics"><PairGrid pairs={metricPairs} /></Section>
        </>
      ) : <EmptySelection />}
    </div>
  )
}

function InformationPanel({ selectedNode, graph, evidence }: SidebarData) {
  const edges = directEdges(graph, selectedNode?.id ?? null)
  const neighbours = relatedNodes(graph, selectedNode?.id ?? null).slice(0, 8)
  return (
    <div className="gbm-dikw">
      <div className="gbm-dikw__lede">Information adds context: what this is, where it sits, and what touches it.</div>
      {selectedNode ? (
        <>
          <Section title="finding">
            <div className="gbm-finding-title">{selectedNode.label}</div>
            <PairGrid pairs={[
              ['type', selectedNode.node_type],
              ['confidence / severity', selectedNode.severity === null ? 'unscored' : String(selectedNode.severity)],
              ['relationships', String(edges.length)],
              ['session evidence', String(evidence.length)],
            ]} />
          </Section>
          <Section title="neighbourhood">
            {neighbours.length === 0 ? <div className="gbm-empty">no adjacent nodes</div> : neighbours.map((node) => (
              <div className="gbm-list-row" key={node.id}>
                <span>{node.label}</span>
                <em>{node.node_type}</em>
              </div>
            ))}
          </Section>
        </>
      ) : <EmptySelection />}
      <Section title="graph composition"><PairGrid pairs={countByKind(graph)} /></Section>
    </div>
  )
}

function IntelligencePanel({ selectedNode, graph, evidence }: SidebarData) {
  const direct = evidence.filter((item) => item.node_id === selectedNode?.id)
  const fallbackEvidence = direct.length > 0 ? direct : evidence.slice(0, 5)
  const highSignalNodes = graph?.nodes.filter((node) =>
    ['root_cause', 'hypothesis', 'hazard', 'loss', 'bottleneck', 'anomaly'].includes(node.node_type),
  ).slice(0, 6) ?? []

  return (
    <div className="gbm-dikw">
      <div className="gbm-dikw__lede">Intelligence interprets signals into hypotheses, pressure points, and confidence.</div>
      {selectedNode ? (
        <Section title="current interpretation">
          <div className="gbm-intel-callout">
            <strong>{selectedNode.node_type}</strong>
            <span>{selectedNode.label}</span>
            <em>{selectedNode.severity === null ? 'confidence unknown' : `confidence ${selectedNode.severity}`}</em>
          </div>
        </Section>
      ) : <EmptySelection />}
      <Section title={direct.length > 0 ? 'linked evidence' : 'session evidence fallback'}>
        {fallbackEvidence.length === 0 ? <div className="gbm-empty">no evidence rows yet</div> : fallbackEvidence.map((item) => (
          <EvidenceCard key={item.id} item={item} />
        ))}
      </Section>
      <Section title="high-signal nodes">
        {highSignalNodes.length === 0 ? <div className="gbm-empty">no hypotheses or hazards yet</div> : highSignalNodes.map((node) => (
          <div className="gbm-list-row" key={node.id}>
            <span>{node.label}</span>
            <em>{node.node_type}</em>
          </div>
        ))}
      </Section>
    </div>
  )
}

function KnowledgePanel({ questionnaires, modelViews }: SidebarData) {
  const answered = questionnaires.filter((item) => item.answer)
  return (
    <div className="gbm-dikw">
      <div className="gbm-dikw__lede">Knowledge is retained learning: answers, model views, and reusable causal structure.</div>
      <Section title="answered questions">
        {answered.length === 0 ? <div className="gbm-empty">no answered questions yet</div> : answered.slice(0, 8).map((item) => (
          <article className="gbm-card" key={item.id}>
            <div className="gbm-card__kicker">{item.category ?? 'question'}</div>
            <div className="gbm-card__body">{item.question}</div>
            <div className="gbm-card__answer">{compactText(parseMaybeJson(item.answer ?? ''), 180)}</div>
          </article>
        ))}
      </Section>
      <Section title="model views">
        {modelViews.length === 0 ? <div className="gbm-empty">no model views yet</div> : modelViews.map((view) => (
          <article className="gbm-card" key={view.id}>
            <div className="gbm-card__kicker">{view.model}</div>
            <div className="gbm-card__body">{modelSummary(view)}</div>
            <div className="gbm-card__meta">{formatTs(view.created_at)}</div>
          </article>
        ))}
      </Section>
    </div>
  )
}

function WisdomPanel({ graph, questionnaires, evidence }: SidebarData) {
  const actionNodes = graph?.nodes.filter((node) =>
    ['probe', 'script', 'agent_decision'].includes(node.node_type) || /probe|test|check|install|run|measure|cool|charge/i.test(node.label),
  ).slice(0, 8) ?? []
  const unanswered = questionnaires.filter((item) => !item.answer).slice(0, 4)
  const recentEvidence = evidence.slice(0, 3)

  return (
    <div className="gbm-dikw">
      <div className="gbm-dikw__lede">Wisdom is the action layer: what to do next, what to avoid, and what would change the diagnosis.</div>
      <Section title="next best actions">
        {actionNodes.length === 0 ? <div className="gbm-empty">no action nodes yet</div> : actionNodes.map((node) => (
          <div className="gbm-action" key={node.id}>
            <span>{node.label}</span>
            <em>{node.node_type}</em>
          </div>
        ))}
      </Section>
      <Section title="questions blocking certainty">
        {unanswered.length === 0 ? <div className="gbm-empty">no unanswered questions</div> : unanswered.map((item) => (
          <div className="gbm-list-row" key={item.id}>
            <span>{item.question}</span>
            <em>{item.category ?? 'question'}</em>
          </div>
        ))}
      </Section>
      <Section title="freshest signals to re-check">
        {recentEvidence.length === 0 ? <div className="gbm-empty">no evidence yet</div> : recentEvidence.map((item) => (
          <EvidenceCard key={item.id} item={item} />
        ))}
      </Section>
    </div>
  )
}

export function NodeDetail() {
  const sessionId = useAtomValue(selectedSessionIdAtom)
  const selectedNodeId = useAtomValue(selectedNodeIdAtom)
  const mode = useAtomValue(detailPanelModeAtom)
  const bodyRef = useRef<HTMLDivElement>(null)

  const { data: graph } = useGraphQuery(sessionId)
  const { data: evidence = [] } = useEvidenceQuery(sessionId)
  const { data: questionnaires = [] } = useQuestionnairesQuery(sessionId)
  const { data: modelViews = [] } = useModelViewsQuery(sessionId)

  const selectedNode = useMemo(
    () => selectedNodeId && graph ? graph.nodes.find((node) => node.id === selectedNodeId) ?? null : null,
    [graph, selectedNodeId],
  )

  const data: SidebarData = { graph, selectedNode, evidence, questionnaires, modelViews }

  useGSAP(
    () => {
      if (!bodyRef.current) return
      gsap.fromTo(
        bodyRef.current,
        { opacity: 0, y: 4 },
        { opacity: 1, y: 0, duration: 0.18, ease: 'power1.out' },
      )
    },
    { scope: bodyRef, dependencies: [mode, selectedNodeId] },
  )

  return (
    <aside className="gbm-detail">
      <TabBar />
      <div className="gbm-detail__body" ref={bodyRef} role="tabpanel">
        {!sessionId ? (
          <div className="gbm-empty gbm-empty--callout">select a session to inspect data → wisdom</div>
        ) : mode === 'data' ? (
          <DataPanel {...data} />
        ) : mode === 'information' ? (
          <InformationPanel {...data} />
        ) : mode === 'intelligence' ? (
          <IntelligencePanel {...data} />
        ) : mode === 'knowledge' ? (
          <KnowledgePanel {...data} />
        ) : (
          <WisdomPanel {...data} />
        )}
      </div>
    </aside>
  )
}
