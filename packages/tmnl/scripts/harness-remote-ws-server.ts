#!/usr/bin/env bun

import { BunRuntime } from '@effect/platform-bun'
import { Cause, Effect, Schema } from 'effect'

const unknownToDiagnosticString = (cause: unknown): string => {
  if (typeof cause === 'string') return cause
  if (cause == null) return 'unknown'

  if (cause instanceof Error) {
    return cause.message || cause.name || String(cause)
  }

  try {
    const json = JSON.stringify(cause)
    if (json && json !== '{}') return json
  } catch {
    // fall through to String(cause)
  }

  return String(cause)
}

const unknownToStack = (cause: unknown): string | undefined =>
  cause instanceof Error && cause.stack ? cause.stack : undefined

const unknownToName = (cause: unknown): string | undefined =>
  cause instanceof Error && cause.name ? cause.name : undefined

class HarnessRemoteWsBootstrapError extends Schema.TaggedError<HarnessRemoteWsBootstrapError>()(
  'HarnessRemoteWsBootstrapError',
  {
    message: Schema.String,
    causeMessage: Schema.String,
    causeName: Schema.optional(Schema.String),
    causeStack: Schema.optional(Schema.String),
  },
) {}

const main = Effect.gen(function* () {
  yield* Effect.logInfo('[boot] harness remote ws bootstrap start')

  yield* Effect.logInfo('[boot] importing HarnessRemoteWsServer module')

  const serverModule = yield* Effect.tryPromise({
    try: () => import('../src/lib/harness/server/HarnessRemoteWsServer'),
    catch: (cause) =>
      new HarnessRemoteWsBootstrapError({
        message: 'Failed to import HarnessRemoteWsServer module',
        causeMessage: unknownToDiagnosticString(cause),
        causeName: unknownToName(cause),
        causeStack: unknownToStack(cause),
      }),
  })

  yield* Effect.logInfo('[boot] HarnessRemoteWsServer module imported')

  const runServer =
    typeof (serverModule as { runHarnessRemoteWsServer?: unknown }).runHarnessRemoteWsServer === 'function'
      ? (serverModule as { runHarnessRemoteWsServer: () => Effect.Effect<unknown> }).runHarnessRemoteWsServer()
      : (serverModule as { runHarnessRemoteWsServer: Effect.Effect<unknown> }).runHarnessRemoteWsServer

  return yield* runServer
}).pipe(
  Effect.withSpan('harness.bootstrap.main'),
  Effect.catchTags({
    HarnessRemoteWsBootstrapError: (error) =>
      Effect.gen(function* () {
        const prefix = error.causeName ? `${error.causeName}: ` : ''
        yield* Effect.logError(`[boot] harness bootstrap failed: ${error.message}`)
        yield* Effect.logError(`[boot] import cause: ${prefix}${error.causeMessage}`)
        if (error.causeStack) {
          yield* Effect.logError(`[boot] import stack:\n${error.causeStack}`)
        }
        return yield* Effect.fail(error)
      }),
  }),
  Effect.catchAllCause((cause) => {
    if (Cause.isInterruptedOnly(cause)) {
      return Effect.failCause(cause)
    }

    return Effect.logError(`[boot] fatal harness remote ws cause:\n${Cause.pretty(cause)}`).pipe(
      Effect.zipRight(Effect.failCause(cause)),
    )
  }),
)

BunRuntime.runMain(main)
