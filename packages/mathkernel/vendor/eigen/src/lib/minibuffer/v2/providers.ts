/**
 * Minibuffer v2 — Provider Registry
 *
 * Completion providers for command mode.
 * Providers supply completions based on input query.
 *
 * @module
 */

import { Effect } from "effect"
import type { ProviderId, Completion } from "./machine"
import type { LucideIcon } from "lucide-react"

// ============================================================================
// TYPES
// ============================================================================

/**
 * Completion provider interface.
 * Providers supply completions for a given query.
 */
export interface CompletionProvider<T = unknown> {
  readonly id: ProviderId
  readonly label: string
  readonly icon?: LucideIcon
  readonly placeholder?: string

  /**
   * Generate completions for query.
   * Returns Effect that resolves to array of completions.
   */
  complete: (query: string) => Effect.Effect<readonly Completion[], unknown, unknown>

  /**
   * Called when user selects a completion.
   */
  onSelect?: (completion: Completion) => Effect.Effect<void, unknown, unknown>

  /**
   * Transform input before passing to complete().
   * E.g., strip "M-x " prefix.
   */
  transformInput?: (input: string) => string
}

/**
 * Provider registry interface.
 */
export interface ProviderRegistry {
  register: (provider: CompletionProvider) => void
  unregister: (id: ProviderId) => void
  get: (id: ProviderId) => CompletionProvider | undefined
  getAll: () => ReadonlyArray<CompletionProvider>
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Create a branded ProviderId from a string.
 */
export function createProviderId(id: string): ProviderId {
  return id as ProviderId
}

/**
 * Well-known provider ID for the command palette (M-x).
 */
export const COMMAND_PROVIDER_ID = createProviderId("commands")

// ============================================================================
// REGISTRY SINGLETON
// ============================================================================

const providers = new Map<ProviderId, CompletionProvider>()

/**
 * Global provider registry.
 * Providers register here; minibuffer looks them up by ID.
 */
export const providerRegistry: ProviderRegistry = {
  register(provider: CompletionProvider): void {
    providers.set(provider.id, provider)
  },

  unregister(id: ProviderId): void {
    providers.delete(id)
  },

  get(id: ProviderId): CompletionProvider | undefined {
    return providers.get(id)
  },

  getAll(): ReadonlyArray<CompletionProvider> {
    return Array.from(providers.values())
  },
}

/**
 * Get completions from a provider.
 * Handles input transformation and error recovery.
 */
export const getCompletions = (
  providerId: ProviderId,
  query: string
): Effect.Effect<readonly Completion[], never, never> =>
  Effect.gen(function* () {
    const provider = providerRegistry.get(providerId)
    if (!provider) {
      yield* Effect.logWarning(`Provider not found: ${providerId}`)
      return []
    }

    const transformedQuery = provider.transformInput
      ? provider.transformInput(query)
      : query

    const completions = yield* provider.complete(transformedQuery).pipe(
      Effect.catchAll((error) => {
        Effect.logWarning(`Provider ${providerId} failed: ${error}`)
        return Effect.succeed([] as const)
      })
    )

    return completions
  })

/**
 * Execute provider's onSelect handler.
 */
export const executeSelection = (
  providerId: ProviderId,
  completion: Completion
): Effect.Effect<void, never, never> =>
  Effect.gen(function* () {
    console.log('[Minibuffer] executeSelection:', providerId, completion.value)
    const provider = providerRegistry.get(providerId)
    if (!provider?.onSelect) {
      console.log('[Minibuffer] Provider has no onSelect handler')
      return
    }

    console.log('[Minibuffer] Calling provider.onSelect...')
    yield* provider.onSelect(completion).pipe(
      Effect.catchAll((error) => {
        console.error('[Minibuffer] onSelect failed:', error)
        return Effect.void
      })
    )
    console.log('[Minibuffer] onSelect completed')
  })
