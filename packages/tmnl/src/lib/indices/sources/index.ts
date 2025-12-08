/**
 * TMNL Indices Sources
 *
 * Pre-defined search sources for the indices builder.
 * Add new sources here as they are created.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Testbed Sources
// ─────────────────────────────────────────────────────────────────────────────

export {
  testbedSource,
  createCategorySource,
  dataTestbedSource,
  uiTestbedSource,
  animationTestbedSource,
  type TestbedIndexItem,
} from "./testbeds"

// ─────────────────────────────────────────────────────────────────────────────
// Future Sources (placeholders)
// ─────────────────────────────────────────────────────────────────────────────

// TODO: commands.ts - Command palette source
// TODO: routes.ts - Router source (all app routes)

// NOTE: File search is Rust-side (Tauri), NOT TypeScript.
// See src-tauri/ for implementation.
// Frontend consumes via Tauri commands/events.
// Research: ignore crate, walkdir, Tauri event streaming

// ─────────────────────────────────────────────────────────────────────────────
// Default Sources
// ─────────────────────────────────────────────────────────────────────────────

import { testbedSource } from "./testbeds"
import type { SearchItem, SearchSource } from "../types"

/**
 * Default sources for general-purpose search
 *
 * Use this when you want "all the things" searchable.
 */
export const defaultSources: readonly SearchSource<SearchItem>[] = [
  testbedSource as SearchSource<SearchItem>,
  // Add more as they become available:
  // commandSource,
  // routeSource,
]
