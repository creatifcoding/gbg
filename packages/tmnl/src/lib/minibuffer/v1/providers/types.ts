/**
 * Completion Provider Types
 *
 * Protocol for completion providers. Any system can register a provider
 * to contribute completions to the minibuffer.
 *
 * Built-in providers:
 * - CommandProvider: M-x command completion
 *
 * Future providers:
 * - FileProvider: File path completion
 * - BufferProvider: Open buffer/tab completion
 * - SymbolProvider: Code symbol completion
 *
 * @module
 */

import { Effect } from "effect"
import type { LucideIcon } from "lucide-react"
import type { ProviderId, Completion } from "../schemas/minibuffer"

// ─────────────────────────────────────────────────────────────
// Completion Provider Interface
// ─────────────────────────────────────────────────────────────

/**
 * A completion provider contributes completions to the minibuffer.
 *
 * Providers are registered at runtime and can be hot-swapped.
 * The minibuffer queries the active provider as the user types.
 */
export interface CompletionProvider<T = unknown> {
  /** Unique provider identifier */
  readonly id: ProviderId

  /** Human-readable label (shown in UI) */
  readonly label: string

  /** Optional icon for the provider */
  readonly icon?: LucideIcon

  /** Placeholder text for input (e.g., "M-x ", "Find file: ") */
  readonly placeholder?: string

  /**
   * Generate completions for the given query.
   * Called on every input change.
   *
   * @param query - Current input text
   * @returns Effect yielding completion items
   */
  readonly complete: (query: string) => Effect.Effect<readonly Completion[]>

  /**
   * Handle selection of a completion item.
   * Called when user presses Enter on a selected item.
   *
   * @param item - The selected completion
   * @returns Effect for the selection action
   */
  readonly onSelect: (item: Completion) => Effect.Effect<void>

  /**
   * Optional: Transform input before completion.
   * Useful for stripping prefixes, normalizing, etc.
   *
   * @param input - Raw input text
   * @returns Transformed input for completion
   */
  readonly transformInput?: (input: string) => string

  /**
   * Optional: Validate input before accepting.
   * Return false to prevent submission.
   *
   * @param input - Final input text
   * @returns Effect yielding validation result
   */
  readonly validate?: (input: string) => Effect.Effect<boolean>

  /**
   * Optional: Custom keyboard handler.
   * Return true to indicate the key was handled.
   *
   * @param event - Keyboard event
   * @returns Whether the event was handled
   */
  readonly onKeyDown?: (event: KeyboardEvent) => boolean
}

// ─────────────────────────────────────────────────────────────
// Provider Registry Interface
// ─────────────────────────────────────────────────────────────

/**
 * Registry for completion providers.
 * Allows dynamic registration and lookup.
 */
export interface ProviderRegistry {
  /** Register a new provider */
  readonly register: <T>(provider: CompletionProvider<T>) => void

  /** Unregister a provider by ID */
  readonly unregister: (id: ProviderId) => void

  /** Get a provider by ID */
  readonly get: (id: ProviderId) => CompletionProvider | undefined

  /** List all registered providers */
  readonly list: () => readonly CompletionProvider[]

  /** Check if a provider exists */
  readonly has: (id: ProviderId) => boolean
}

// ─────────────────────────────────────────────────────────────
// Provider Options
// ─────────────────────────────────────────────────────────────

/**
 * Options for provider-based read operations.
 */
export interface ProviderReadOptions {
  /** Initial input value */
  initialValue?: string

  /** History key for input history */
  historyKey?: string

  /** Custom prompt (overrides provider placeholder) */
  prompt?: string

  /** Whether to require a selection (vs. free-form input) */
  requireSelection?: boolean
}
