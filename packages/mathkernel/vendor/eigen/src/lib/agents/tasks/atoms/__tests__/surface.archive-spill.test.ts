import { DateTime, Option } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  AgentTaskLogDurabilityReceipt,
  AgentTaskLogEntry,
} from '../../schemas'
import {
  ARCHIVE_SPILL_CHECKPOINT_SIZE,
  advanceArchiveManifestAfterChunk,
  buildArchiveChunkFromAckedBatch,
  shouldSpillArchiveCheckpoint,
  type ArchiveSpillPendingEntry,
} from '../surface'

const makePending = (
  id: string,
  sequence: number,
  timestampEpochMs: number,
): ArchiveSpillPendingEntry => {
  const entry = new AgentTaskLogEntry({
    id,
    timestamp: DateTime.unsafeMake(timestampEpochMs),
    level: 'INFO',
    source: 'spill.test',
    message: `entry:${id}`,
    metadata: {
      token: 'secret-token',
      nested: {
        span: id,
      },
    },
  })

  const receipt = new AgentTaskLogDurabilityReceipt({
    taskId: 'task-spill',
    entryId: id,
    subject: 'agent.task.task-spill.logs',
    stream: 'AGENT_TASK_LOGS',
    sequence,
    duplicate: false,
    entryTimestamp: entry.timestamp,
    ackedAt: DateTime.unsafeMake(timestampEpochMs + 1),
    publishLatencyMs: 5,
  })

  return { entry, receipt }
}

describe('archive spill helpers', () => {
  it('computes checkpoint eligibility from pending count', () => {
    expect(shouldSpillArchiveCheckpoint(ARCHIVE_SPILL_CHECKPOINT_SIZE - 1)).toBe(false)
    expect(shouldSpillArchiveCheckpoint(ARCHIVE_SPILL_CHECKPOINT_SIZE)).toBe(true)
    expect(shouldSpillArchiveCheckpoint(ARCHIVE_SPILL_CHECKPOINT_SIZE + 7)).toBe(true)
  })

  it('builds archive chunk metadata from acked batch', () => {
    const batch = [
      makePending('entry-1', 10, 1_700_000_000_000),
      makePending('entry-2', 11, 1_700_000_000_050),
    ]

    const chunk = buildArchiveChunkFromAckedBatch(
      'task-spill',
      3,
      batch,
      DateTime.unsafeMake(1_700_000_000_100),
    )

    expect(chunk.taskId).toBe('task-spill')
    expect(chunk.chunkIndex).toBe(3)
    expect(chunk.entryCount).toBe(2)
    expect(chunk.entries.map((entry) => entry.id)).toEqual(['entry-1', 'entry-2'])
    expect(chunk.firstDurabilitySequence).toBe(10)
    expect(chunk.lastDurabilitySequence).toBe(11)
    expect(chunk.approxBytes).toBeGreaterThan(0)
  })

  it('advances manifest for first and subsequent chunk writes', () => {
    const firstChunk = buildArchiveChunkFromAckedBatch(
      'task-spill',
      0,
      [makePending('entry-1', 1, 1_700_000_100_000)],
      DateTime.unsafeMake(1_700_000_100_100),
    )

    const manifestV1 = advanceArchiveManifestAfterChunk(
      'task-spill',
      Option.none(),
      firstChunk,
      DateTime.unsafeMake(1_700_000_100_100),
    )

    expect(manifestV1.chunkCount).toBe(1)
    expect(manifestV1.totalEntries).toBe(1)
    expect(manifestV1.nextChunkIndex).toBe(1)
    expect(manifestV1.latestChunkIndex).toBe(0)

    const secondChunk = buildArchiveChunkFromAckedBatch(
      'task-spill',
      1,
      [makePending('entry-2', 2, 1_700_000_100_200)],
      DateTime.unsafeMake(1_700_000_100_300),
    )

    const manifestV2 = advanceArchiveManifestAfterChunk(
      'task-spill',
      Option.some(manifestV1),
      secondChunk,
      DateTime.unsafeMake(1_700_000_100_300),
    )

    expect(manifestV2.chunkCount).toBe(2)
    expect(manifestV2.totalEntries).toBe(2)
    expect(manifestV2.nextChunkIndex).toBe(2)
    expect(manifestV2.latestChunkIndex).toBe(1)
    expect(manifestV2.lastDurabilitySequence).toBe(2)
  })
})
