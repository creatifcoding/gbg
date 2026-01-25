/**
 * Validated setup() Wrapper
 *
 * Effect Schema-validated wrapper for RivetKit's setup().
 * Validates config BEFORE passing to RivetKit, preventing Zod errors
 * from leaking to users.
 *
 * @module lib/actors/wrappers/setup
 */

import { Schema, Effect } from 'effect'
import { setup as rivetSetup } from 'rivetkit'
import { RegistryConfigSchema, RivetConfigError } from '../schemas/rivet-config'

/**
 * Effect Schema-validated wrapper for RivetKit's setup().
 *
 * Validates config structure BEFORE passing to RivetKit.
 * If validation fails, throws a clear RivetConfigError instead of
 * letting RivetKit's internal Zod throw cryptic errors.
 *
 * @example
 * ```typescript
 * import { validatedSetup } from './wrappers/setup'
 * import { workspace } from './actors/workspace'
 * import { session } from './actors/session'
 *
 * export const actorRegistry = validatedSetup({
 *   use: { workspace, session },
 * })
 * ```
 */
export function validatedSetup<A extends Record<string, unknown>>(config: { use: A }) {
  // Validate with Effect Schema first
  const result = Schema.decodeUnknownEither(RegistryConfigSchema)(config)

  if (result._tag === 'Left') {
    const issues = result.left.message
    throw new RivetConfigError(
      `Invalid registry config: ${issues}`,
      'registry'
    )
  }

  // If we reach here, validation passed - safe to call RivetKit
  // RivetKit's internal Zod validation is now redundant but harmless
  return rivetSetup(config)
}

/**
 * Effect-native version that returns Effect instead of throwing.
 *
 * Use this when you want to handle validation errors in Effect pipelines.
 *
 * @example
 * ```typescript
 * const registry = yield* validatedSetupEffect({
 *   use: { workspace, session },
 * })
 * ```
 */
export const validatedSetupEffect = <A extends Record<string, unknown>>(
  config: { use: A }
) =>
  Effect.gen(function* () {
    // Validate with Effect Schema
    yield* Schema.decodeUnknown(RegistryConfigSchema)(config).pipe(
      Effect.mapError(
        (e) => new RivetConfigError(`Invalid registry config: ${e.message}`, 'registry')
      )
    )

    // Safe to call RivetKit
    return rivetSetup(config)
  })
