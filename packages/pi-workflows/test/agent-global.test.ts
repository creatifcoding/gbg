import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'

import { WorkflowJournal, WorkflowRuntime, makeWorkflowManagedRuntime } from '../src/services/index'

describe('agent() workflow global', () => {
  it('delegates through SubagentAdapter and journals the call', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      const result = await runtime.runPromise(
        Effect.gen(function* () {
          const workflows = yield* WorkflowRuntime
          const journal = yield* WorkflowJournal
          const runResult = yield* workflows.run({
            script: `export const meta = { name: "agent-smoke", description: "agent smoke" } as const\nexport default async function workflow() { phase('research'); return await agent('Map the system', { label: 'mapper' }) }`,
          })
          const entries = yield* journal.entriesForRun(runResult.run.id)
          return { runResult, entries }
        }),
      )

      expect(result.runResult.result).toBe('[fake:mapper] Map the system')
      expect(result.runResult.run.calls).toHaveLength(1)
      expect(result.runResult.run.calls[0]?.key).toBe('mapper')
      expect(result.entries.map((entry) => entry._tag)).toEqual([
        'RunStarted',
        'AgentCallStarted',
        'AgentCallSucceeded',
        'PhaseStarted',
        'RunSucceeded',
      ])
    } finally {
      await runtime.dispose()
    }
  })
})
