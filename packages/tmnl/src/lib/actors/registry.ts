/**
 * RivetKit Actor Registry
 *
 * Central setup for all actors in the TMNL application.
 * Actors provide durable state with real-time sync across browser tabs.
 *
 * Uses Effect Schema-validated wrappers to prevent Zod errors from
 * leaking to users. Validation happens BEFORE RivetKit's internal Zod.
 *
 * @module lib/actors/registry
 */

import { validatedSetup } from './wrappers/setup'
import { workspace } from './actors/workspace'
import { session } from './actors/session'

/**
 * Actor registry with workspace and session actors.
 *
 * Effect Schema validates config BEFORE RivetKit's Zod sees it.
 * This prevents cryptic Zod errors from reaching users.
 *
 * - WorkspaceActor: Shared buffer registry with real-time sync
 * - SessionActor: Per-user tab/window state persistence
 */
export const actorRegistry = validatedSetup({
  use: { workspace, session },
})

export type ActorRegistry = typeof actorRegistry
