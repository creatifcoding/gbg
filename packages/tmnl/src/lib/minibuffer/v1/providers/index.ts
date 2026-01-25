/**
 * Minibuffer Providers
 *
 * Completion provider registry for the minibuffer.
 *
 * ARCHITECTURAL NOTE:
 * The minibuffer is a GENERIC prompt engine. It knows nothing about commands.
 * CommandProvider lives in `@/lib/commands/CommandProvider.ts` and registers
 * itself with this registry. The dependency flows one way:
 *
 *   commands/ → minibuffer/ (not the reverse)
 *
 * DO NOT auto-register providers here. Providers should register themselves
 * at their own module level or via explicit initialization.
 *
 * @module
 */

import { providerRegistry, createProviderId } from "./registry"

// ─────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────

export { providerRegistry, createProviderId }
export type { CompletionProvider, ProviderRegistry, ProviderReadOptions } from "./types"

// ─────────────────────────────────────────────────────────────
// DEPRECATED: CommandProvider has moved to @/lib/commands/
// ─────────────────────────────────────────────────────────────
// Re-export for backwards compatibility (will be removed)
export { CommandProvider, COMMAND_PROVIDER_ID } from "./CommandProvider"
