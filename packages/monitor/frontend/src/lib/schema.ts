/**
 * Effect Schema definitions for all RCA API response types.
 * Every external boundary (fetch responses) is decoded through these schemas.
 */
import { Schema } from 'effect'

// ── Primitives ─────────────────────────────────────────────────────────────

export const NullableString = Schema.NullOr(Schema.String)
export const NullableNumber = Schema.NullOr(Schema.Number)

// ── Sessions ───────────────────────────────────────────────────────────────

export const SessionStatus = Schema.Literals(['open', 'closed', 'error', 'running'])
export type SessionStatus = Schema.Schema.Type<typeof SessionStatus>

export const Session = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  status: Schema.Union([SessionStatus, Schema.String]),
  created_at: Schema.String,
  updated_at: NullableString,
  metadata: Schema.NullOr(Schema.Unknown),
})
export type Session = Schema.Schema.Type<typeof Session>

export const SessionList = Schema.Array(Session)
export type SessionList = Schema.Schema.Type<typeof SessionList>

// ── Graph Nodes ────────────────────────────────────────────────────────────

export const NodeKind = Schema.Literals([
  'anomaly',
  'bottleneck',
  'root_cause',
  'symptom',
  'normal',
  'probe',
  'script',
  'agent_decision',
  'incident',
])
export type NodeKind = Schema.Schema.Type<typeof NodeKind>

export const RcaNode = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  label: Schema.String,
  node_type: Schema.Union([NodeKind, Schema.String]),
  metrics: Schema.NullOr(Schema.Unknown),
  position_x: NullableNumber,
  position_y: NullableNumber,
  severity: NullableNumber,
  created_at: Schema.String,
})
export type RcaNode = Schema.Schema.Type<typeof RcaNode>

export const RcaNodeList = Schema.Array(RcaNode)
export type RcaNodeList = Schema.Schema.Type<typeof RcaNodeList>

// ── Graph Edges ────────────────────────────────────────────────────────────

export const RcaEdge = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  source_id: Schema.String,
  target_id: Schema.String,
  weight: NullableNumber,
  label: NullableString,
  edge_type: NullableString,
})
export type RcaEdge = Schema.Schema.Type<typeof RcaEdge>

export const RcaEdgeList = Schema.Array(RcaEdge)
export type RcaEdgeList = Schema.Schema.Type<typeof RcaEdgeList>

// ── Combined graph payload (nodes + edges in one call) ─────────────────────

export const GraphData = Schema.Struct({
  nodes: RcaNodeList,
  edges: RcaEdgeList,
})
export type GraphData = Schema.Schema.Type<typeof GraphData>

// ── Evidence ───────────────────────────────────────────────────────────────

export const EvidenceKind = Schema.Literals([
  'probe_output',
  'log',
  'metric',
  'screenshot',
  'annotation',
  'agent_note',
])
export type EvidenceKind = Schema.Schema.Type<typeof EvidenceKind>

export const Evidence = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  node_id: NullableString,
  kind: Schema.Union([EvidenceKind, Schema.String]),
  content: Schema.String,
  source: NullableString,
  timestamp: Schema.String,
})
export type Evidence = Schema.Schema.Type<typeof Evidence>

export const EvidenceList = Schema.Array(Evidence)
export type EvidenceList = Schema.Schema.Type<typeof EvidenceList>

// ── Questionnaires ─────────────────────────────────────────────────────────

export const Questionnaire = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  question: Schema.String,
  answer: NullableString,
  category: NullableString,
  timestamp: Schema.String,
})
export type Questionnaire = Schema.Schema.Type<typeof Questionnaire>

export const QuestionnaireList = Schema.Array(Questionnaire)
export type QuestionnaireList = Schema.Schema.Type<typeof QuestionnaireList>

// ── Model views ────────────────────────────────────────────────────────────

export const ModelView = Schema.Struct({
  id: Schema.String,
  session_id: Schema.String,
  model: Schema.String,
  view_data: Schema.Unknown,
  created_at: Schema.String,
})
export type ModelView = Schema.Schema.Type<typeof ModelView>

