import { Effect, Layer } from 'effect'

import {
  ConductorAgentChatGateway,
  ConductorAgentChatGatewayLive,
  ConductorAgentPromptInput,
  explainGatewayError,
} from '../src/components/testbed/conductor/ConductorAgentChatService'
import {
  PiRemoteOrchestratorLive,
  PiRemoteWebSocketTransportBrowser,
  PiRemoteWebSocketTransportConfigDefault,
} from '../src/lib/pi-orchestrator/client'

const layer = ConductorAgentChatGatewayLive.pipe(
  Layer.provide(
    PiRemoteOrchestratorLive.pipe(
      Layer.provide(
        PiRemoteWebSocketTransportBrowser.pipe(
          Layer.provide(PiRemoteWebSocketTransportConfigDefault),
        ),
      ),
    ),
  ),
)

const prompt = process.argv.slice(2).join(' ').trim() || 'Reply with PONG and one sentence about system health.'

const program = Effect.gen(function* () {
  const gateway = yield* ConductorAgentChatGateway

  console.log('[smoke] dispatching prompt to pi orchestrator...')
  const result = yield* gateway.runPrompt(
    new ConductorAgentPromptInput({
      nodeId: 'conductor-smoke-node',
      role: 'planner',
      prompt,
      settleDelayMs: 2200,
    }),
  )

  console.log('[smoke] ok')
  console.log(`[smoke] agentId=${result.agentId}`)
  console.log(`[smoke] assistantText=${result.assistantText.slice(0, 240)}`)
  console.log(`[smoke] messages=${result.messages.length}`)
})

Effect.runPromise(
  program.pipe(
    Effect.provide(layer),
    Effect.catchTags({
      ConductorAgentChatGatewayError: (error) =>
        Effect.sync(() => {
          console.error(`[smoke] gateway-error ${explainGatewayError(error)}`)
          process.exitCode = 1
        }),
    }),
  ),
).catch((error) => {
  console.error('[smoke] unhandled', error)
  process.exitCode = 1
})
