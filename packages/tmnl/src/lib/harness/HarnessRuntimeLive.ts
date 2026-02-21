/**
 * Server-only: HarnessRuntimeLive wires HarnessRuntime → PiAiHarnessEngine.
 * Depends on Node-only modules via PiAiHarnessEngine → PiAiPolicy → @mariozechner/pi-coding-agent.
 * Import from './HarnessRuntimeLive' or '@/lib/harness/index.server', NOT the browser barrel.
 */
import { Effect, Layer, Option, Stream } from 'effect'

import { PiAiHarnessEngine, PiAiHarnessEngineCoreLive, PiAiToolRuntimeWithBuiltins } from './PiAiHarnessEngine'
import { PiAiStreamClientLive } from './PiAiStreamClient'
import { PiAiEventAdapterLive } from './PiAiEventAdapter'
import { PiAiPolicyLive } from './PiAiPolicy'
import { HarnessSessionStoreMemoryLive } from './HarnessSessionStoreMemory'
import { AgentHarnessConfigDefault } from '@/lib/agents/AgentHarnessConfig'
import { HarnessSendAck, HarnessSessionView, HarnessSnapshot } from './schemas'
import { HarnessRuntime, HarnessRuntimeError } from './HarnessRuntime'

const toRuntimeError = (code: string, message: string) => (cause: unknown) =>
  new HarnessRuntimeError({
    code,
    message,
    cause: Option.some(cause),
  })

export const HarnessRuntimeLive = Layer.effect(
  HarnessRuntime,
  Effect.gen(function* () {
    const engine = yield* PiAiHarnessEngine

    return HarnessRuntime.of({
      backend: 'pi-ai',

      openSession: (nodeId, role) =>
        engine.openSession(nodeId, role).pipe(
          Effect.map(
            (view) =>
              new HarnessSessionView({
                ...view,
                backend: 'pi-ai',
              }),
          ),
          Effect.mapError(toRuntimeError('open-session-failed', 'Failed to open harness session')),
          Effect.withSpan('tmnl.harness.runtime.open-session'),
        ),

      resumeSession: (sessionId, fromSeq) =>
        engine.getSnapshot(sessionId, fromSeq).pipe(
          Effect.map((snapshot) => new HarnessSnapshot(snapshot)),
          Effect.mapError(toRuntimeError('resume-session-failed', 'Failed to resume harness session')),
          Effect.withSpan('tmnl.harness.runtime.resume-session'),
        ),

      send: (sessionId, clientMessageId, text, thinkingLevel, modelOverride?) =>
        engine.send(sessionId, clientMessageId, text, thinkingLevel, modelOverride).pipe(
          Effect.map(
            (ack) =>
              new HarnessSendAck({
                accepted: ack.accepted,
                sessionId: ack.sessionId,
                backend: 'pi-ai',
              }),
          ),
          Effect.mapError(toRuntimeError('send-failed', 'Failed to send harness prompt')),
          Effect.withSpan('tmnl.harness.runtime.send'),
        ),

      getSnapshot: (sessionId, fromSeq) =>
        engine.getSnapshot(sessionId, fromSeq).pipe(
          Effect.map((snapshot) => new HarnessSnapshot(snapshot)),
          Effect.mapError(toRuntimeError('snapshot-failed', 'Failed to get harness snapshot')),
          Effect.withSpan('tmnl.harness.runtime.get-snapshot'),
        ),

      abortSession: (sessionId) =>
        engine.abortSession(sessionId).pipe(
          Effect.mapError(toRuntimeError('abort-failed', 'Failed to abort harness session')),
          Effect.withSpan('tmnl.harness.runtime.abort-session'),
        ),

      respondExtensionUI: (sessionId, response) =>
        engine.respondExtensionUI(sessionId, response).pipe(
          Effect.mapError(toRuntimeError('extension-ui-failed', 'Failed to route harness extension UI response')),
          Effect.withSpan('tmnl.harness.runtime.respond-extension-ui'),
        ),

      getAvailableModels: () =>
        engine.getAvailableModels().pipe(
          Effect.mapError(toRuntimeError('models-failed', 'Failed to get available models')),
          Effect.withSpan('tmnl.harness.runtime.get-available-models'),
        ),

      events: engine.events.pipe(
        Stream.mapError(toRuntimeError('events-failed', 'Harness event stream failed')),
      ),
    })
  }),
).pipe(
  Layer.provide(
    PiAiHarnessEngineCoreLive.pipe(
      Layer.provide(HarnessSessionStoreMemoryLive),
      Layer.provide(PiAiToolRuntimeWithBuiltins.pipe(Layer.provide(AgentHarnessConfigDefault))),
      Layer.provide(PiAiStreamClientLive),
      Layer.provide(PiAiEventAdapterLive),
      Layer.provide(PiAiPolicyLive),
    ),
  ),
)
