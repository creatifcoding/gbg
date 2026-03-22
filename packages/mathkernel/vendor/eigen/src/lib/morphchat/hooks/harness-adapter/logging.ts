/**
 * Harness adapter logging — Effect-based structured logging utilities.
 *
 * Pure leaf: depends only on Effect.
 *
 * @module morphchat/hooks/harness-adapter/logging
 */

import { Cause, Effect } from 'effect'

export const morphchatLogDebug = Effect.fn('tmnl.morphchat.harness.log.debug')(function* (
  instanceId: string,
  message: string,
  payload?: Record<string, unknown>,
) {
  yield* Effect.logDebug(message).pipe(
    payload === undefined
      ? Effect.annotateLogs({ area: 'morphchat-harness-adapter', instanceId })
      : Effect.annotateLogs({ ...payload, area: 'morphchat-harness-adapter', instanceId }),
  )
})

export const isInterruptedCause = (cause: unknown): boolean =>
  Cause.isCause(cause) && Cause.isInterruptedOnly(cause)

export const morphchatCauseToMessage = Effect.fn('tmnl.morphchat.harness.cause-to-message')(function* (cause: unknown) {
  if (Cause.isCause(cause)) {
    return Cause.pretty(cause)
  }

  if (cause instanceof Error) {
    return cause.message
  }

  if (typeof cause === 'string') {
    return cause
  }

  return yield* Effect.sync(() => {
    if (cause == null) {
      return 'unknown'
    }

    try {
      return JSON.stringify(cause)
    } catch {
      return String(cause)
    }
  })
})

export const morphchatLogWarningCause = Effect.fn('tmnl.morphchat.harness.log.warning-cause')(function* (
  instanceId: string,
  message: string,
  cause: unknown,
  payload?: Record<string, unknown>,
) {
  if (isInterruptedCause(cause)) {
    yield* morphchatLogDebug(instanceId, `${message}:interrupted`, payload)
    return
  }

  const causeMessage = yield* morphchatCauseToMessage(cause)
  yield* Effect.logWarning(message).pipe(
    payload === undefined
      ? Effect.annotateLogs({ area: 'morphchat-harness-adapter', instanceId, cause: causeMessage })
      : Effect.annotateLogs({ ...payload, area: 'morphchat-harness-adapter', instanceId, cause: causeMessage }),
  )
})

export const runHarnessLog = (effect: Effect.Effect<unknown, unknown, never>) => {
  Effect.runFork(effect.pipe(Effect.catchAllCause(() => Effect.void)))
}
