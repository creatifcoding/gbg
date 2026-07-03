import { Context, Effect, Layer } from 'effect'

import { WorkflowAdapterError } from '../domain/errors'
import type { AgentResponse, SubagentAdapterShape } from './types'

export class SubagentAdapter extends Context.Service<SubagentAdapter, SubagentAdapterShape>()(
  '@tmnl/pi-workflows/SubagentAdapter',
) {
  static readonly fakeLayer = Layer.succeed(SubagentAdapter)({
    runAgent: Effect.fn('@tmnl/pi-workflows/SubagentAdapter.fake.runAgent')(function* (request) {
      if (!request.prompt.trim()) {
        return yield* Effect.fail(
          new WorkflowAdapterError({
            message: 'Cannot run an empty agent prompt.',
            runId: request.runId,
            callId: request.callId,
          }),
        )
      }

      return {
        callId: request.callId,
        key: request.key,
        output: `[fake:${request.key}] ${request.prompt}`,
        text: `[fake:${request.key}] ${request.prompt}`,
        metadata: {
          adapter: 'fake',
          agent: request.options?.agent ?? 'default',
        },
      } satisfies AgentResponse
    }),
  })
}

export const SubagentAdapterFake = SubagentAdapter.fakeLayer
