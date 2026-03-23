/**
 * Panel Eval Tool — stub module.
 *
 * Forward declaration for the panel_eval harness tool.
 * Actual implementation pending in the panel subsystem.
 *
 * @module
 */

import { Effect } from "effect"
import type { PanelQueryServiceShape } from "./schemas"

// ── Constants ───────────────────────────────────────

export const PANEL_EVAL_TOOL_NAME = "panel_eval" as const

// ── Tool Spec ───────────────────────────────────────

export const PanelEvalToolSpec = {
  name: PANEL_EVAL_TOOL_NAME,
  description: "Execute code in the panel evaluation context to query or manipulate panel state.",
  parameters: {
    type: "object" as const,
    properties: {
      code: {
        type: "string" as const,
        description: "The code to evaluate in the panel context",
      },
    },
    required: ["code"] as const,
  },
}

// ── Execution ───────────────────────────────────────

/**
 * Execute panel evaluation code.
 * Stub — returns a placeholder until the panel subsystem is implemented.
 */
export function executePanelEvalCode(
  code: string,
  _panelQueryService: PanelQueryServiceShape,
  _context?: unknown,
  _subscriptionManager?: unknown,
): Effect.Effect<string, Error> {
  return Effect.succeed(`[panel_eval stub] code=${code.slice(0, 100)}`)
}
