/**
 * Testbeds Search Source
 *
 * Provides testbed navigation as a search source for the indices builder.
 * Consumes data from src/lib/testbed/registry.ts
 */

import { Effect } from "effect"
import type { SearchSource } from "../types"
import {
  getSearchableTestbeds,
  type TestbedSearchItem,
} from "@/lib/testbed/registry"

// ─────────────────────────────────────────────────────────────────────────────
// Extended Item Type
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Testbed item for indices - extends registry's shape with id for SearchItem
 */
export interface TestbedIndexItem extends TestbedSearchItem {
  readonly id: string // Already present in TestbedSearchItem as "slider:v2"
}

// ─────────────────────────────────────────────────────────────────────────────
// Source Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Testbeds search source
 *
 * Narrowing key: 't' (press "t SPC" to filter to testbeds only)
 *
 * @example
 * ```ts
 * import { createIndicesBuilder } from '@/lib/indices'
 * import { testbedSource } from '@/lib/indices/sources/testbeds'
 *
 * const builder = createIndicesBuilder([testbedSource, ...otherSources])
 * ```
 */
export const testbedSource: SearchSource<TestbedIndexItem> = {
  id: "testbeds",
  name: "Testbeds",
  narrowKey: "t",
  category: "navigation",
  icon: "◈",
  accent: "cyan",
  hidden: false,

  enabled: () => true,

  items: () =>
    Effect.sync(() => {
      const items = getSearchableTestbeds()
      // Cast is safe - TestbedSearchItem already has id field
      return items as readonly TestbedIndexItem[]
    }),

  action: (item) =>
    Effect.sync(() => {
      // Navigate to testbed route
      // Using window.location for now; can be replaced with router.navigate
      if (typeof window !== "undefined") {
        window.location.href = item.route
      }
    }),

  preview: (item) =>
    Effect.succeed({
      type: "route" as const,
      route: item.route,
    }),
}

// ─────────────────────────────────────────────────────────────────────────────
// Category-filtered Sources
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a testbed source filtered to a specific category
 */
export const createCategorySource = (
  category: string,
  config: { narrowKey?: string; name?: string; icon?: string } = {}
): SearchSource<TestbedIndexItem> => ({
  ...testbedSource,
  id: `testbeds-${category}`,
  name: config.name ?? `${category.charAt(0).toUpperCase()}${category.slice(1)} Testbeds`,
  narrowKey: config.narrowKey,
  icon: config.icon ?? testbedSource.icon,

  items: () =>
    Effect.sync(() => {
      const items = getSearchableTestbeds()
      return items.filter((item) => item.category === category) as readonly TestbedIndexItem[]
    }),
})

// Pre-defined category sources (if needed)
export const dataTestbedSource = createCategorySource("data", {
  narrowKey: "d",
  icon: "◈",
})

export const uiTestbedSource = createCategorySource("ui", {
  narrowKey: "u",
  icon: "▣",
})

export const animationTestbedSource = createCategorySource("animation", {
  narrowKey: "a",
  icon: "◎",
})
