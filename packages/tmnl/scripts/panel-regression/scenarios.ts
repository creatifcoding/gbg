/**
 * Pre-defined + combinatorial scenario generators.
 *
 * @module panel-regression/scenarios
 */

import type { Scenario, Step } from './types'
import { petname } from './petnames'
import {
  spawn, vsplit, hsplit, collapse, close,
  focusLeft, focusRight, focusUp, focusDown,
  swapLeft, swapRight, widthCycle, toggleOverlay,
  repeat, checkpoint, navigate,
} from './ops'

// ─── Helpers ────────────────────────────────────────────────────────────────

function scenario(
  title: string,
  description: string,
  steps: Step[],
  opts: { modes?: Scenario['modes']; tags?: string[] } = {},
): Scenario {
  return {
    id: petname(),
    title,
    description,
    steps,
    modes: opts.modes ?? ['strip'],
    tags: opts.tags ?? [],
  }
}

// ─── Pre-defined Regression Scenarios ───────────────────────────────────────

/**
 * S1: Basic collapse — single panel collapse/expand roundtrip.
 */
export const basicCollapse = scenario(
  'Basic collapse roundtrip',
  'Spawn one panel, collapse it, verify 36px strip, expand it back',
  [
    toggleOverlay,
    spawn,
    checkpoint('spawned', 'Single panel visible', {
      totalPanels: 1, tiledCount: 1, floatCount: 0,
      collapsedCount: 0, expandedCount: 1, columnCount: 1,
      overlayOpen: true,
    }),
    collapse,
    checkpoint('collapsed', 'Panel collapsed to 36px strip', {
      totalPanels: 1, tiledCount: 1, collapsedCount: 1,
      expandedCount: 0, columnCount: 1, collapsedColumnCount: 1,
    }),
    collapse,  // toggle back
    checkpoint('expanded', 'Panel expanded back', {
      totalPanels: 1, tiledCount: 1, collapsedCount: 0,
      expandedCount: 1, columnCount: 1, collapsedColumnCount: 0,
    }),
  ],
  { modes: ['strip', 'tree'], tags: ['collapse', 'smoke'] },
)

/**
 * S2: Vsplit + collapse both — two panels in a column, collapse both.
 */
export const vsplitCollapseBoth = scenario(
  'Vsplit + collapse both',
  'Spawn, vsplit, collapse both panels, verify column auto-collapses',
  [
    toggleOverlay,
    spawn,
    vsplit,
    checkpoint('vsplit-done', 'Two panels stacked vertically', {
      totalPanels: 2, tiledCount: 2, collapsedCount: 0,
      expandedCount: 2, columnCount: 1,
    }),
    collapse,
    focusUp,
    collapse,
    checkpoint('both-collapsed', 'Both panels collapsed — column should auto-collapse in strip', {
      totalPanels: 2, tiledCount: 2, collapsedCount: 2,
      expandedCount: 0, columnCount: 1, collapsedColumnCount: 1,
    }),
  ],
  { modes: ['both'], tags: ['collapse', 'vsplit'] },
)

/**
 * S3: Vsplit + hsplit — the mixed split regression.
 * Column tree: vertical(Conductor, horizontal(Panel1, Panel2))
 */
export const vsplitHsplit = scenario(
  'Vsplit + hsplit mixed layout',
  'Spawn, vsplit, hsplit creates nested horizontal within vertical column',
  [
    toggleOverlay,
    spawn,
    vsplit,
    hsplit,
    checkpoint('mixed-layout', '3 panels: top + bottom-left + bottom-right', {
      totalPanels: 3, tiledCount: 3, collapsedCount: 0,
      expandedCount: 3, columnCount: 1,
    }),
    // Collapse bottom two, keep top
    collapse,  // Panel 2 (focused, bottom-right)
    focusLeft,
    collapse,  // Panel 1 (bottom-left)
    checkpoint('bottom-collapsed', 'Bottom row collapsed, top panel expanded', {
      totalPanels: 3, tiledCount: 3, collapsedCount: 2,
      expandedCount: 1, columnCount: 1, collapsedColumnCount: 0,
    }),
    // Collapse top too
    focusUp,
    collapse,
    checkpoint('all-collapsed', 'All 3 collapsed — column auto-collapses', {
      totalPanels: 3, tiledCount: 3, collapsedCount: 3,
      expandedCount: 0, columnCount: 1, collapsedColumnCount: 1,
    }),
  ],
  { modes: ['both'], tags: ['collapse', 'vsplit', 'hsplit', 'text-rotation'] },
)

