/**
 * Panel Query Service — stub module.
 *
 * Forward declaration for the panel_eval tool system.
 * Actual implementation pending in the panel subsystem.
 *
 * @module
 */

import { Context, Effect } from "effect"

// ── Service Shape ───────────────────────────────────

export interface PanelQueryServiceShape {
  /**
   * Execute code in the panel evaluation context.
   */
  readonly eval: (code: string) => Effect.Effect<string, Error>
}

// ── Service Tag ─────────────────────────────────────

export class PanelQueryService extends Context.Tag("tmnl/PanelQueryService")<
  PanelQueryService,
  PanelQueryServiceShape
>() {}
