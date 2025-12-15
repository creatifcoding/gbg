/**
 * Command Provider
 *
 * M-x style command completion provider.
 * Provides fuzzy-matched command completions from CommandService.
 *
 * ARCHITECTURAL NOTE:
 * This provider lives in commands/, not minibuffer/. Minibuffer is a generic
 * prompt engine that knows nothing about commands. CommandProvider registers
 * itself with minibuffer's provider registry, but the dependency flows one way:
 *
 *   commands/ → minibuffer/ (not the reverse)
 *
 * @module
 */

import { Effect } from "effect"
import { Terminal } from "lucide-react"
import { CommandService } from "./service"
import type { Command } from "./types"
import type { CompletionProvider } from "@/lib/minibuffer/providers/types"
import type { ProviderId, Completion } from "@/lib/minibuffer/schemas/minibuffer"
import { createProviderId, providerRegistry } from "@/lib/minibuffer/providers/registry"

// ─────────────────────────────────────────────────────────────
// Provider ID
// ─────────────────────────────────────────────────────────────

export const COMMAND_PROVIDER_ID: ProviderId = createProviderId("commands")

// ─────────────────────────────────────────────────────────────
// Fuzzy Search (local implementation to avoid circular deps)
// ─────────────────────────────────────────────────────────────

interface FuzzyMatch {
  score: number
  matches: readonly [number, number][]
}

/**
 * Fuzzy search scoring for command palette.
 * Returns a score (0-1) based on character matches, consecutive bonus, and word-start bonus.
 */
function fuzzyMatch(pattern: string, text: string): FuzzyMatch | null {
  const patternLower = pattern.toLowerCase()
  const textLower = text.toLowerCase()

  if (patternLower.length === 0) {
    return { score: 1, matches: [] }
  }

  if (patternLower.length > textLower.length) {
    return null
  }

  const matches: [number, number][] = []
  let patternIdx = 0
  let matchStart = -1
  let score = 0
  let consecutiveBonus = 0

  for (let textIdx = 0; textIdx < textLower.length && patternIdx < patternLower.length; textIdx++) {
    if (textLower[textIdx] === patternLower[patternIdx]) {
      if (matchStart === -1) {
        matchStart = textIdx
      }

      score += 1
      score += consecutiveBonus * 0.5
      consecutiveBonus++

      // Start-of-word bonus
      if (textIdx === 0 || /[\s._-]/.test(text[textIdx - 1])) {
        score += 2
      }

      patternIdx++
    } else {
      if (matchStart !== -1) {
        matches.push([matchStart, textIdx])
        matchStart = -1
      }
      consecutiveBonus = 0
    }
  }

  if (matchStart !== -1) {
    matches.push([matchStart, patternIdx + matchStart])
  }

  if (patternIdx !== patternLower.length) {
    return null
  }

  const normalizedScore = score / (patternLower.length * 3.5)

  return {
    score: Math.min(1, normalizedScore),
    matches,
  }
}

/**
 * Search commands with fuzzy matching.
 */
function searchCommands(commands: readonly Command[], query: string): readonly { command: Command; score: number }[] {
  const results: { command: Command; score: number }[] = []

  for (const command of commands) {
    const nameMatch = fuzzyMatch(query, command.name)
    const idMatch = fuzzyMatch(query, command.id)
    const descMatch = command.description ? fuzzyMatch(query, command.description) : null

    const bestMatch = [nameMatch, idMatch, descMatch]
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.score - a.score)[0]

    if (bestMatch) {
      results.push({
        command,
        score: bestMatch.score,
      })
    }
  }

  return results.sort((a, b) => b.score - a.score)
}

// ─────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────

/**
 * M-x command completion provider.
 *
 * Integrates with CommandService to provide fuzzy-matched command completions.
 * Uses the commands/service.ts Effect.Service, not hotkeys atoms.
 */
export const CommandProvider: CompletionProvider<string> = {
  id: COMMAND_PROVIDER_ID,
  label: "Commands",
  icon: Terminal,
  placeholder: "M-x ",

  complete: (query: string) =>
    Effect.gen(function* () {
      const service = yield* CommandService
      const commands = yield* service.list()
      const results = searchCommands(commands, query)

      // Transform to Completion format
      return results.map((r): Completion => ({
        value: r.command.id,
        label: r.command.name,
        description: r.command.description,
        category: r.command.category,
        score: r.score,
      }))
    }).pipe(
      // Provide the service layer for standalone execution
      Effect.provide(CommandService.Default)
    ),

  onSelect: (item: Completion) =>
    Effect.gen(function* () {
      const commandId = item.value as string
      yield* Effect.logInfo(`Executing command: ${commandId}`)

      const service = yield* CommandService
      yield* service.execute(commandId)
    }).pipe(
      Effect.provide(CommandService.Default),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.logWarning(`Command execution failed: ${JSON.stringify(error)}`)
        })
      )
    ),

  transformInput: (input: string) => {
    // Strip M-x prefix if present
    return input.replace(/^M-x\s*/, "").trim()
  },
}

// ─────────────────────────────────────────────────────────────
// Auto-Registration
// ─────────────────────────────────────────────────────────────

/**
 * Register CommandProvider with minibuffer.
 * Call this once at app initialization to make M-x work.
 */
export function registerCommandProvider(): void {
  providerRegistry.register(CommandProvider)
}
