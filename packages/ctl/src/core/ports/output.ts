/**
 * Output Port
 *
 * Interface for rendering output across modes (inline, agent, tui).
 * Adapters implement this port for Ink, Agent JSON, and OpenTUI.
 *
 * @module @gbg/ctl/core/ports/output
 */

import { Context, Effect } from "effect"
import type { OutputMode, CtlAgentOutput } from "../domain/index.js"

// =============================================================================
// OUTPUT PORT INTERFACE
// =============================================================================

/**
 * Render context passed to output operations
 */
export interface RenderContext {
  /** Current output mode */
  readonly mode: OutputMode
  /** Whether output is a TTY */
  readonly isTty: boolean
  /** Terminal width (if available) */
  readonly width?: number
  /** Terminal height (if available) */
  readonly height?: number
}

/**
 * Output port interface - implemented by mode-specific adapters
 */
export interface OutputPort {
  /**
   * Render text output
   */
  readonly text: (content: string) => Effect.Effect<void>

  /**
   * Render a table
   */
  readonly table: <T extends Record<string, unknown>>(
    data: readonly T[],
    columns: readonly { key: keyof T; header: string; width?: number }[]
  ) => Effect.Effect<void>

  /**
   * Render success message
   */
  readonly success: (message: string, details?: Record<string, string>) => Effect.Effect<void>

  /**
   * Render error message
   */
  readonly error: (message: string, details?: Record<string, string>) => Effect.Effect<void>

  /**
   * Render warning message
   */
  readonly warning: (message: string) => Effect.Effect<void>

  /**
   * Render spinner (for async operations)
   */
  readonly spinner: (label: string) => Effect.Effect<{ stop: () => void }>

  /**
   * Render progress bar
   */
  readonly progress: (label: string, value: number, max?: number) => Effect.Effect<void>

  /**
   * Render structured agent output (for --agent mode)
   */
  readonly agentOutput: (output: CtlAgentOutput) => Effect.Effect<void>

  /**
   * Render JSON (pretty or compact based on mode)
   */
  readonly json: (data: unknown) => Effect.Effect<void>

  /**
   * Clear the screen (TUI mode only, no-op in others)
   */
  readonly clear: () => Effect.Effect<void>

  /**
   * Get current render context
   */
  readonly getContext: () => Effect.Effect<RenderContext>
}

// =============================================================================
// OUTPUT SERVICE TAG
// =============================================================================

/**
 * Output service tag for dependency injection
 */
export class Output extends Context.Tag("ctl/Output")<Output, OutputPort>() {}

// =============================================================================
// MODE DETECTION
// =============================================================================

/**
 * Detect output mode from CLI args and environment
 */
export const detectOutputMode = (args: {
  agent?: boolean
  tui?: boolean
  json?: boolean
}): OutputMode => {
  if (args.tui) return "tui"
  if (args.agent || args.json) return "agent"
  return "inline"
}

/**
 * Check if running in TTY
 */
export const isTty = (): boolean =>
  typeof process !== "undefined" &&
  process.stdout?.isTTY === true

/**
 * Get terminal dimensions
 */
export const getTerminalSize = (): { width: number; height: number } | undefined => {
  if (typeof process !== "undefined" && process.stdout?.columns) {
    return {
      width: process.stdout.columns,
      height: process.stdout.rows ?? 24,
    }
  }
  return undefined
}
