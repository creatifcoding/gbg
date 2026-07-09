/**
 * Raw API fetch helpers.
 *
 * Backend exposes the SQLite RCA schema directly. These helpers normalize that
 * shape into the UI contract, then validate through Effect Schema at the fetch
 * boundary.
 */
import {
  decodeSessionList,
  decodeGraphData,
  decodeEvidenceList,
  decodeQuestionnaireList,
  decodeModelViewList,
  decodeWorkflowRun,
  decodeWorkflowRunList,
  type SessionList,
  type GraphData,
  type EvidenceList,
  type QuestionnaireList,
  type ModelViewList,
  type WorkflowEvent,
  type WorkflowRun,
  type WorkflowRunList,
} from './schema.ts'

const API = '/api'

type JsonRecord = Record<string, unknown>

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(`${API}${path}`)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${path}`)
  }
  return res.json()
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function rowsOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (isRecord(raw) && Array.isArray(raw.rows)) return raw.rows
  return []
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function jsonText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)
}

function workflowRowsOf(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw
  if (isRecord(raw) && Array.isArray(raw.runs)) return raw.runs
  if (isRecord(raw) && Array.isArray(raw.rows)) return raw.rows
  return []
}

function timestampText(value: unknown): string {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1_000_000_000_000 ? value : value * 1000
    return new Date(millis).toISOString()
  }
  return new Date().toISOString()
}

async function fetchWorkflowJson(path: string): Promise<unknown> {
  const res = await fetch(`${WORKFLOW_API}${path}`)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} — ${path}`)
  }
  return res.json()
}

export async function fetchSessions(): Promise<SessionList> {
  const raw = await fetchJson('/sessions')
  const normalized = rowsOf(raw).filter(isRecord).map((session) => {
    const id = text(session.session_id, text(session.id, 'unknown-session'))
    return {
      id,
      name: text(session.summary, id),
      status: text(session.status, 'open'),
      created_at: text(session.created_at, new Date(0).toISOString()),
      updated_at: text(session.updated_at, text(session.created_at, new Date(0).toISOString())),
      metadata: session,
    }
  })
  return decodeSessionList(normalized)
}

export async function fetchGraph(sessionId: string): Promise<GraphData> {
  const raw = await fetchJson(`/sessions/${encodeURIComponent(sessionId)}/graph`)
  const rawNodes = isRecord(raw) && Array.isArray(raw.nodes) ? raw.nodes : []
  const rawEdges = isRecord(raw) && Array.isArray(raw.edges) ? raw.edges : []
  const nodes = rawNodes.filter(isRecord).map((node) => ({
    id: text(node.id, 'unknown-node'),
    session_id: text(node.session_id, sessionId),
    label: text(node.label, text(node.id, 'unknown-node')),
    node_type: text(node.kind, text(node.node_type, 'probe')),
    metrics: isRecord(node.data) ? node.data : node,
    position_x: numberOrNull(node.position_x),
    position_y: numberOrNull(node.position_y),
    severity: numberOrNull(node.severity) ?? numberOrNull(node.confidence),
    created_at: text(node.created_at, new Date(0).toISOString()),
  }))
  const edges = rawEdges.filter(isRecord).map((edge) => ({
    id: String(edge.id ?? `${edge.src ?? edge.source}->${edge.dst ?? edge.target}`),
    session_id: text(edge.session_id, sessionId),
    source_id: text(edge.source_id, text(edge.src, text(edge.source, ''))),
    target_id: text(edge.target_id, text(edge.dst, text(edge.target, ''))),
    weight: numberOrNull(edge.weight) ?? numberOrNull(edge.confidence),
    label: text(edge.label, text(edge.kind, '')),
    edge_type: text(edge.edge_type, text(edge.kind, '')),
  }))
  return decodeGraphData({ nodes, edges })
}

export async function fetchEvidence(sessionId: string): Promise<EvidenceList> {
  const raw = await fetchJson(`/sessions/${encodeURIComponent(sessionId)}/evidence`)
  const normalized = rowsOf(raw).filter(isRecord).map((item) => ({
    id: text(item.id, 'unknown-evidence'),
    session_id: text(item.session_id, sessionId),
    node_id: isRecord(item.payload) && typeof item.payload.node_id === 'string' ? item.payload.node_id : null,
    kind: text(item.kind, 'annotation'),
    content: text(item.content, text(item.summary, jsonText(item.payload))),
    source: text(item.source, ''),
    timestamp: text(item.timestamp, text(item.created_at, new Date(0).toISOString())),
  }))
  return decodeEvidenceList(normalized)
}

export async function fetchQuestionnaires(sessionId: string): Promise<QuestionnaireList> {
  const raw = await fetchJson(`/sessions/${encodeURIComponent(sessionId)}/questionnaires`)
  const normalized = rowsOf(raw).filter(isRecord).map((item) => ({
    id: text(item.id, 'unknown-questionnaire'),
    session_id: text(item.session_id, sessionId),
    question: text(item.question, 'question'),
    answer: item.answer === undefined || item.answer === null ? null : jsonText(item.answer),
    category: item.sequence === undefined ? null : `Q${String(item.sequence).padStart(3, '0')}`,
    timestamp: text(item.timestamp, text(item.created_at, new Date(0).toISOString())),
  }))
  return decodeQuestionnaireList(normalized)
}

