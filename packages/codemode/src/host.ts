/**
 * @module host
 *
 * CodemodeHost — the contract between the SDK and any host environment.
 * Pi implements this. Morphchat implements this. Tests implement this.
 *
 * The host provides:
 * - File system operations (cwd, read, write, shell)
 * - Rendering (format results for display)
 * - Context awareness (token budget, width)
 * - Tool registration hooks
 */

/**
 * Rendering adapter — converts raw results into host-specific display format.
 * Pi uses TUI primitives. Morphchat might use HTML. Tests use plain text.
 */
export interface RenderAdapter {
  /** Format a result value for display. Returns host-specific display object or string. */
  formatResult(result: unknown): unknown
  /** Format a code call for display (the input side). */
  formatCall(code: string): unknown
  /** Extract plain text from a rendered result (for LLM consumption). */
  extractText(rendered: unknown): string
}

/**
 * Context information available from the host.
 */
export interface HostContext {
  /** Current working directory */
  cwd: string
  /** Terminal/display width in columns (for formatting) */
  width: number
  /** Token budget info, if available */
  tokenBudget?: {
    tokens: number
    percent: number
    contextWindow: number
  }
}

/**
 * Steer formatting adapter — handles host-specific text truncation/wrapping.
 */
export interface SteerFormatter {
  /** Truncate text to fit within width columns */
  truncateToWidth(text: string, width: number): string
}

/**
 * CodemodeHost — the DI contract for any hosting environment.
 */
export interface CodemodeHost {
  /** Host context (cwd, width, token budget) */
  context: HostContext

  /** Rendering adapter */
  render: RenderAdapter

  /** Steer text formatting (optional — defaults to simple truncation) */
  steerFormatter?: SteerFormatter
}

/**
 * Minimal host for testing — no rendering, no formatting.
 */
export function createTestHost(cwd: string = process.cwd()): CodemodeHost {
  return {
    context: { cwd, width: 120 },
    render: {
      formatResult: (r) => r,
      formatCall: (c) => c,
      extractText: (r) => typeof r === 'string' ? r : JSON.stringify(r),
    },
  }
}