/**
 * S4: Full regression — spawn x2, vsplit, hsplit, vsplit, collapse selectively.
 * The tree: Col1(Conductor1), Col2(vertical(Conductor2, horizontal(Panel1, vertical(Panel2, Panel3))))
 */
export const fullTreeRegression = scenario(
  'Full tree regression (5 panels)',
  'spawn x2 → vsplit → hsplit → vsplit → collapse bottom 3 → verify text rotation',
  [
    toggleOverlay,
    spawn,
    spawn,
    vsplit,
    hsplit,
    vsplit,
    checkpoint('five-panels', '5 panels in 2 columns, complex tree', {
      totalPanels: 5, tiledCount: 5, floatCount: 0,
      collapsedCount: 0, expandedCount: 5, columnCount: 2,
    }),
    // Collapse Panel 3 (focused)
    collapse,
    // Navigate to Panel 2, collapse
    focusUp,
    collapse,
    // Navigate to Panel 1, collapse
    focusLeft,
    collapse,
    checkpoint('bottom-3-collapsed', 'Bottom 3 collapsed, both conductors expanded', {
      totalPanels: 5, tiledCount: 5, collapsedCount: 3,
      expandedCount: 2, columnCount: 2,
    }),
    // Collapse remaining
    focusUp,
    collapse,
    focusLeft,
    collapse,
    checkpoint('all-5-collapsed', 'All 5 collapsed — two 36px column strips', {
      totalPanels: 5, tiledCount: 5, collapsedCount: 5,
      expandedCount: 0, columnCount: 2, collapsedColumnCount: 2,
    }),
  ],
  { modes: ['both'], tags: ['collapse', 'text-rotation', 'tree-structure', 'regression'] },
)

/**
 * S5: Focus navigation sweep — spawn 3 columns, nav H/L and J/K.
 */
export const focusNavSweep = scenario(
  'Focus navigation sweep',
  'Spawn 3 columns, verify Alt+H/L cross-column and Alt+J/K intra-column',
  [
    toggleOverlay,
    spawn,
    spawn,
    vsplit,  // Column 2 now has 2 panels
    spawn,   // Column 3
    checkpoint('three-columns', '3 columns, col2 has vsplit', {
      totalPanels: 4, tiledCount: 4, columnCount: 3,
    }),
    // Nav right through all columns
    focusLeft,
    focusLeft,
    checkpoint('at-col1', 'Focus on column 1', {
      focusPosition: 'col:0',
    }),
    focusRight,
    checkpoint('at-col2-top', 'Focus on column 2 (top)', {
      focusPosition: 'col:1/row:0',
    }),
    focusDown,
    checkpoint('at-col2-bottom', 'Focus on column 2 (bottom)', {
      focusPosition: 'col:1/row:1',
    }),
    focusRight,
    checkpoint('at-col3', 'Focus on column 3', {
      focusPosition: 'col:2',
    }),
    // Nav back
    focusLeft,
    focusUp,
    checkpoint('back-col2-top', 'Focus back to column 2 top', {
      focusPosition: 'col:1/row:0',
    }),
  ],
  { tags: ['focus', 'navigation'] },
)

/**
 * S6: Swap operations — swap panels across and within columns.
 */
export const swapSweep = scenario(
  'Swap operations',
  'Spawn 2 columns, swap left/right, verify panel positions change',
  [
    toggleOverlay,
    spawn,
    spawn,
    checkpoint('two-columns', '2 columns side by side', {
      totalPanels: 2, columnCount: 2,
      focusPosition: 'col:1',
    }),
    swapLeft,
    checkpoint('swapped-left', 'Focused column swapped left', {
      totalPanels: 2, columnCount: 2,
      focusPosition: 'col:0',
    }),
    swapRight,
    checkpoint('swapped-right', 'Swapped back right', {
      totalPanels: 2, columnCount: 2,
      focusPosition: 'col:1',
    }),
  ],
  { tags: ['swap'] },
)

/**
 * S7: Width cycle — Alt+D through presets.
 */
export const widthCycleSweep = scenario(
  'Width cycle presets',
  'Spawn panel, cycle through narrow/half/wide/full',
  [
    toggleOverlay,
    spawn,
    checkpoint('initial-half', 'Default width: half', {
      totalPanels: 1, columnCount: 1, focusedColumnWidth: 'half',
    }),
    widthCycle,
    checkpoint('width-wide', 'Width cycled to wide', {
      focusedColumnWidth: 'wide',
    }),
    widthCycle,
    checkpoint('width-full', 'Width cycled to full', {
      focusedColumnWidth: 'full',
    }),
    widthCycle,
    checkpoint('width-narrow', 'Width cycled to narrow', {
      focusedColumnWidth: 'narrow',
    }),
    widthCycle,
    checkpoint('width-half-again', 'Width cycled back to half', {
      focusedColumnWidth: 'half',
    }),
  ],
  { tags: ['width'] },
)

