import { DateTime } from 'effect'
import { describe, expect, it } from 'vitest'

import { AgentTaskLogEntry } from '../../schemas/log-entry'
import { LOG_LEVEL_SEVERITY, logLevelDataAttr, type LogLevel } from '../../schemas/log-level'
import type { AssembledLogEntry } from '../../services/CodecService'
import {
  applyLogSearchQuery,
  mapAssembledLogEntryToSearchableItem,
} from '../surface'

const makeEntry = (
  id: string,
  level: LogLevel,
  source: string,
  message: string,
  extras?: Partial<{
    metadata: Record<string, unknown>
    payload: unknown
    traceId: string
    spanId: string
    toolCallId: string
    parentTaskId: string
  }>,
): AssembledLogEntry => {
  const entry = new AgentTaskLogEntry({
    id,
    timestamp: DateTime.unsafeNow(),
    level,
    source,
    message,
    metadata: extras?.metadata,
    payload: extras?.payload,
    traceId: extras?.traceId,
    spanId: extras?.spanId,
    toolCallId: extras?.toolCallId,
    parentTaskId: extras?.parentTaskId,
  })

  return {
    entry,
    key: id,
    severityOrd: LOG_LEVEL_SEVERITY[level],
    levelAttr: logLevelDataAttr(level),
    timestampDisplay: DateTime.formatIso(entry.timestamp),
    relativeTime: 'just now',
  }
}

describe('AgentTask log QueryDSL mapping/filter bridge', () => {
  it('maps AssembledLogEntry to QueryDSL SearchableItem fields', () => {
    const assembled = makeEntry('log-1', 'ERROR', 'nats.worker', 'tool failed', {
      traceId: 'trace-123',
      metadata: { worker: 'alpha', latency: 42 },
      payload: { code: 'E_CONN', retry: false },
    })

    const item = mapAssembledLogEntryToSearchableItem(assembled, 'task-7')

    expect(item.id).toBe('log-1')
    expect(item.name).toBe('tool failed')
    expect(item.category).toBe('error')
    expect(item.scope).toBe('task-7')
    expect(item.keys).toContain('trace-123')
    expect(item.description).toContain('nats.worker')
    expect(item.description).toContain('latency:42')
    expect(item.description).toContain('code:E_CONN')
  })

  it('supports plain text query and field operators in one path', () => {
    const entries: ReadonlyArray<AssembledLogEntry> = [
      makeEntry('log-1', 'INFO', 'scheduler', 'health check ok', {
        metadata: { worker: 'alpha' },
      }),
      makeEntry('log-2', 'ERROR', 'executor', 'deploy failed timeout', {
        metadata: { worker: 'beta' },
        traceId: 'trace-fail',
      }),
    ]

    const byText = applyLogSearchQuery(entries, 'timeout', 'task-9')
    expect(byText.map((e) => e.key)).toEqual(['log-2'])

    const byField = applyLogSearchQuery(entries, 'category:error scope:task-9', 'task-9')
    expect(byField.map((e) => e.key)).toEqual(['log-2'])
  })

  it('handles operator-only query without free text', () => {
    const entries: ReadonlyArray<AssembledLogEntry> = [
      makeEntry('log-a', 'WARN', 'pipe', 'slow flush', { traceId: 'trace-a' }),
      makeEntry('log-b', 'INFO', 'pipe', 'flush complete', { traceId: 'trace-b' }),
    ]

    const result = applyLogSearchQuery(entries, 'keys:trace-a -category:info', 'task-22')

    expect(result.map((e) => e.key)).toEqual(['log-a'])
  })

  it('supports field:value alias in log filtering path', () => {
    const entries: ReadonlyArray<AssembledLogEntry> = [
      makeEntry('log-c', 'INFO', 'runtime.worker', 'agent task runtime started'),
      makeEntry('log-d', 'INFO', 'network', 'socket opened'),
    ]

    const result = applyLogSearchQuery(entries, 'field:runtime', 'task-33')

    expect(result.map((e) => e.key)).toEqual(['log-c'])
  })

  it('invalid regex in query is deterministic no-op (no crash)', () => {
    const entries: ReadonlyArray<AssembledLogEntry> = [
      makeEntry('log-1', 'INFO', 'svc', 'hello world'),
      makeEntry('log-2', 'ERROR', 'svc', 'boom'),
    ]

    const result = applyLogSearchQuery(entries, 'regex:*invalid(', 'task-5')

    expect(result.map((e) => e.key)).toEqual(['log-1', 'log-2'])
  })
})
