/**
 * Schema contract checks for packages/monitor/frontend.
 *
 * Framework-free by design: package typecheck must not depend on bun:test or
 * vitest ambient globals. Run from packages/monitor/frontend with:
 *   bun src/__tests__/schema.test.ts
 */
import { Schema } from 'effect'
import {
  decodeSessionList,
  decodeGraphData,
  decodeEvidenceList,
  WorkflowRunStatus,
  WorkflowEventType,
  WorkflowEvent,
  decodeWorkflowRun,
  decodeWorkflowRunList,
} from '../lib/schema.ts'

const decodeStatus = Schema.decodeUnknownSync(WorkflowRunStatus)
const decodeEventType = Schema.decodeUnknownSync(WorkflowEventType)
const decodeEvent = Schema.decodeUnknownSync(WorkflowEvent)

type Check = readonly [name: string, run: () => void]

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`)
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`)
}

function assertThrows(fn: () => unknown, message: string): void {
  try {
    fn()
  } catch {
    return
  }
  throw new Error(`${message}: expected throw`)
}

function assertDoesNotThrow(fn: () => unknown, message: string): void {
  try {
    fn()
  } catch (error) {
    throw new Error(`${message}: unexpected throw ${error instanceof Error ? error.message : String(error)}`)
  }
}

const validSession = {
  id: 's1',
  name: 'perf-session',
  status: 'open',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: null,
  metadata: null,
}

const validNode = {
  id: 'n1',
  session_id: 's1',
  label: 'CPU spike',
  node_type: 'anomaly',
  metrics: null,
  position_x: null,
  position_y: null,
  severity: null,
  created_at: '2024-01-01T00:00:00Z',
}

const validEdge = {
  id: 'e1',
  session_id: 's1',
  source_id: 'n1',
  target_id: 'n2',
  weight: null,
  label: null,
  edge_type: null,
}

const validEvidence = {
  id: 'ev1',
  session_id: 's1',
  node_id: null,
  kind: 'probe_output',
  content: 'top output...',
  source: null,
  timestamp: '2024-01-01T00:00:00Z',
}

const validWorkflowEvent = {
  id: 'wev-1',
  run_id: 'hr-001',
  type: 'RUN_STARTED',
  timestamp: '2024-01-01T00:00:00Z',
  payload: null,
}

const validWorkflowRun = {
  id: 'hr-001',
  session_id: null,
  prompt: 'analyse memory spike',
  workflow: 'default',
  status: 'completed',
  created_at: '2024-01-01T00:00:00Z',
  finished_at: '2024-01-01T00:00:05Z',
  error: null,
  result: { answer: 'OOM killer' },
  mastra_run_id: 'mrun-abc',
  events: [],
}

const checks: Check[] = [
  ['sessions accept valid data and reject broken data', () => {
    assertDeepEqual(decodeSessionList([]), [], 'empty session list')
    const sessions = decodeSessionList([validSession, { ...validSession, id: 's2', status: 'vendor-custom' }])
    assertEqual(sessions.length, 2, 'session count')
    assertEqual(sessions[0].status, 'open', 'session status')
    assertThrows(() => decodeSessionList([{ ...validSession, id: undefined }]), 'session missing id')
    assertThrows(() => decodeSessionList([{ ...validSession, created_at: 12345 }]), 'session bad created_at')
    assertThrows(() => decodeSessionList(validSession), 'session list must be array')
  }],
  ['graph and evidence contracts reject missing required keys', () => {
    const graph = decodeGraphData({ nodes: [validNode], edges: [validEdge] })
    assertEqual(graph.nodes[0].id, 'n1', 'node id')
    assertEqual(graph.edges[0].id, 'e1', 'edge id')
    assertThrows(() => decodeGraphData({ edges: [] }), 'graph missing nodes')
    assertThrows(() => decodeGraphData({ nodes: [] }), 'graph missing edges')

    const evidence = decodeEvidenceList([validEvidence, { ...validEvidence, id: 'ev2', kind: 'custom-kind' }])
    assertEqual(evidence.length, 2, 'evidence count')
    assertThrows(() => decodeEvidenceList([{ ...validEvidence, content: undefined }]), 'evidence missing content')
  }],
  ['workflow statuses match monitor backend terminals', () => {
    for (const status of ['idle', 'running', 'success', 'completed', 'error', 'cancelled', 'disabled']) {
      assertDoesNotThrow(() => decodeStatus(status), `status ${status}`)
    }
    for (const status of ['pending', 'done', null, 42]) {
      assertThrows(() => decodeStatus(status), `invalid status ${String(status)}`)
    }
  }],
  ['AG-UI event literals use canonical uppercase wire names', () => {
    const validTypes = [
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
    ]
    for (const type of validTypes) {
      assertDoesNotThrow(() => decodeEventType(type), `event type ${type}`)
    }
    assertThrows(() => decodeEventType('run_started'), 'lowercase run_started')
    assertThrows(() => decodeEventType(''), 'empty event type')

    const vendor = decodeEvent({ ...validWorkflowEvent, type: 'CUSTOM_VENDOR_EVENT' })
    assertEqual(vendor.type, 'CUSTOM_VENDOR_EVENT', 'vendor event fallback')
  }],
  ['workflow run shape preserves events and nullable result fields', () => {
    const withEvents = {
      ...validWorkflowRun,
      result: null,
      mastra_run_id: null,
      events: [
        { ...validWorkflowEvent, id: '1', type: 'RUN_STARTED' },
        { ...validWorkflowEvent, id: '2', type: 'TEXT_MESSAGE_CONTENT', payload: { delta: 'hello' } },
        { ...validWorkflowEvent, id: '3', type: 'RUN_FINISHED' },
      ],
    }
    const run = decodeWorkflowRun(withEvents)
    assertEqual(run.result, null, 'nullable result')
    assertEqual(run.mastra_run_id, null, 'nullable mastra id')
    assertDeepEqual(run.events.map((event) => event.id), ['1', '2', '3'], 'event order')
    assertDeepEqual(run.events[1].payload, { delta: 'hello' }, 'event payload')

    assertThrows(() => decodeWorkflowRun({ ...validWorkflowRun, id: undefined }), 'run missing id')
    assertThrows(() => decodeWorkflowRun({ ...validWorkflowRun, events: undefined }), 'run missing events')
    assertThrows(() => decodeWorkflowRun({ ...validWorkflowRun, events: [{ ...validWorkflowEvent, timestamp: 1783595502.49 }] }), 'event timestamp must be string')
  }],
  ['workflow run list and event ordering are stable', () => {
    const runs = decodeWorkflowRunList([
      { ...validWorkflowRun, id: 'hr-1', events: [{ ...validWorkflowEvent, id: '1' }] },
      { ...validWorkflowRun, id: 'hr-2', events: [{ ...validWorkflowEvent, id: '2', type: 'RUN_ERROR' }] },
    ])
    assertDeepEqual(runs.map((run) => run.id), ['hr-1', 'hr-2'], 'run order')
    assertEqual(runs[1].events[0].type, 'RUN_ERROR', 'run event type')
    assertThrows(() => decodeWorkflowRunList({ rows: [] }), 'run list must be array')
  }],
]

for (const [name, check] of checks) {
  check()
  console.log(`ok - ${name}`)
}
