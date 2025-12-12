/**
 * TMNL Testbed Registry
 *
 * Centralized registry of all testbeds with version tracking.
 * Powers the CommandBar search and card grid views.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TestbedStatus = 'active' | 'experimental' | 'deprecated' | 'stable'
export type TestbedCategory =
  | 'data'        // DataManager, Search, AG-Grid
  | 'animation'   // Animation library, GSAP, anime.js
  | 'ui'          // Slider, Modal, Drawer
  | 'state'       // Effect-Atom, Layers, Traits
  | 'input'       // Hotkeys, Keybindings, Commands
  | 'charting'    // ECharts, visualizations
  | 'canvas'      // tldraw, ReactFlow

export interface TestbedVersion {
  readonly version: string       // "v1", "v2", etc.
  readonly route: string         // "/testbed/slider-v2"
  readonly status: TestbedStatus
  readonly label?: string        // "NEW", "LEGACY", etc.
}

export interface TestbedEntry {
  readonly id: string            // "slider", "data-manager"
  readonly name: string          // "Slider", "DataManager"
  readonly description: string
  readonly category: TestbedCategory
  readonly keywords: readonly string[]  // For fuzzy search
  readonly versions: readonly TestbedVersion[]
  readonly accent?: string       // Glow color: "cyan", "rose", "amber"
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const TESTBED_REGISTRY: readonly TestbedEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'data-manager',
    name: 'DataManager',
    description: 'Effect.Service pattern with kernel architecture. FlexSearch and Linear drivers.',
    category: 'data',
    keywords: ['search', 'flexsearch', 'linear', 'kernel', 'effect', 'stream', 'hybrid'],
    accent: 'rose',
    versions: [
      { version: 'v1', route: '/testbed/data-manager/v1', status: 'stable', label: 'SINGULAR' },
      { version: 'v2', route: '/testbed/data-manager/v2', status: 'experimental', label: 'DAQ' },
      { version: 'legacy', route: '/testbed/data-manager', status: 'deprecated' },
    ],
  },
  {
    id: 'search',
    name: 'Search Lab',
    description: 'Search experimentation with different drivers and indexing strategies.',
    category: 'data',
    keywords: ['search', 'flexsearch', 'linear', 'fuzzy', 'index'],
    accent: 'rose',
    versions: [
      { version: 'v1', route: '/testbed/search', status: 'stable' },
    ],
  },
  {
    id: 'data-grid',
    name: 'AG-Grid Surface',
    description: 'AG-Grid v34 with custom TMNL theme. Cell renderers and canvas integration.',
    category: 'data',
    keywords: ['ag-grid', 'grid', 'table', 'cell', 'renderer', 'theme'],
    accent: 'amber',
    versions: [
      { version: 'v1', route: '/testbed/data-grid', status: 'stable' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANIMATION CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'animation',
    name: 'Animation',
    description: 'animatable() primitives with GSAP and anime.js drivers.',
    category: 'animation',
    keywords: ['animation', 'gsap', 'animejs', 'motion', 'tween', 'timeline'],
    accent: 'cyan',
    versions: [
      { version: 'v1', route: '/testbed', status: 'stable' },
      { version: 'v2', route: '/testbed/v2', status: 'experimental', label: 'NEW' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UI CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'slider',
    name: 'Slider',
    description: 'DAW-grade slider with runtime-swappable behaviors and precision control.',
    category: 'ui',
    keywords: ['slider', 'daw', 'range', 'behavior', 'linear', 'logarithmic', 'decibel'],
    accent: 'cyan',
    versions: [
      { version: 'v1', route: '/testbed/slider', status: 'stable', label: 'DAW' },
      { version: 'v2', route: '/testbed/slider-v2', status: 'experimental', label: 'CEW' },
    ],
  },
  {
    id: 'base-modal',
    name: 'Base Modal',
    description: 'Accessible modal primitives with focus trap and backdrop support.',
    category: 'ui',
    keywords: ['modal', 'dialog', 'focus', 'trap', 'accessible', 'a11y'],
    versions: [
      { version: 'v1', route: '/testbed/base-modal', status: 'stable' },
    ],
  },
  {
    id: 'vanta',
    name: 'Vanta Design System',
    description: 'VantaCard components with glow effects and corner accents.',
    category: 'ui',
    keywords: ['vanta', 'card', 'design', 'system', 'glow', 'theme'],
    accent: 'emerald',
    versions: [
      { version: 'v1', route: '/testbed/vanta', status: 'stable' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'effect-atom',
    name: 'Effect-Atom',
    description: 'Reactive state via Atom.runtime(). Service-scoped atoms for async flows.',
    category: 'state',
    keywords: ['effect', 'atom', 'state', 'reactive', 'runtime', 'service'],
    versions: [
      { version: 'v1', route: '/testbed/effect-atom', status: 'stable' },
    ],
  },
  {
    id: 'traits',
    name: 'Traits',
    description: 'Rust-inspired trait system for React. Slots-based injection.',
    category: 'state',
    keywords: ['trait', 'rust', 'slots', 'injection', 'provider', 'composition'],
    versions: [
      { version: 'v1', route: '/testbed/traits', status: 'stable' },
    ],
  },
  {
    id: 'capabilities',
    name: 'Capabilities',
    description: 'Layer system capabilities and z-index management.',
    category: 'state',
    keywords: ['layer', 'capability', 'zindex', 'adobe', 'photoshop'],
    versions: [
      { version: 'v1', route: '/testbed/capabilities', status: 'stable' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // INPUT CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'hotkeys',
    name: 'Hotkeys',
    description: 'Keyboard shortcut system with scoped contexts and command palette.',
    category: 'input',
    keywords: ['hotkey', 'keyboard', 'shortcut', 'command', 'palette'],
    versions: [
      { version: 'v1', route: '/testbed/hotkeys', status: 'stable' },
    ],
  },
  {
    id: 'keybindings',
    name: 'Keybindings',
    description: 'User-configurable keyboard mappings with conflict detection.',
    category: 'input',
    keywords: ['keybinding', 'keyboard', 'mapping', 'conflict', 'customize'],
    versions: [
      { version: 'v1', route: '/testbed/keybindings', status: 'stable' },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CHARTING CATEGORY
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'charting',
    name: 'Charting',
    description: 'Chart.make() factory with ECharts. Real-time streaming via RingBuffer.',
    category: 'charting',
    keywords: ['chart', 'echarts', 'line', 'bar', 'scatter', 'stream', 'ring', 'buffer'],
    accent: 'cyan',
    versions: [
      { version: 'v1', route: '/testbed/charting', status: 'stable' },
    ],
  },
  {
    id: 'indices',
    name: 'Indices Builder',
    description: 'Multi-source search composition inspired by Emacs Consult. Effect.Stream narrowing.',
    category: 'data',
    keywords: ['indices', 'search', 'consult', 'narrow', 'source', 'stream', 'composition'],
    accent: 'cyan',
    versions: [
      { version: 'v1', route: '/testbed/indices', status: 'experimental', label: 'NEW' },
    ],
  },
  {
    id: 'ava',
    name: 'AVA Client',
    description: 'Asset View Agent HTTP + WebSocket client testbed. Effect Platform integration with TmnlDataGrid.',
    category: 'data',
    keywords: ['ava', 'asset', 'view', 'agent', 'websocket', 'http', 'client', 'effect', 'stream'],
    accent: 'emerald',
    versions: [
      { version: 'v1', route: '/testbed/ava', status: 'experimental', label: 'NEW' },
    ],
  },
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (Data Access Only — Search is handled by src/lib/search consumers)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get all testbeds as flat list of { entry, version }
 */
