/**
 * TMNL Hotkeys — CommandRegistry Service
 *
 * @deprecated Use atoms + hotkeyActions instead. This service maintains its own
 * Effect.Ref state which is OPAQUE to effect-atom reactivity.
 *
 * Migration:
 *   CommandRegistry.register(config, handler)
 *     → hotkeyActions.registerCommand(registry, config, handler)
 *
 *   CommandRegistry.get(id)
 *     → commands.get(id) where commands = useAtomValue(commandsSourceAtom)
 *
 *   CommandRegistry.search(query)
 *     → searchCommands(commands, query) from '@/lib/hotkeys'
 *
 * This file will be removed in a future version.
 *
 * ---
 * Original description:
 * Central registry for all commands in the system.
 * Commands are Effect programs that can be executed by the HotkeyManager.
 */

import { Context, Effect, Layer, Ref, Option, Array as Arr } from 'effect'
import type { Command, CommandConfig, CommandContext, CommandError } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Service Definition
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandRegistryService {
  /** Register a command with its handler */
  readonly register: <R>(
    config: CommandConfig,
    handler: Effect.Effect<void, CommandError, R>
  ) => Effect.Effect<void>

  /** Unregister a command */
  readonly unregister: (id: string) => Effect.Effect<boolean>

  /** Get a command by ID */
  readonly get: (id: string) => Effect.Effect<Option.Option<Command>>

  /** Check if a command exists */
  readonly has: (id: string) => Effect.Effect<boolean>

  /** List all commands */
  readonly list: () => Effect.Effect<readonly Command[]>

  /** List commands in a category */
  readonly listByCategory: (category: string) => Effect.Effect<readonly Command[]>

  /** Search commands with fuzzy matching (for command palette) */
  readonly search: (query: string) => Effect.Effect<readonly CommandSearchResult[]>

  /** Get all unique categories */
  readonly categories: () => Effect.Effect<readonly string[]>
}

export class CommandRegistry extends Context.Tag('tmnl/hotkeys/CommandRegistry')<
  CommandRegistry,
  CommandRegistryService
>() {
  static Default = Layer.effect(
    this,
    Effect.gen(function* () {
      const commandsRef = yield* Ref.make<Map<string, Command>>(new Map())
      return CommandRegistry.of(makeCommandRegistry(commandsRef))
    })
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Result Type
// ─────────────────────────────────────────────────────────────────────────────

export interface CommandSearchResult {
  readonly command: Command
  readonly score: number
  readonly matches: readonly [number, number][] // Index ranges of matched characters
}

// ─────────────────────────────────────────────────────────────────────────────
// Fuzzy Search Implementation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple fuzzy search scoring
 *
 * Returns a score (0-1) based on:
 * - Character matches
 * - Consecutive matches bonus
 * - Start-of-word bonus
 */
function fuzzyMatch(pattern: string, text: string): { score: number; matches: [number, number][] } | null {
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
      // Start of match run
      if (matchStart === -1) {
        matchStart = textIdx
      }

      // Score bonuses
      score += 1 // Base match
      score += consecutiveBonus * 0.5 // Consecutive bonus
      consecutiveBonus++

      // Word start bonus
      if (textIdx === 0 || /[\s._-]/.test(text[textIdx - 1])) {
        score += 2
      }

      patternIdx++
    } else {
      // End of match run
      if (matchStart !== -1) {
        matches.push([matchStart, textIdx])
        matchStart = -1
      }
      consecutiveBonus = 0
    }
  }

  // Close final match run
  if (matchStart !== -1) {
    matches.push([matchStart, patternIdx + matchStart])
  }

  // Did we match all pattern characters?
  if (patternIdx !== patternLower.length) {
    return null
  }

  // Normalize score
  const normalizedScore = score / (patternLower.length * 3.5)

  return {
    score: Math.min(1, normalizedScore),
    matches,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Implementation
// ─────────────────────────────────────────────────────────────────────────────

function makeCommandRegistry(
  commandsRef: Ref.Ref<Map<string, Command>>
): CommandRegistryService {
  const register = <R>(
    config: CommandConfig,
    handler: Effect.Effect<void, CommandError, R>
  ): Effect.Effect<void> => {
    return Ref.update(commandsRef, (commands) => {
      const newCommands = new Map(commands)
      const command: Command = {
        ...config,
        handler: handler as Effect.Effect<void, CommandError, never>,
      }
      newCommands.set(config.id, command)
      return newCommands
    })
  }

  const unregister = (id: string): Effect.Effect<boolean> => {
    return Ref.modify(commandsRef, (commands) => {
      const existed = commands.has(id)
      if (existed) {
        const newCommands = new Map(commands)
        newCommands.delete(id)
        return [true, newCommands]
      }
      return [false, commands]
    })
  }

  const get = (id: string): Effect.Effect<Option.Option<Command>> => {
    return Effect.map(Ref.get(commandsRef), (commands) =>
      Option.fromNullable(commands.get(id))
    )
  }

  const has = (id: string): Effect.Effect<boolean> => {
    return Effect.map(Ref.get(commandsRef), (commands) => commands.has(id))
  }

  const list = (): Effect.Effect<readonly Command[]> => {
    return Effect.map(Ref.get(commandsRef), (commands) =>
      Array.from(commands.values())
    )
  }

  const listByCategory = (category: string): Effect.Effect<readonly Command[]> => {
    return Effect.map(list(), (commands) =>
      commands.filter((cmd) => cmd.category === category)
    )
  }

  const search = (query: string): Effect.Effect<readonly CommandSearchResult[]> => {
    return Effect.map(list(), (commands) => {
      const results: CommandSearchResult[] = []

      for (const command of commands) {
        // Search against name, id, and description
        const nameMatch = fuzzyMatch(query, command.name)
        const idMatch = fuzzyMatch(query, command.id)
        const descMatch = command.description
          ? fuzzyMatch(query, command.description)
          : null

        // Take best match
        const bestMatch = [nameMatch, idMatch, descMatch]
          .filter((m): m is NonNullable<typeof m> => m !== null)
          .sort((a, b) => b.score - a.score)[0]

        if (bestMatch) {
          results.push({
            command,
            score: bestMatch.score,
            matches: bestMatch.matches,
          })
        }
      }

      // Sort by score descending
      return results.sort((a, b) => b.score - a.score)
    })
  }

  const categories = (): Effect.Effect<readonly string[]> => {
    return Effect.map(list(), (commands) => {
      const cats = new Set<string>()
      for (const cmd of commands) {
        if (cmd.category) {
          cats.add(cmd.category)
        }
      }
      return Array.from(cats).sort()
    })
  }

  return {
    register,
    unregister,
    get,
    has,
    list,
    listByCategory,
    search,
    categories,
  }
}
