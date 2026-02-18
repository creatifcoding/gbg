import { DateTime } from 'effect'
import { describe, expect, it } from 'vitest'

import { AgentTaskLogEntry } from '../../schemas/log-entry'
import { LOG_LEVEL_SEVERITY, logLevelDataAttr, type LogLevel } from '../../schemas/log-level'
import type { AssembledLogEntry } from '../../services/CodecService'
import { mergeHotAndHydratedEntries } from '../surface'

const makeLogEntry = (
  id: string,
  timestampEpochMs: number,
  level: LogLevel,
  message: string,
) =>
  new AgentTaskLogEntry({
    id,
    timestamp: DateTime.unsafeMake(timestampEpochMs),
    level,
    source: 'runtime',
    message,
  })

const makeAssembled = (
  id: string,
  timestampEpochMs: number,
  level: LogLevel,
  message: string,
): AssembledLogEntry => {
  const entry = makeLogEntry(id, timestampEpochMs, level, message)
  return {
    entry,
    key: id,
    severityOrd: LOG_LEVEL_SEVERITY[level],
    levelAttr: logLevelDataAttr(level),
    timestampDisplay: DateTime.formatIso(entry.timestamp),
    relativeTime: 'just now',
  }
}

describe('mergeHotAndHydratedEntries', () => {
  it('dedupes by id+timestamp and keeps hot lane precedence', () => {
    const ts = 1_700_000_000_000
    const hot = [makeAssembled('entry-1', ts, 'INFO', 'hot lane message')]
    const hydrated = [makeLogEntry('entry-1', ts, 'INFO', 'hydrated lane duplicate')]

    const merged = mergeHotAndHydratedEntries(hot, hydrated)

    expect(merged).toHaveLength(1)
    expect(merged[0]?.entry.message).toBe('hot lane message')
  })

  it('applies deterministic lexical tie-break for equal timestamps', () => {
    const ts = 1_700_000_100_000
    const hot = [makeAssembled('entry-b', ts, 'INFO', 'b from hot')]
    const hydrated = [makeLogEntry('entry-a', ts, 'INFO', 'a from hydrated')]

    const merged = mergeHotAndHydratedEntries(hot, hydrated)

    expect(merged.map((entry) => entry.entry.id)).toEqual(['entry-a', 'entry-b'])
  })

  it('merges unique hot+hydrated entries in ascending timestamp order', () => {
    const hot = [
      makeAssembled('entry-2', 1_700_000_300_000, 'INFO', 'hot newer'),
    ]
    const hydrated = [
      makeLogEntry('entry-1', 1_700_000_200_000, 'INFO', 'hydrated older'),
      makeLogEntry('entry-3', 1_700_000_400_000, 'INFO', 'hydrated newest'),
    ]

    const merged = mergeHotAndHydratedEntries(hot, hydrated)

    expect(merged.map((entry) => entry.entry.id)).toEqual([
      'entry-1',
      'entry-2',
      'entry-3',
    ])
  })
})
