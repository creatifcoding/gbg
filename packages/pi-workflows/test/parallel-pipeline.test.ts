import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'

import { WorkflowJournal, WorkflowRuntime, makeWorkflowManagedRuntime } from '../src/services/index'

describe('parallel() and pipeline() globals', () => {
  it('runs parallel thunks with barrier semantics and null failures', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          const journal = yield* WorkflowJournal
          const runResult = yield* workflows.run({
            script: `export const meta = { name: "parallel-smoke", description: "parallel", maxConcurrency: 2 } as const\nexport default async function workflow() { return await parallel([() => agent('A', { label: 'a' }), () => { throw new Error('boom') }, () => agent('C', { label: 'c' })], { label: 'fanout' }) }`,
          })
          const entries = yield* journal.entriesForRun(runResult.run.id)
          return { runResult, entries }
        }),
      )

      expect(result.runResult.result).toEqual(['[fake:a] A', null, '[fake:c] C'])
      expect(result.entries.map((entry) => entry._tag)).toContain('ParallelStarted')
      expect(result.entries.map((entry) => entry._tag)).toContain('ParallelCompleted')
      const completed = result.entries.find((entry) => entry._tag === 'ParallelCompleted')
      expect(completed).toMatchObject({ failures: 1 })
    } finally {
      await runtime.dispose()
    }
  })

  it('pipes each item through stages without a global stage barrier', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          const journal = yield* WorkflowJournal
          const runResult = yield* workflows.run({
            script: `export const meta = { name: "pipeline-smoke", description: "pipeline" } as const\nexport default async function workflow() { return await pipeline(['x', 'y'], [(item) => item + '-1', (item) => agent('process ' + item, { label: item })], { label: 'pipe' }) }`,
          })
          const entries = yield* journal.entriesForRun(runResult.run.id)
          return { runResult, entries }
        }),
      )

      expect(result.runResult.result).toEqual(['[fake:x-1] process x-1', '[fake:y-1] process y-1'])
      expect(result.entries.map((entry) => entry._tag)).toContain('PipelineStarted')
      expect(result.entries.map((entry) => entry._tag)).toContain('PipelineCompleted')
    } finally {
      await runtime.dispose()
    }
  })
})
