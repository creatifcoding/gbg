import { DateTime, Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  AgentTaskLogDurabilityReceipt,
  AgentTaskLogDurabilityReceiptSchema,
  HydrationSlice,
  HydrationSliceSchema,
  HydrationWindow,
  LogArchiveChunk,
  LogArchiveChunkSchema,
  LogArchiveManifest,
  LogArchiveManifestSchema,
} from '..'
import { AgentTaskLogEntry } from '../log-entry'

describe('archive + hydration schemas', () => {
  it('decodes archive manifest and chunk payloads from unknown input', () => {
    const manifest = Schema.decodeUnknownSync(LogArchiveManifestSchema)({
      _tag: 'LogArchiveManifest',
      taskId: 'task-42',
      version: 1,
      nextChunkIndex: 2,
      latestChunkIndex: 1,
      chunkCount: 2,
      totalEntries: 9,
      evictedChunkCount: 0,
      oldestTimestamp: '2026-02-01T00:00:00.000Z',
      newestTimestamp: '2026-02-02T00:00:00.000Z',
      lastDurabilitySequence: 99,
      updatedAt: '2026-02-02T00:00:00.000Z',
    })

    const chunk = Schema.decodeUnknownSync(LogArchiveChunkSchema)({
      _tag: 'LogArchiveChunk',
      taskId: 'task-42',
      chunkIndex: 1,
      entryCount: 1,
      entries: [
        {
          _tag: 'AgentTaskLogEntry',
          id: 'entry-1',
          timestamp: '2026-02-02T00:00:00.000Z',
          level: 'INFO',
          source: 'test',
          message: 'ok',
        },
      ],
      oldestTimestamp: '2026-02-02T00:00:00.000Z',
      newestTimestamp: '2026-02-02T00:00:00.000Z',
      firstDurabilitySequence: 99,
      lastDurabilitySequence: 99,
      approxBytes: 256,
      persistedAt: '2026-02-02T00:00:00.000Z',
    })

    expect(manifest.taskId).toBe('task-42')
    expect(chunk.chunkIndex).toBe(1)
    expect(chunk.entries[0]?.id).toBe('entry-1')
  })

  it('roundtrips durability receipt encode/decode', () => {
    const now = DateTime.unsafeNow()
    const receipt = new AgentTaskLogDurabilityReceipt({
      taskId: 'task-7',
      entryId: 'entry-7',
      subject: 'agent.task.task-7.logs',
      stream: 'AGENT_TASK_LOGS',
      sequence: 7,
      duplicate: false,
      entryTimestamp: now,
      ackedAt: now,
      publishLatencyMs: 3,
    })

    const encoded = Schema.encodeSync(AgentTaskLogDurabilityReceiptSchema)(receipt)
    const decoded = Schema.decodeUnknownSync(AgentTaskLogDurabilityReceiptSchema)(encoded)

    expect(decoded.sequence).toBe(7)
    expect(decoded.stream).toBe('AGENT_TASK_LOGS')
  })

  it('roundtrips hydration slice with window + merged entries', () => {
    const now = DateTime.unsafeNow()

    const window = new HydrationWindow({
      taskId: 'task-h',
      anchor: 'newest-first',
      centerOffset: 0,
      beforeCount: 500,
      afterCount: 500,
      fromOffset: 0,
      toOffset: 500,
      cacheTtlMs: 300_000,
      requestedAt: now,
    })

    const entry = new AgentTaskLogEntry({
      id: 'entry-h-1',
      timestamp: now,
      level: 'DEBUG',
      source: 'hydration.test',
      message: 'hydrated',
    })

    const slice = new HydrationSlice({
      taskId: 'task-h',
      window,
      source: 'archive',
      mergedEntries: [entry],
      mergedEntryCount: 1,
      hasOlder: true,
      hasNewer: false,
      hydratedAt: now,
    })

    const encoded = Schema.encodeSync(HydrationSliceSchema)(slice)
    const decoded = Schema.decodeUnknownSync(HydrationSliceSchema)(encoded)

    expect(decoded.window.anchor).toBe('newest-first')
    expect(decoded.source).toBe('archive')
    expect(decoded.mergedEntryCount).toBe(1)
  })
})
