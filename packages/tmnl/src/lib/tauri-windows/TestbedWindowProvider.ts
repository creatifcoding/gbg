/**
 * Testbed Window Provider
 *
 * Minibuffer provider for opening testbeds in separate Tauri windows.
 * Shows testbed list with (open) indicator for windows already open.
 *
 * @module lib/tauri-windows/TestbedWindowProvider
 */

import { Effect } from 'effect'
import { LayoutGrid } from 'lucide-react'
import {
  type CompletionProvider,
  type Completion,
  createProviderId,
  providerRegistry,
} from '@/lib/minibuffer/v2'
import {
  TESTBED_REGISTRY,
  isWindowCapable,
  type TestbedEntry,
} from '@/lib/testbed/registry'
import {
  WindowManagerService,
  WindowManagerServiceDefault,
  windowManagerRegistry,
  openWindowsAtom,
} from './manager'

// ─────────────────────────────────────────────────────────────
// Provider ID
// ─────────────────────────────────────────────────────────────

export const TESTBED_WINDOW_PROVIDER_ID = createProviderId('testbed-window')

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Check if a testbed window is currently open
 */
function isTestbedWindowOpen(testbedId: string): boolean {
  const windows = windowManagerRegistry.get(openWindowsAtom)
  const label = `testbed-${testbedId}`
  return windows.has(label)
}

/**
 * Transform testbed entry to completion
 */
function testbedToCompletion(entry: TestbedEntry): Completion {
  const isOpen = isTestbedWindowOpen(entry.id)

  return {
    value: entry.id,
    label: isOpen ? `${entry.name} (open)` : entry.name,
    description: entry.description,
    category: entry.category,
    score: isOpen ? 0.9 : 1, // Slightly lower score for open windows
  }
}

/**
 * Fuzzy match a query against a testbed entry
 */
function matchesQuery(entry: TestbedEntry, query: string): boolean {
  if (!query) return true

  const lowerQuery = query.toLowerCase()
  const searchFields = [
    entry.name.toLowerCase(),
    entry.description.toLowerCase(),
    entry.category.toLowerCase(),
    ...entry.keywords.map((k) => k.toLowerCase()),
  ]

  return searchFields.some((field) => field.includes(lowerQuery))
}

// ─────────────────────────────────────────────────────────────
// Provider Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Testbed window completion provider.
 *
 * Shows all window-capable testbeds with (open) indicator.
 * On select, opens the testbed in a new window or focuses existing.
 */
export const TestbedWindowProvider: CompletionProvider<string> = {
  id: TESTBED_WINDOW_PROVIDER_ID,
  label: 'Open Testbed Window',
  icon: LayoutGrid,
  placeholder: 'Search testbed...',

  complete: (query: string) =>
    Effect.sync(() => {
      // Get all window-capable testbeds
      const windowCapable = TESTBED_REGISTRY.filter(isWindowCapable)

      // Filter by query
      const filtered = query
        ? windowCapable.filter((entry) => matchesQuery(entry, query))
        : windowCapable

      // Transform to completions and sort
      return filtered
        .map(testbedToCompletion)
        .sort((a, b) => {
          // Sort by: open status (open first), then name
          const aOpen = a.label.includes('(open)')
          const bOpen = b.label.includes('(open)')
          if (aOpen !== bOpen) return aOpen ? -1 : 1
          return a.label.localeCompare(b.label)
        })
    }),

  onSelect: (item: Completion) =>
    Effect.gen(function* () {
      const testbedId = item.value as string
      console.log('[TestbedWindowProvider] onSelect called:', testbedId)
      yield* Effect.logInfo(`Opening testbed window: ${testbedId}`)

      const svc = yield* WindowManagerService
      console.log('[TestbedWindowProvider] Got WindowManagerService')

      // Get testbed entry for window config
      const entry = TESTBED_REGISTRY.find((e) => e.id === testbedId)

      // Create or focus the testbed window
      const label = yield* svc.getOrFocusTestbedWindow(testbedId, {
        title: entry ? `TMNL - ${entry.name}` : undefined,
        width: entry?.windowConfig?.width,
        height: entry?.windowConfig?.height,
        min_width: entry?.windowConfig?.minWidth,
        min_height: entry?.windowConfig?.minHeight,
      })

      console.log('[TestbedWindowProvider] Window ready:', label)
      yield* Effect.logInfo(`Window ready: ${label}`)
    }).pipe(
      Effect.provide(WindowManagerServiceDefault),
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          console.error('[TestbedWindowProvider] ERROR:', error)
          yield* Effect.logWarning(
            `Failed to open testbed window: ${JSON.stringify(error)}`
          )
        })
      )
    ),

  transformInput: (input: string) => {
    // Strip any prefix if needed
    return input.trim()
  },
}

// ─────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────

/**
 * Register TestbedWindowProvider with minibuffer.
 * Call this at app initialization.
 */
export function registerTestbedWindowProvider(): void {
  providerRegistry.register(TestbedWindowProvider)
}
