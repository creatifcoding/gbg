import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import { Context, Effect, Layer } from 'effect'
import * as Schema from 'effect/Schema'

import { WorkflowJournalError } from '../domain/errors'
import { WorkflowJournalEntry, type WorkflowJournalEntry as WorkflowJournalEntryType } from '../domain/schemas'
import type { WorkflowJournalShape } from './types'

function makeJournal(entries: WorkflowJournalEntryType[], persist?: (entry: WorkflowJournalEntryType) => Promise<void>) {
  return WorkflowJournal.of({
    append: Effect.fn('@tmnl/pi-workflows/WorkflowJournal.append')(function* (entry) {
      const decoded = Schema.decodeUnknownSync(WorkflowJournalEntry)(entry)
      entries.push(decoded)
      if (persist) {
        yield* Effect.tryPromise({
          try: () => persist(decoded),
          catch: (cause) =>
            new WorkflowJournalError({
              message: 'Failed to persist workflow journal entry.',
              runId: 'runId' in decoded ? decoded.runId : undefined,
              cause,
            }),
        })
      }
    }),

    entries: Effect.fn('@tmnl/pi-workflows/WorkflowJournal.entries')(function* () {
      return [...entries]
    }),

    entriesForRun: Effect.fn('@tmnl/pi-workflows/WorkflowJournal.entriesForRun')(function* (runId) {
      return entries.filter((entry) => 'runId' in entry && entry.runId === runId)
    }),
  })
}

export class WorkflowJournal extends Context.Service<WorkflowJournal, WorkflowJournalShape>()(
  '@tmnl/pi-workflows/WorkflowJournal',
) {
  static readonly memoryLayer = Layer.sync(WorkflowJournal, () => makeJournal([]))

  static readonly jsonlLayer = (path: string) =>
    Layer.effect(
      WorkflowJournal,
      Effect.gen(function* () {
        const entries = yield* loadJournalEntries(path)
        return makeJournal(entries, async (entry) => {
          await mkdir(dirname(path), { recursive: true })
          await writeFile(path, `${JSON.stringify(entry)}\n`, { flag: 'a' })
        })
      }),
    )
}

export const WorkflowJournalMemory = WorkflowJournal.memoryLayer
export const WorkflowJournalJsonl = WorkflowJournal.jsonlLayer

function loadJournalEntries(path: string) {
  return Effect.tryPromise({
    try: async () => {
      try {
        const raw = await readFile(path, 'utf8')
        return raw
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => Schema.decodeUnknownSync(WorkflowJournalEntry)(JSON.parse(line)))
      } catch (error) {
        if (isNotFound(error)) return []
        throw error
      }
    },
    catch: (cause) =>
      new WorkflowJournalError({
        message: 'Failed to load workflow journal.',
        cause,
      }),
  })
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 'ENOENT'
}