export async function fetchModelViews(sessionId: string): Promise<ModelViewList> {
  const raw = await fetchJson(`/sessions/${encodeURIComponent(sessionId)}/model_views`)
  const normalized = rowsOf(raw).filter(isRecord).map((item) => ({
    id: text(item.id, 'unknown-model'),
    session_id: text(item.session_id, sessionId),
    model: text(item.model, text(item.method, 'model')),
    view_data: item.view_data ?? item.content ?? item,
    created_at: text(item.created_at, new Date(0).toISOString()),
  }))
  return decodeModelViewList(normalized)
}

// ── Workflow harness — AG-UI-compatible fetch / stream helpers ──────────────

/**
 * Normalise a raw server payload into a WorkflowEvent.
 * The backend may omit `id` or `timestamp`; we synthesise safe defaults.
 */
function normalizeWorkflowEvent(raw: unknown, runId: string): WorkflowEvent {
  if (!isRecord(raw)) {
    return {
      id: crypto.randomUUID(),
      run_id: runId,
      type: 'TEXT_MESSAGE_CONTENT',
      timestamp: new Date().toISOString(),
      payload: raw === undefined ? null : (raw as unknown),
    }
  }
  return {
    id: String(raw.id ?? crypto.randomUUID()),
    run_id: text(raw.run_id, runId),
    type: text(raw.type, 'TEXT_MESSAGE_CONTENT'),
    timestamp: timestampText(raw.timestamp),
    payload: raw.payload !== undefined ? (raw.payload as unknown) : null,
  }
}

/**
 * Normalise a raw server record into the WorkflowRun shape expected by
 * decodeWorkflowRun.  Tolerates missing / renamed fields.
 */
function normalizeWorkflowRun(raw: unknown, fallbackSessionId: string): WorkflowRun {
  if (!isRecord(raw)) throw new Error('WorkflowRun: expected object')
  const runId = text(raw.id, crypto.randomUUID())
  const events = Array.isArray(raw.events)
    ? (raw.events as unknown[]).map((e) => normalizeWorkflowEvent(e, runId))
    : []
  return decodeWorkflowRun({
    id: runId,
    session_id: raw.session_id != null ? String(raw.session_id) : (fallbackSessionId || null),
    prompt: text(raw.prompt, ''),
    workflow: text(raw.workflow, 'default'),
    status: text(raw.status, 'idle'),
    created_at: text(raw.created_at, new Date().toISOString()),
    finished_at: raw.finished_at != null ? String(raw.finished_at) : null,
    error: raw.error != null ? String(raw.error) : null,
    result: raw.result !== undefined ? raw.result : null,
    mastra_run_id: raw.mastra_run_id != null ? String(raw.mastra_run_id) : null,
    events,
  })
}

/**
 * Submit a new workflow run. The response is the created WorkflowRun record.
 * Status may be `running`, `completed`, `error`, or `disabled` depending on
 * Mastra configuration and remote response.
 *
 * Remote hook: override `VITE_WORKFLOW_API` to point at an external
 * Mastra / CopilotKit-compatible API root.
 */
const WORKFLOW_API = ((import.meta.env.VITE_WORKFLOW_API as string | undefined) ?? API).replace(/\/$/, '')

export async function submitWorkflowRun(
  sessionId: string,
  prompt: string,
): Promise<WorkflowRun> {
  const res = await fetch(`${WORKFLOW_API}/workflow/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, prompt }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return normalizeWorkflowRun(await res.json() as unknown, sessionId)
}

/**
 * GET /api/sessions/:id/workflow/runs
 * List all workflow runs for a session (no events inline).
 */
export async function fetchWorkflowRuns(sessionId: string): Promise<WorkflowRunList> {
  const raw = await fetchWorkflowJson(`/sessions/${encodeURIComponent(sessionId)}/workflow/runs`)
  return decodeWorkflowRunList(
    workflowRowsOf(raw).map((r) => normalizeWorkflowRun(r, sessionId)),
  )
}

/**
 * GET /api/workflow/runs/:runId
 * Fetch a single run with its full events array (for history replay).
 */
export async function fetchWorkflowRun(runId: string): Promise<WorkflowRun> {
  const raw = await fetchWorkflowJson(`/workflow/runs/${encodeURIComponent(runId)}`)
  return normalizeWorkflowRun(raw, '')
}

/**
 * SSE stream for live workflow events.
 * Endpoint: GET /api/workflow/runs/:runId/events/stream
 *
 * Returns a teardown function.  Pass an AbortSignal for external
 * cancellation (e.g. from an AbortController shared with handleSubmit).
 * Malformed SSE frames are silently dropped.
 */
export function streamWorkflowEvents(
  runId: string,
  onEvent: (event: WorkflowEvent) => void,
  signal?: AbortSignal,
): () => void {
  const url = `${WORKFLOW_API}/workflow/runs/${encodeURIComponent(runId)}/events/stream`
  const es = new EventSource(url)

  es.onmessage = (msg: MessageEvent<string>) => {
    try {
      const parsed: unknown = JSON.parse(msg.data)
      // Backend emits {"type":"DONE"} as a terminal sentinel — close silently
      if (isRecord(parsed) && parsed.type === 'DONE') {
        es.close()
        return
      }
      onEvent(normalizeWorkflowEvent(parsed, runId))
    } catch {
      // skip malformed SSE frames
    }
  }

  const close = () => es.close()
  if (signal) signal.addEventListener('abort', close, { once: true })
  return close
}