export function getAllTestbedVersions(): ReadonlyArray<{
  entry: TestbedEntry
  version: TestbedVersion
}> {
  return TESTBED_REGISTRY.flatMap((entry) =>
    entry.versions.map((version) => ({ entry, version }))
  )
}

/**
 * Get testbeds by category
 */
export function getTestbedsByCategory(
  category: TestbedCategory
): readonly TestbedEntry[] {
  return TESTBED_REGISTRY.filter((entry) => entry.category === category)
}

/**
 * Get the primary (latest stable or first) version for a testbed
 */
export function getPrimaryVersion(entry: TestbedEntry): TestbedVersion {
  return (
    entry.versions.find((v) => v.status === 'stable') ??
    entry.versions.find((v) => v.status === 'experimental') ??
    entry.versions[0]
  )
}

/**
 * Get testbed by ID
 */
export function getTestbedById(id: string): TestbedEntry | undefined {
  return TESTBED_REGISTRY.find((entry) => entry.id === id)
}

/**
 * Category display metadata
 */
export const CATEGORY_META: Record<TestbedCategory, { label: string; icon: string }> = {
  data: { label: 'Data', icon: '◈' },
  animation: { label: 'Animation', icon: '◎' },
  ui: { label: 'UI', icon: '▣' },
  state: { label: 'State', icon: '◉' },
  input: { label: 'Input', icon: '⌨' },
  charting: { label: 'Charting', icon: '◐' },
  canvas: { label: 'Canvas', icon: '◧' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Searchable Item Shape (for src/lib/search integration)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Flattened testbed item for indexing with src/lib/search
 *
 * Usage:
 * ```ts
 * import { createFlexSearchDriver } from '@/lib/search'
 * import { getSearchableTestbeds } from '@/lib/testbed'
 *
 * const driver = await Effect.runPromise(createFlexSearchDriver<TestbedSearchItem>())
 * await Effect.runPromise(driver.index(getSearchableTestbeds(), {
 *   fields: ['name', 'description', 'keywords', 'version', 'label'],
 * }))
 * ```
 */
export interface TestbedSearchItem {
  readonly id: string           // "slider:v2"
  readonly entryId: string      // "slider"
  readonly name: string         // "Slider"
  readonly description: string
  readonly category: TestbedCategory
  readonly keywords: string     // Space-separated for indexing
  readonly version: string      // "v2"
  readonly route: string        // "/testbed/slider-v2"
  readonly status: TestbedStatus
  readonly label?: string       // "CEW", "NEW"
  readonly accent?: string      // "cyan"
}

/**
 * Convert registry to searchable items for src/lib/search
 */
export function getSearchableTestbeds(): readonly TestbedSearchItem[] {
  return TESTBED_REGISTRY.flatMap((entry) =>
    entry.versions.map((version): TestbedSearchItem => ({
      id: `${entry.id}:${version.version}`,
      entryId: entry.id,
      name: entry.name,
      description: entry.description,
      category: entry.category,
      keywords: entry.keywords.join(' '),
      version: version.version,
      route: version.route,
      status: version.status,
      label: version.label,
      accent: entry.accent,
    }))
  )
}
