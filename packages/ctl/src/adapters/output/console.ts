/**
 * Console Output Adapter
 *
 * Human-readable output for inline mode (default).
 * Uses Effect Console for terminal output.
 *
 * @module @gbg/ctl/adapters/output/console
 */

import { Console, Effect, Layer } from "effect"
import type { OutputPort, RenderContext } from "../../core/ports/output.js"
import { Output, isTty, getTerminalSize } from "../../core/ports/output.js"
import { formatTable } from "../../messaging/index.js"

// =============================================================================
// CONSOLE OUTPUT ADAPTER
// =============================================================================

const make: OutputPort = {
  text: (content) => Console.log(content),

  table: (data, columns) =>
    Console.log(
      formatTable(
        data as Record<string, unknown>[],
        columns.map((c) => ({ key: c.key as string, header: c.header, width: c.width }))
      )
    ),

  success: (message, details) =>
    Effect.gen(function* () {
      yield* Console.log(`✓ ${message}`)
      if (details) {
        for (const [key, value] of Object.entries(details)) {
          yield* Console.log(`  ${key}: ${value}`)
        }
      }
    }),

  error: (message, details) =>
    Effect.gen(function* () {
      yield* Console.error(`✗ ${message}`)
      if (details) {
        for (const [key, value] of Object.entries(details)) {
          yield* Console.error(`  ${key}: ${value}`)
        }
      }
    }),

  warning: (message) => Console.warn(`⚠ ${message}`),

  spinner: (label) =>
    Effect.sync(() => {
      const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
      let i = 0
      const interval = setInterval(() => {
        process.stdout.write(`\r${frames[i++ % frames.length]} ${label}`)
      }, 80)
      return {
        stop: () => {
          clearInterval(interval)
          process.stdout.write("\r" + " ".repeat(label.length + 3) + "\r")
        },
      }
    }),

  progress: (label, value, max = 100) =>
    Effect.sync(() => {
      const percent = Math.round((value / max) * 100)
      const barWidth = 20
      const filled = Math.round((value / max) * barWidth)
      const bar = "█".repeat(filled) + "░".repeat(barWidth - filled)
      process.stdout.write(`\r${label} [${bar}] ${percent}%`)
      if (value >= max) {
        process.stdout.write("\n")
      }
    }),

  agentOutput: (output) =>
    // In console mode, format agent output as human-readable
    Effect.gen(function* () {
      yield* Console.log(`[${output.status.toUpperCase()}] ${output.command}`)
      if (output.result) {
        yield* Console.log(JSON.stringify(output.result, null, 2))
      }
      if (output.error) {
        yield* Console.error(`Error: ${output.error.message}`)
        if (output.error.suggestion) {
          yield* Console.log(`Suggestion: ${output.error.suggestion}`)
        }
      }
      if (output.actions.length > 0) {
        yield* Console.log("\nAvailable actions:")
        for (const action of output.actions) {
          yield* Console.log(`  - ${action.name}: ${action.command}`)
        }
      }
    }),

  json: (data) => Console.log(JSON.stringify(data, null, 2)),

  clear: () =>
    Effect.sync(() => {
      process.stdout.write("\x1b[2J\x1b[H")
    }),

  getContext: () =>
    Effect.sync((): RenderContext => {
      const size = getTerminalSize()
      return {
        mode: "inline",
        isTty: isTty(),
        width: size?.width,
        height: size?.height,
      }
    }),
}

// =============================================================================
// LAYER
// =============================================================================

export const ConsoleOutputLayer = Layer.succeed(Output, make)
