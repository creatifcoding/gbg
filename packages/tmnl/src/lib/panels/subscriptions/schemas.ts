/**
 * Subscription Manager Service — stub module.
 *
 * Forward declaration for the panel subscription system.
 * Actual implementation pending in the panel subsystem.
 *
 * @module
 */

import { Context, Effect } from "effect"

// ── Service Shape ───────────────────────────────────

export interface SubscriptionManagerServiceShape {
  /**
   * Subscribe to panel state changes.
   */
  readonly subscribe: (panelId: string, callback: (data: unknown) => void) => Effect.Effect<void>
  /**
   * Unsubscribe from panel state changes.
   */
  readonly unsubscribe: (panelId: string) => Effect.Effect<void>
}

// ── Service Tag ─────────────────────────────────────

export class SubscriptionManagerService extends Context.Tag("tmnl/SubscriptionManagerService")<
  SubscriptionManagerService,
  SubscriptionManagerServiceShape
>() {}
