/**
 * Validated actor() Wrapper
 *
 * Effect Schema-validated wrapper for RivetKit's actor().
 * Validates actor config BEFORE passing to RivetKit.
 *
 * @module lib/actors/wrappers/actor
 */

import { Schema, Effect } from 'effect'
import { actor as rivetActor } from 'rivetkit'
import { ActorConfigSchema, ActorConfigError } from '../schemas/rivet-config'

/**
 * Effect Schema-validated wrapper for RivetKit's actor().
 *
 * Validates actor config structure BEFORE passing to RivetKit.
 * If validation fails, throws a clear ActorConfigError instead of
 * letting RivetKit's internal Zod throw cryptic errors.
 *
 * @example
 * ```typescript
 * import { validatedActor } from './wrappers/actor'
 *
 * export const workspace = validatedActor({
 *   state: { buffers: {} } as WorkspaceState,
 *   actions: {
 *     createBuffer: (c, userId, type, name, uri) => { ... },
 *     // ...
 *   },
 * })
 * ```
 */
export function validatedActor<S, A extends Record<string, unknown>>(
  config: { state: S; actions: A }
) {
  // Validate structure with Effect Schema
  const result = Schema.decodeUnknownEither(ActorConfigSchema)(config)

  if (result._tag === 'Left') {
    const issues = result.left.message
    throw new ActorConfigError(`Invalid actor config: ${issues}`)
  }

  // Safe to call RivetKit - validation passed
  return rivetActor(config)
}

/**
 * Effect-native version that returns Effect instead of throwing.
 *
 * Use this when you want to handle validation errors in Effect pipelines.
 *
 * @example
 * ```typescript
 * const workspaceActor = yield* validatedActorEffect({
 *   state: { buffers: {} },
 *   actions: { ... },
 * })
 * ```
 */
export const validatedActorEffect = <S, A extends Record<string, unknown>>(
  config: { state: S; actions: A }
) =>
  Effect.gen(function* () {
    // Validate with Effect Schema
    yield* Schema.decodeUnknown(ActorConfigSchema)(config).pipe(
      Effect.mapError((e) => new ActorConfigError(`Invalid actor config: ${e.message}`))
    )

    // Safe to call RivetKit
    return rivetActor(config)
  })
