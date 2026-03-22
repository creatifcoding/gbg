/**
 * Command Provider
 *
 * M-x style command completion provider using FlexSearchDriver.
 * Provides fuzzy-matched command completions from the @/lib/search subsystem.
 *
 * ARCHITECTURAL NOTE:
 * This provider lives in commands/, not minibuffer/. Minibuffer is a generic
 * prompt engine that knows nothing about commands. CommandProvider registers
 * itself with minibuffer's provider registry, but the dependency flows one way:
 *
 *   commands/ → minibuffer/ (not the reverse)
 *
 * SEARCH SUBSYSTEM:
 * Uses FlexSearchDriver from @/lib/search - stream-first, Effect-native search.
 * Lazy initialization on first complete() call, cached for subsequent searches.
 *
 * @module
 */

import { Effect } from "effect"
import { Terminal } from "lucide-react"
import { CommandService } from "./service"
import { getRegisteredCommands, getDefaultBindings } from "./decorators"
import type { Command } from "./types"
import type { ProviderId, Completion, CompletionProvider } from "@/lib/minibuffer/v2"
import { createProviderId, providerRegistry, COMMAND_PROVIDER_ID } from "@/lib/minibuffer/v2"
import {
  createFlexSearchDriver,
  parseQuery,
  executeQuery,
  applyFilters,
  hasOperatorsOnly,
  isEmpty,
  type CommandSearchService,
  type CommandSearchItem,
} from "@/lib/search"

// Re-export for backward compatibility
export { COMMAND_PROVIDER_ID }

// ─────────────────────────────────────────────────────────────
// FlexSearch Driver (Lazy Singleton)
// ─────────────────────────────────────────────────────────────

let cachedDriver: CommandSearchService | null = null
let isIndexing = false

/**
 * Transform Command to searchable CommandSearchItem.
 */
function commandToSearchItem(command: Command): CommandSearchItem {
  const bindings = getDefaultBindings()
  const binding = bindings.find(b => b.commandId === command.id)

  return {
    id: command.id,
    name: command.name,
    description: command.description,
    category: command.category,
    scope: command.scope,
    keys: binding?.keys,
  }
}

/**
 * Get or create FlexSearch driver with indexed commands.
 * Lazy initialization - indexes on first call, cached thereafter.
 */
const getDriver = Effect.gen(function* () {
  // Return cached driver if available
  if (cachedDriver) return cachedDriver

  // Prevent concurrent indexing
  if (isIndexing) {
    // Wait a tick and retry
    yield* Effect.sleep("10 millis")
    return yield* getDriver
  }

  isIndexing = true

  try {
    // Create FlexSearch driver
    const driver = yield* createFlexSearchDriver<CommandSearchItem>()

    // Get all registered commands
    const commands = getRegisteredCommands()
    const searchItems = Array.from(commands.values()).map(commandToSearchItem)

    // Index commands
    yield* driver.index(searchItems, {
      fields: ['name', 'description', 'category', 'keys'],
    })

    // Cache for future searches
    cachedDriver = driver
    return driver
  } finally {
    isIndexing = false
  }
})

// ─────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────

/**
 * M-x command completion provider.
 *
 * Uses FlexSearchDriver from @/lib/search for fuzzy-matched command completions.
 * Stream-first: returns Stream, collects to array for Completion format.
 */
export const CommandProvider: CompletionProvider<string> = {
  id: COMMAND_PROVIDER_ID,
  label: "Commands",
  icon: Terminal,
  placeholder: "M-x ",

  complete: (query: string) =>
    Effect.gen(function* () {
      // Parse query with QueryDSL (supports regex, dorking, params)
      const parsed = yield* parseQuery(query)

      // Get all commands (needed for empty query OR operators-only query)
      const commands = getRegisteredCommands()
      const searchItems = Array.from(commands.values()).map(commandToSearchItem)

      // Empty query = return all commands sorted by name
      const mapToCompletion = (item: CommandSearchItem, score = 1): Completion => ({
        value: item.id,
        label: item.name,
        description: item.description,
        category: item.category,
        kind: "command",
        queryKind: "Commands",
        section: "Commands",
        score,
        shortcuts: undefined,
        badges: [
          {
            text: item.scope ?? "global",
            tone: item.scope === "global" ? "info" : "neutral",
          },
        ],
        metadata: {
          source: "commands",
          commandId: item.id,
          commandCategory: item.category,
          scope: item.scope,
        },
      })

      if (isEmpty(parsed)) {
        return searchItems
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((item) => mapToCompletion(item, 1))
      }

      // Operators-only query = filter all commands directly (no driver search)
      if (hasOperatorsOnly(parsed)) {
        const filtered = applyFilters(searchItems, parsed)
        return filtered.map((r) => mapToCompletion(r.item, r.score))
      }

      // Mixed query (text + operators) = use driver search + post-filters
      const driver = yield* getDriver
      const results = yield* executeQuery(driver, parsed).pipe(
        Effect.catchAll(() => Effect.succeed([] as const))
      )

      // Transform to Completion format
      return results.map((r) => mapToCompletion(r.item, r.score))
    }),

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
