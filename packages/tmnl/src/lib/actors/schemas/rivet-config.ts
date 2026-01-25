/**
 * RivetKit Config Schemas - Effect Schema Definitions
 *
 * Effect Schema definitions that mirror RivetKit's internal Zod schemas.
 * These validate config BEFORE it reaches RivetKit, preventing Zod errors
 * from leaking to users with cryptic messages.
 *
 * @module lib/actors/schemas/rivet-config
 */

import { Schema } from 'effect'

// =============================================================================
// Actor Config Schema
// =============================================================================

/**
 * Schema for actor options (mirrors RivetKit's ActorOptions)
 */
export const ActorOptions = Schema.Struct({
  stateSaveInterval: Schema.optional(Schema.Number),
  actionTimeout: Schema.optional(Schema.Number),
  sleepTimeout: Schema.optional(Schema.Number),
})
export type ActorOptions = typeof ActorOptions.Type

/**
 * Schema for actor definition structure (mirrors RivetKit's ActorConfigSchema)
 *
 * Note: We use Schema.Unknown for state/actions because the actual structure
 * is determined by the user. We're validating the shape, not the contents.
 */
export const ActorConfigSchema = Schema.Struct({
  /** Initial state or state factory */
  state: Schema.optional(Schema.Unknown),
  /** State factory function (alternative to state) */
  createState: Schema.optional(Schema.Unknown),
  /** Actor actions object */
  actions: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  /** Lifecycle: Called when actor is created */
  onCreate: Schema.optional(Schema.Unknown),
  /** Lifecycle: Called when actor is destroyed */
  onDestroy: Schema.optional(Schema.Unknown),
  /** Lifecycle: Called when actor wakes from sleep */
  onWake: Schema.optional(Schema.Unknown),
  /** Lifecycle: Called when actor goes to sleep */
  onSleep: Schema.optional(Schema.Unknown),
  /** Actor options */
  options: Schema.optional(ActorOptions),
})
export type ActorConfig = typeof ActorConfigSchema.Type

// =============================================================================
// Registry Config Schema
// =============================================================================

/**
 * Schema for registry setup config (mirrors RivetKit's RegistryConfigSchema)
 */
export const RegistryConfigSchema = Schema.Struct({
  /** Actor definitions to register */
  use: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type RegistryConfig = typeof RegistryConfigSchema.Type

// =============================================================================
// Validation Errors
// =============================================================================

/**
 * Error thrown when registry config validation fails
 */
export class RivetConfigError extends Error {
  readonly _tag = 'RivetConfigError'

  constructor(
    message: string,
    readonly context: 'registry' | 'actor',
    readonly path?: string
  ) {
    super(message)
    this.name = 'RivetConfigError'
  }
}

/**
 * Error thrown when actor config validation fails
 */
export class ActorConfigError extends Error {
  readonly _tag = 'ActorConfigError'

  constructor(
    message: string,
    readonly actorName?: string
  ) {
    super(message)
    this.name = 'ActorConfigError'
  }
}