export const ModelViewList = Schema.Array(ModelView)
export type ModelViewList = Schema.Schema.Type<typeof ModelViewList>

// ── Decode helpers ─────────────────────────────────────────────────────────

export const decodeSessionList = Schema.decodeUnknownSync(SessionList)
export const decodeGraphData = Schema.decodeUnknownSync(GraphData)
export const decodeEvidenceList = Schema.decodeUnknownSync(EvidenceList)
export const decodeQuestionnaireList = Schema.decodeUnknownSync(QuestionnaireList)
export const decodeModelViewList = Schema.decodeUnknownSync(ModelViewList)

// ── Workflow Harness — AG-UI-compatible lifecycle types ────────────────────
//
// @ag-ui/client and @copilotkit/* are NOT present in this package's
// package.json.  These are local structural equivalents that mirror the
// AG-UI wire format exactly; the backend SSE contract is designed to be
// drop-in compatible, so a future `npm add @ag-ui/client` would allow
// replacing these types and the SSE helper with the upstream package.
//
// Dependency ask: @ag-ui/client >=0.0.1  OR  @copilotkit/runtime-client-gql

export const WorkflowRunStatus = Schema.Literals([
  'idle',
  'running',
  'success',
  'completed',  // Mastra native terminal status (maps to 'success' in display)
  'error',
  'cancelled',
  'disabled',   // backend returns when MASTRA_URL is unset
])
export type WorkflowRunStatus = Schema.Schema.Type<typeof WorkflowRunStatus>

/**
 * AG-UI standard event type vocabulary used on the wire.
 * We keep the upstream uppercase names so CopilotKit / @ag-ui clients can
 * consume the same frames later without another translation layer.
 */
export const WorkflowEventType = Schema.Literals([
  'RUN_STARTED',
  'RUN_FINISHED',
  'RUN_ERROR',
  'RUN_DISABLED',
  'STEP_STARTED',
  'STEP_FINISHED',
  'STEP_RESULT',
  'TEXT_MESSAGE_START',
  'TEXT_MESSAGE_CONTENT',
  'TEXT_MESSAGE_END',
  'TOOL_CALL_START',
  'TOOL_CALL_ARGS',
  'TOOL_CALL_END',
  'TOOL_CALL_RESULT',
  'STATE_SNAPSHOT',
  'STATE_DELTA',
  'MESSAGES_SNAPSHOT',
])
export type WorkflowEventType = Schema.Schema.Type<typeof WorkflowEventType>

export const WorkflowEvent = Schema.Struct({
  id: Schema.String,
  run_id: Schema.String,
  /** Recognised AG-UI type or a vendor-extension string. */
  type: Schema.Union([WorkflowEventType, Schema.String]),
  timestamp: Schema.String,
  payload: Schema.NullOr(Schema.Unknown),
})
export type WorkflowEvent = Schema.Schema.Type<typeof WorkflowEvent>

export const WorkflowEventList = Schema.Array(WorkflowEvent)
export type WorkflowEventList = Schema.Schema.Type<typeof WorkflowEventList>

export const WorkflowRun = Schema.Struct({
  id: Schema.String,
  session_id: NullableString,
  prompt: Schema.String,
  /** Named workflow; Mastra backends default to "default". */
  workflow: Schema.String,
  status: Schema.Union([WorkflowRunStatus, Schema.String]),
  created_at: Schema.String,
  finished_at: NullableString,
  error: NullableString,
  /** Terminal Mastra result object; null while running. */
  result: Schema.NullOr(Schema.Unknown),
  /** Mastra-internal run ID; null when Mastra is disabled. */
  mastra_run_id: NullableString,
  events: Schema.Array(WorkflowEvent),
})
export type WorkflowRun = Schema.Schema.Type<typeof WorkflowRun>

export const WorkflowRunList = Schema.Array(WorkflowRun)
export type WorkflowRunList = Schema.Schema.Type<typeof WorkflowRunList>

// ── Workflow decode helpers ─────────────────────────────────────────────────

export const decodeWorkflowRun = Schema.decodeUnknownSync(WorkflowRun)
export const decodeWorkflowRunList = Schema.decodeUnknownSync(WorkflowRunList)
