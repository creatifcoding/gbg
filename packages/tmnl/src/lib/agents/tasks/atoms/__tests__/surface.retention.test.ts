import { DateTime } from 'effect'
import { describe, expect, it } from 'vitest'

import { AgentTaskLogEntry } from '../../schemas/log-entry'
import { LOG_LEVEL_SEVERITY, logLevelDataAttr } from '../../schemas/log-level'
import type { AssembledLogEntry } from '../../services/CodecService'
import {
  DEFAULT_LOG_RETENTION_POLICY,
  applyPerTaskEntryCap,
  selectEvictedTaskIds,
  touchLruOrder,
} from '../surface'

const makeEntry = (id: string): AssembledLogEntry => {
  const entry = new AgentTaskLogEntry({
    id,
    timestamp: DateTime.unsafeNow(),
    level: 'INFO',
    source: 'runtime',
    message: `entry-${id}`,
  })

  return {
    entry,
    key: id,
    severityOrd: LOG_LEVEL_SEVERITY.INFO,
    levelAttr: logLevelDataAttr('INFO'),
    timestampDisplay: DateTime.formatIso(entry.timestamp),
    relativeTime: 'just now',
  }
}

describe('log retention policy helpers', () => {
  it('caps per-task buffers as a tail ring', () => {
    const entries = ['1', '2', '3', '4', '5'].map(makeEntry)
    const capped = applyPerTaskEntryCap(entries, 3)

    expect(capped.map((entry) => entry.key)).toEqual(['3', '4', '5'])
  })

  it('touchLruOrder keeps IDs unique and bumps touched task to end', () => {
    const base = ['task-a', 'task-b', 'task-c']

    expect(touchLruOrder(base, 'task-b')).toEqual(['task-a', 'task-c', 'task-b'])
    expect(touchLruOrder(base, 'task-d')).toEqual(['task-a', 'task-b', 'task-c', 'task-d'])
  })

  it('selectEvictedTaskIds applies TTL + LRU overflow without evicting active task', () => {
    const now = 10_000
    const policy = {
      ...DEFAULT_LOG_RETENTION_POLICY,
      maxTaskBuffers: 1,
      idleTtlMs: 1_000,
    }

    const lru = ['task-a', 'task-b', 'task-c']
    const lastSeen = [
      ['task-a', now - 5_000],
      ['task-b', now - 500],
      ['task-c', now - 500],
    ] as const

    const evicted = selectEvictedTaskIds(lru, lastSeen, now, 'task-c', policy)

    // task-a evicted by TTL first; then overflow requires one more LRU eviction (task-b)
    expect(evicted).toEqual(['task-a', 'task-b'])
  })
})
