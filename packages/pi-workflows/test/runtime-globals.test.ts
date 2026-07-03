import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'

import { WorkflowJournal, WorkflowRuntime, makeWorkflowManagedRuntime } from '../src/services/index'

describe('workflow runtime coordinator globals', () => {
  it('records phase/log globals and associates agent calls with current phase', async () => {
    const runtime = makeWorkflowManagedRuntime()
    const script = `export const meta = { name: "globals", description: "runtime globals" } as const
export default async function workflow() {
  phase('survey')
  log('entered survey', { ok: true })
  const first = await agent('first', { label: 'first' })
  phase('synthesis')
  const second = await agent('second', { label: 'second' })
  return [first, second]
}`

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          const journal = yield* WorkflowJournal
          const run = yield* workflows.run({ script })
          const entries = yield* journal.entriesForRun(run.run.id)
          return { run, entries }
        }),
      )

      expect(result.run.run.calls.map((call) => [call.key, call.phase])).toEqual([
        ['first', 'survey'],
        ['second', 'synthesis'],
      ])
      expect(result.entries).toContainEqual(expect.objectContaining({ _tag: 'PhaseStarted', phase: 'survey' }))
      expect(result.entries).toContainEqual(expect.objectContaining({ _tag: 'LogRecorded', message: 'entered survey' }))
    } finally {
      await runtime.dispose()
    }
  })
})