/**
 * S8: Close panel — tree-aware close within column.
 */
export const closePanelTreeAware = scenario(
  'Tree-aware panel close',
  'Vsplit, close one panel, verify column survives with remaining panel',
  [
    toggleOverlay,
    spawn,
    vsplit,
    checkpoint('before-close', '2 panels in column', {
      totalPanels: 2, tiledCount: 2, columnCount: 1,
    }),
    close,
    checkpoint('after-close', '1 panel remaining in column', {
      totalPanels: 1, tiledCount: 1, columnCount: 1,
    }),
  ],
  { modes: ['both'], tags: ['close'] },
)

/**
 * S9: Strip ↔ Tree mode switch under complex collapse state.
 */
export const modeSwitchCollapsed = scenario(
  'Mode switch with collapsed panels',
  'Build complex layout, collapse some, switch modes, verify consistency',
  [
    toggleOverlay,
    spawn,
    vsplit,
    hsplit,
    checkpoint('complex-strip', 'Complex layout in strip mode', {
      totalPanels: 3, tiledCount: 3, collapsedCount: 0,
      expandedCount: 3, columnCount: 1,
    }),
    // Collapse bottom pair
    collapse,
    focusLeft,
    collapse,
    checkpoint('partial-collapse-strip', 'Bottom collapsed in strip mode', {
      totalPanels: 3, tiledCount: 3, collapsedCount: 2,
      expandedCount: 1, columnCount: 1,
    }),
    // This scenario relies on the external mode switch button
    // which we handle in the runner via snapshot + click
  ],
  { modes: ['both'], tags: ['mode-switch', 'collapse'] },
)

// ─── Combinatorial Generator ────────────────────────────────────────────────

/**
 * Generate fuzz scenarios from op combinations.
 *
 * @param depth — max ops per scenario (2-6 recommended)
 * @param count — number of scenarios to generate
 */
export function generateFuzzScenarios(depth: number, count: number): Scenario[] {
  const splitOps = [vsplit, hsplit]
  const navOps = [focusLeft, focusRight, focusUp, focusDown]
  const mutOps = [collapse, close, widthCycle]

  const scenarios: Scenario[] = []
  const rng = seedRng(42) // deterministic

  for (let i = 0; i < count; i++) {
    const steps: Step[] = [toggleOverlay]

    // Always start with 1-3 spawns
    const spawnCount = 1 + Math.floor(rng() * 3)
    for (let s = 0; s < spawnCount; s++) steps.push(spawn)
    steps.push(checkpoint('initial', `${spawnCount} panels spawned`))

    // Random ops
    for (let d = 0; d < depth; d++) {
      const category = Math.floor(rng() * 3)
      if (category === 0) {
        steps.push(splitOps[Math.floor(rng() * splitOps.length)])
      } else if (category === 1) {
        steps.push(navOps[Math.floor(rng() * navOps.length)])
      } else {
        steps.push(mutOps[Math.floor(rng() * mutOps.length)])
      }

      // Checkpoint every 2-3 ops
      if ((d + 1) % 2 === 0) {
        steps.push(checkpoint(`fuzz-${d}`, `After ${d + 1} random ops`))
      }
    }

    steps.push(checkpoint('final', 'End state'))

    scenarios.push({
      id: petname(1000 + i),
      title: `Fuzz #${i + 1} (depth=${depth}, spawns=${spawnCount})`,
      description: `Random ${depth}-op sequence with ${spawnCount} initial spawns`,
      steps,
      modes: ['strip'],
      tags: ['fuzz', `depth-${depth}`],
    })
  }

  return scenarios
}

// Simple seeded RNG (mulberry32)
function seedRng(seed: number): () => number {
  let t = seed
  return () => {
    t = (t + 0x6d2b79f5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

// ─── All pre-defined scenarios ──────────────────────────────────────────────

export const PREDEFINED: Scenario[] = [
  basicCollapse,
  vsplitCollapseBoth,
  vsplitHsplit,
  fullTreeRegression,
  focusNavSweep,
  swapSweep,
  widthCycleSweep,
  closePanelTreeAware,
  modeSwitchCollapsed,
]
