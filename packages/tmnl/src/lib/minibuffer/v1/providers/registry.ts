/**
 * Provider Registry
 *
 * Runtime registry for completion providers.
 * Providers can be registered/unregistered dynamically.
 *
 * @module
 */

import type { ProviderId } from "../schemas/minibuffer"
import type { CompletionProvider, ProviderRegistry } from "./types"

// ─────────────────────────────────────────────────────────────
// Registry Implementation
// ─────────────────────────────────────────────────────────────

const providers = new Map<ProviderId, CompletionProvider>()

/**
 * The provider registry singleton.
 */
export const providerRegistry: ProviderRegistry = {
  register: <T>(provider: CompletionProvider<T>) => {
    providers.set(provider.id, provider as CompletionProvider)
  },

  unregister: (id: ProviderId) => {
    providers.delete(id)
  },

  get: (id: ProviderId) => providers.get(id),

  list: () => Array.from(providers.values()),

  has: (id: ProviderId) => providers.has(id),
}

/**
 * Helper to create a branded ProviderId.
 */
export function createProviderId(id: string): ProviderId {
  return id as ProviderId
}
