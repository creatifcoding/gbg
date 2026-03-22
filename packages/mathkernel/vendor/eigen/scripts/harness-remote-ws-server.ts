#!/usr/bin/env bun

import { BunRuntime } from '@effect/platform-bun'
import { Effect, Option, Schema } from 'effect'

class HarnessRemoteWsBootstrapError extends Schema.TaggedError<HarnessRemoteWsBootstrapError>()(
  'HarnessRemoteWsBootstrapError',
  {
    message: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  },
) {}

const main = Effect.gen(function* () {
  yield* Effect.logInfo('[boot] harness remote ws bootstrap start')

  const serverModule = yield* Effect.tryPromise({
    try: () => import('../src/lib/harness/server/HarnessRemoteWsServer'),
    catch: (cause) =>
      new HarnessRemoteWsBootstrapError({
        message: 'Failed to import HarnessRemoteWsServer module',
        cause: Option.some(cause),
      }),
  })

  const runServer =
    typeof (serverModule as { runHarnessRemoteWsServer?: unknown }).runHarnessRemoteWsServer === 'function'
      ? (serverModule as { runHarnessRemoteWsServer: () => Effect.Effect<unknown> }).runHarnessRemoteWsServer()
      : (serverModule as { runHarnessRemoteWsServer: Effect.Effect<unknown> }).runHarnessRemoteWsServer

  return yield* runServer
}).pipe(
  Effect.withSpan('harness.bootstrap.main'),
  Effect.catchTags({
    HarnessRemoteWsBootstrapError: (error) =>
      Effect.logError(`[boot] harness bootstrap failed: ${error.message}`).pipe(
        Effect.zipRight(Effect.fail(error)),
      ),
  }),
)

BunRuntime.runMain(main)
