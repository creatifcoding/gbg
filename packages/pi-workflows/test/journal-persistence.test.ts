import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { describe, expect, it } from 'vitest'
import { Effect, Layer, ManagedRuntime } from 'effect'
import * as Schema from 'effect/Schema'

import { RunStarted } from '../src/domain/index'
import { WorkflowJournal, WorkflowJournalJsonl } from '../src/services/index'

describe('append-only workflow journal persistence', () => {
  it('appends JSONL entries and reloads them', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pi-workflows-journal-'))
    const path = join(dir, 'journal.jsonl')

    try {
      const firstRuntime = ManagedRuntime.make(WorkflowJournalJsonl(path))
      try {
        await firstRuntime.runPromise(
          Effect.gen(function* () {
            const journal = yield* WorkflowJournal
            yield* journal.append(
              Schema.decodeUnknownSync(RunStarted)({
                _tag: 'RunStarted',
                runId: 'run-journal',
                workflowName: 'journal',
                source: { kind: 'inline', value: 'script', digest: 'script-digest' },
                inputDigest: 'input-digest',
                at: 1,
              }),
            )
          }),
        )
      } finally {
        await firstRuntime.dispose()
      }

      const raw = await readFile(path, 'utf8')
      expect(raw.trim().split('\n')).toHaveLength(1)

      const secondRuntime = ManagedRuntime.make(WorkflowJournalJsonl(path))
      try {
        const entries = await secondRuntime.runPromise(
          Effect.gen(function* () {
            const journal = yield* WorkflowJournal
            return yield* journal.entriesForRun('run-journal' as never)
          }),
        )

        expect(entries).toHaveLength(1)
        expect(entries[0]?._tag).toBe('RunStarted')
      } finally {
        await secondRuntime.dispose()
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
