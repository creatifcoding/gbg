import { Config, Effect, Option, Schema, Stream } from 'effect'

import {
  HarnessClientMessageId,
  HarnessRuntime,
  HarnessRuntimeLive,
  HarnessSessionId,
  type HarnessRole,
} from '../src/lib/harness'

const cliPrompt = process.argv.slice(2).join(' ').trim()

const SmokeRoleConfig = Config.literal(
  'scada-analyst',
  'code-assistant',
  'navigator',
  'inspector',
  'general',
)('HARNESS_SMOKE_ROLE').pipe(Config.withDefault('general' as const))

const SmokeConfig = Config.all({
  timeoutMs: Config.integer('HARNESS_SMOKE_TIMEOUT_MS').pipe(
    Config.withDefault(180_000),
    Config.validate({
      message: 'HARNESS_SMOKE_TIMEOUT_MS must be > 0',
      validation: (value) => value > 0,
    }),
  ),
  pollMs: Config.integer('HARNESS_SMOKE_POLL_MS').pipe(
    Config.withDefault(200),
    Config.validate({
      message: 'HARNESS_SMOKE_POLL_MS must be > 0',
      validation: (value) => value > 0,
    }),
  ),
  streamLive: Config.boolean('HARNESS_SMOKE_STREAM').pipe(Config.withDefault(false)),
  role: SmokeRoleConfig,
})

class HarnessSmokeError extends Schema.TaggedError<HarnessSmokeError>()('HarnessSmokeError', {
  message: Schema.String,
  sessionId: Schema.NullOr(HarnessSessionId),
  details: Schema.NullOr(Schema.Unknown),
}) {}

const waitForTerminalEvent = (
  runtime: typeof HarnessRuntime.Type,
  sessionId: typeof HarnessSessionId.Type,
  timeoutMs: number,
  pollMs: number,
): Effect.Effect<{ readonly text: string; readonly eventCount: number; readonly metricCount: number }, HarnessSmokeError> =>
  Effect.gen(function* () {
    const startedAt = Date.now()

    while (true) {
      const snapshot = yield* runtime.getSnapshot(sessionId, Option.none()).pipe(
        Effect.mapError(
          (cause) =>
            new HarnessSmokeError({
              message: `Failed to read snapshot for smoke session ${sessionId}`,
              sessionId,
              details: cause,
            }),
        ),
      )

      const finalEvent = [...snapshot.events]
        .reverse()
        .find((event) => event._tag === 'chat:v2/assistant_final')

      if (finalEvent && finalEvent._tag === 'chat:v2/assistant_final') {
        return {
          text: finalEvent.text,
          eventCount: snapshot.events.length,
          metricCount: snapshot.events.filter((event) => event._tag === 'chat:v2/metric').length,
        }
      }

      const errorEvent = [...snapshot.events]
        .reverse()
        .find((event) => event._tag === 'chat:v2/error')

      if (errorEvent && errorEvent._tag === 'chat:v2/error') {
        return yield* Effect.fail(
          new HarnessSmokeError({
            message: `[${errorEvent.code}] ${errorEvent.message}`,
            sessionId,
            details: {
              seq: errorEvent.seq,
              code: errorEvent.code,
            },
          }),
        )
      }

      const elapsedMs = Date.now() - startedAt
      if (elapsedMs >= timeoutMs) {
        const tail = snapshot.events.slice(-8).map((event) => event._tag)

        return yield* Effect.fail(
          new HarnessSmokeError({
            message: `Timed out after ${timeoutMs}ms waiting for assistant_final (headSeq=${snapshot.headSeq})`,
            sessionId,
            details: { tailEvents: tail },
          }),
        )
      }

      yield* Effect.sleep(`${pollMs} millis`)
    }
  })

