import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { AtomRegistry } from 'effect/unstable/reactivity'

import { workflowRunCountAtom, workflowRunsAtom } from '../src/state/index'
import {
  WorkflowJournal,
  WorkflowRuntime,
  WorkflowStore,
  makeWorkflowManagedRuntime,
} from '../src/services/index'

describe('workflow service layer', () => {
  it('runs through the Effect service spine and restricted script runner', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          const journal = yield* WorkflowJournal
          const store = yield* WorkflowStore

          const runResult = yield* workflows.run({
            script: `export const meta = { name: "spine", description: "Service spine smoke" } as const\nexport default async function workflow() { phase("survey"); log("hello", { ok: true }); return "ok" }`,
          })
          const entries = yield* journal.entriesForRun(runResult.run.id)
          const runs = yield* store.listRuns()
          const atomRegistry = yield* AtomRegistry.AtomRegistry
          const atomRuns = atomRegistry.get(workflowRunsAtom)
          const atomRunCount = atomRegistry.get(workflowRunCountAtom)

          return { runResult, entries, runs, atomRuns, atomRunCount }
        }),
      )

      expect(result.runResult.run.status).toBe('succeeded')
      expect(result.runResult.descriptor.meta.name).toBe('spine')
      expect(result.runResult.result).toBe('ok')
      expect(result.runResult.run.phase).toBe('survey')
      expect(result.entries.map((entry) => entry._tag)).toEqual([
        'RunStarted',
        'PhaseStarted',
        'LogRecorded',
        'RunSucceeded',
      ])
      expect(result.runs).toHaveLength(1)
      expect(result.atomRuns).toHaveLength(1)
      expect(result.atomRunCount).toBe(1)
    } finally {
      await runtime.dispose()
    }
  })

  it('supports dry-run inspection without adapter execution', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      const descriptor = await runtime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          return yield* workflows.dryRun({
            script: `export const meta = { name: "dry", description: "Dry run" } as const\nexport default async function workflow() {}`,
          })
        }),
      )

      expect(descriptor.meta.name).toBe('dry')
    } finally {
      await runtime.dispose()
    }
  })
})
