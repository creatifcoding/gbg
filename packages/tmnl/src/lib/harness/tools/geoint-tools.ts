/**
 * GEOINT tool group — geoint_spawn, geoint_select, geoint_search, geoint_summary.
 *
 * @module harness/tools/geoint-tools
 */

import { Effect } from 'effect'
import type { ToolContribution } from './types'
import { emptyContribution } from './types'
import type { HarnessTool } from './types'
import { createGeointTools, GeointHarnessService, GeointHarnessServiceLive } from '@/lib/geoint/harness'

export const resolveGeointToolContribution = Effect.tryPromise({
  try: async () => {
    const service = await Effect.runPromise(
      Effect.gen(function* () {
        return yield* GeointHarnessService
      }).pipe(Effect.provide(GeointHarnessServiceLive)),
    )
    const tools = createGeointTools(service) as unknown as HarnessTool[]
    return { tools, concurrentFriendly: [] } satisfies ToolContribution
  },
  catch: (error) => error,
}).pipe(
  Effect.orElseSucceed(() => {
    console.warn('[harness] geoint tools unavailable')
    return emptyContribution
  }),
)