const program = Effect.gen(function* () {
  const runtime = yield* HarnessRuntime
  const smokeConfig = yield* SmokeConfig

  const prompt = cliPrompt.length > 0
    ? cliPrompt
    : 'Say hello from the TMNL harness smoke test.'

  const nodeId = `smoke-${Date.now()}`
  const role: HarnessRole = smokeConfig.role

  const session = yield* runtime.openSession(nodeId, role).pipe(
    Effect.mapError(
      (cause) =>
        new HarnessSmokeError({
          message: 'Failed to open smoke session',
          sessionId: null,
          details: cause,
        }),
    ),
  )

  const clientMessageId = yield* Schema.decodeUnknown(HarnessClientMessageId)(`smoke-client-${Date.now()}`).pipe(
    Effect.mapError(
      (cause) =>
        new HarnessSmokeError({
          message: 'Failed to construct smoke client message id',
          sessionId: session.sessionId,
          details: cause,
        }),
    ),
  )

  yield* Effect.logInfo(
    `Opened harness session ${session.sessionId} (backend=${session.backend}, role=${role}, timeoutMs=${smokeConfig.timeoutMs})`,
  )

  if (smokeConfig.streamLive) {
    yield* Effect.logInfo('[stream] live event tap enabled (HARNESS_SMOKE_STREAM=true)')

    yield* Effect.forkDaemon(
      Stream.runForEach(runtime.events, (event) => {
        if (event.sessionId !== session.sessionId) {
          return Effect.void
        }

        switch (event._tag) {
          case 'chat:v2/assistant_start':
            return Effect.logInfo('[stream] assistant_start')
          case 'chat:v2/assistant_delta':
            return Effect.sync(() => process.stdout.write(event.delta))
          case 'chat:v2/assistant_thinking_delta':
            return Effect.void
          case 'chat:v2/provider_marker':
            return Effect.logInfo(`[stream] provider_marker ${event.marker._tag}`)
          case 'chat:v2/assistant_final':
            return Effect.logInfo(`\n[stream] assistant_final (${event.text.length} chars)`)
          case 'chat:v2/error':
            return Effect.logError(`[stream] error ${event.code}: ${event.message}`)
          default:
            return Effect.void
        }
      }),
    )
  }

  yield* runtime.send(session.sessionId, clientMessageId, prompt, Option.none()).pipe(
    Effect.mapError(
      (cause) =>
        new HarnessSmokeError({
          message: 'Failed to send smoke prompt',
          sessionId: session.sessionId,
          details: cause,
        }),
    ),
  )

  const result = yield* waitForTerminalEvent(
    runtime,
    session.sessionId,
    smokeConfig.timeoutMs,
    smokeConfig.pollMs,
  )

  const snapshot = yield* runtime.getSnapshot(session.sessionId, Option.none())
  const metricEvents = snapshot.events.filter((event) => event._tag === 'chat:v2/metric')

  yield* Effect.logInfo(`Assistant response (${result.eventCount} events):\n${result.text}`)

  if (metricEvents.length > 0) {
    yield* Effect.logInfo('Observed metrics:')
    for (const metric of metricEvents) {
      if (metric._tag === 'chat:v2/metric') {
        yield* Effect.logInfo(`- ${metric.metric}: ${metric.value}`)
      }
    }
  }

  return {
    sessionId: session.sessionId,
    eventCount: result.eventCount,
    metricCount: result.metricCount,
  }
})

const maybeRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null

Effect.runPromise(program.pipe(Effect.provide(HarnessRuntimeLive))).then(
  (summary) => {
    console.log('\n[harness:piai:smoke] PASS', summary)
  },
  (error) => {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('does not exist or you do not have access')) {
      console.error('\n[harness:piai:smoke] HINT: model access failed. Override PI_HARNESS_PIAI_MODEL to an available model (e.g. gpt-5-mini) and retry.')
    }

    if (message.includes('No API key for provider: openai-codex')) {
      console.error('\n[harness:piai:smoke] HINT: login to OAuth lane and retry: bunx @mariozechner/pi-ai login openai-codex')
      console.error('[harness:piai:smoke] HINT: override auth file with PI_HARNESS_PIAI_OAUTH_AUTH_FILE if needed')
    }

    console.error(`\n[harness:piai:smoke] FAIL ${message}`)

    const errorRecord = maybeRecord(error)
    const details = errorRecord?.details
    const sessionId = errorRecord?.sessionId

    if (typeof sessionId === 'string' && sessionId.length > 0) {
      console.error(`[harness:piai:smoke] sessionId: ${sessionId}`)
    }

    if (details !== undefined && details !== null) {
      console.error('[harness:piai:smoke] details:', JSON.stringify(details, null, 2))
    }

    process.exitCode = 1
  },
)
