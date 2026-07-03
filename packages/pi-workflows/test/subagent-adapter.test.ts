import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'

import { SubagentAdapter, makeWorkflowManagedRuntime } from '../src/services/index'
import { decodeCallId, decodeRunId } from '../src/services/utils'

describe('fake SubagentAdapter', () => {
  it('returns deterministic fake text and metadata', async () => {
    const runtime = makeWorkflowManagedRuntime()

    try {
      const response = await runtime.runPromise(
        Effect.gen(function* () {
          const adapter = yield* SubagentAdapter
          return yield* adapter.runAgent({
            runId: decodeRunId('run-adapter'),
            callId: decodeCallId('call-adapter'),
            key: 'adapter-smoke',
            prompt: 'Summarize V0',
            options: { agent: 'tester' },
          })
        }),
      )

      expect(response.text).toBe('[fake:adapter-smoke] Summarize V0')
      expect(response.metadata).toMatchObject({ adapter: 'fake', agent: 'tester' })
    } finally {
      await runtime.dispose()
    }
  })
})
