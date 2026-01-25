/**
 * Command Provider
 *
 * M-x style command completion provider.
 * Provides fuzzy-matched command completions from the hotkeys command registry.
 *
 * @module
 */

import { Effect } from "effect"
import { Terminal } from "lucide-react"
import { Atom } from "@effect-atom/atom"
import { commandsSourceAtom, searchCommands } from "@/lib/hotkeys/atoms"
import type { CompletionProvider } from "./types"
import type { ProviderId, Completion } from "../schemas/minibuffer"
import { createProviderId } from "./registry"

// ─────────────────────────────────────────────────────────────
// Provider ID
// ─────────────────────────────────────────────────────────────

export const COMMAND_PROVIDER_ID = createProviderId("commands")

// ─────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────

/**
 * M-x command completion provider.
 *
 * Integrates with the hotkeys command registry to provide
 * fuzzy-matched command completions.
 */
export const CommandProvider: CompletionProvider<string> = {
  id: COMMAND_PROVIDER_ID,
  label: "Commands",
  icon: Terminal,
  placeholder: "M-x ",

  complete: (query: string) =>
    Effect.sync(() => {
      const commands = Atom.get(commandsSourceAtom)
      const results = searchCommands(commands, query)

      // Transform to Completion format
      return results.map((r): Completion => ({
        value: r.command.id,
        label: r.command.name,
        description: r.command.description,
        category: r.command.category,
        score: r.score,
        // Could add icon mapping here based on category
      }))
    }),

  onSelect: (item: Completion) =>
    Effect.gen(function* () {
      const commandId = item.value as string
      const commands = Atom.get(commandsSourceAtom)
      const command = commands.get(commandId)

      if (!command) {
        yield* Effect.logWarning(`Command not found: ${commandId}`)
        return
      }

      // Execute the command
      yield* Effect.logInfo(`Executing command: ${commandId}`)
      yield* command.handler
    }),

  transformInput: (input: string) => {
    // Strip M-x prefix if present
    return input.replace(/^M-x\s*/, "").trim()
  },
}
