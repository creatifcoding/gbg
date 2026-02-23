/**
 * Panel regression assertions — expected state metadata + structured verification.
 *
 * Each checkpoint declares expected state. The runner captures actual state
 * from stx/DOM at that point. Diffs produce structured regression entries.
 *
 * @module panel-regression/assertions
 */

// ─── Expected State Schema ──────────────────────────────────────────────────

export interface ExpectedPanelState {
  /** Total panels registered in stx (all modes) */
  totalPanels?: number
  /** Panels in tiled mode (visible or collapsed) */
  tiledCount?: number
  /** Panels in floating mode */
  floatCount?: number
  /** Collapsed panels count */
  collapsedCount?: number
  /** Expanded (non-collapsed) tiled panels */
  expandedCount?: number
  /** Number of columns in the strip */
  columnCount?: number
  /** Number of collapsed columns (all children collapsed) */
  collapsedColumnCount?: number
  /** Active/focused panel position: 'col:N' or 'col:N/row:M' */
  focusPosition?: string
  /** Current strip mode displayed */
  stripMode?: 'strip' | 'tree'
  /** Overlay is visible */
  overlayOpen?: boolean
  /** Width preset of focused column */
  focusedColumnWidth?: 'narrow' | 'half' | 'wide' | 'full'
  /** Custom predicate label for assertions that don't fit above */
  custom?: string
}

// ─── Actual State (captured at runtime) ─────────────────────────────────────

export interface ActualPanelState {
  totalPanels: number
  tiledCount: number
  floatCount: number
  collapsedCount: number
  expandedCount: number
  columnCount: number
  collapsedColumnCount: number
  focusPosition: string  // 'col:N' or 'col:N/row:M' or 'none'
  stripMode: string
  overlayOpen: boolean
  focusedColumnWidth: string
  /** Raw stx data snapshot for debugging */
  raw: Record<string, unknown>
}

// ─── Regression Entry ───────────────────────────────────────────────────────

export type AssertionStatus = 'pass' | 'fail' | 'skip'

export interface AssertionResult {
  field: string
  expected: string | number | boolean
  actual: string | number | boolean
  status: AssertionStatus
}

export interface CheckpointRegression {
  checkpoint: string
  description: string
  scenarioId: string
  mode: string
  timestamp: string
  screenshotPath: string
  assertions: AssertionResult[]
  passed: boolean
  actual: ActualPanelState
  expected: ExpectedPanelState
}

export interface RegressionReport {
  runId: string
  timestamp: string
  totalCheckpoints: number
  passedCheckpoints: number
  failedCheckpoints: number
  regressions: CheckpointRegression[]
  /** Only failed entries for quick triage */
  failures: CheckpointRegression[]
}

// ─── State Capture (JS to eval in browser) ──────────────────────────────────

/**
 * Returns a JS expression string that, when eval'd in the browser,
 * produces an ActualPanelState JSON string.
 *
 * Uses dynamic import() to access the stx singleton, then reads
 * Legend State observables via .peek() (no subscription, just snapshot).
 */
export const CAPTURE_STATE_EXPR = `
(async () => {
  try {
    const mod = await import('/src/lib/floating/stx/instance.ts');
    const stx = mod.getFloatingStx();
    if (!stx) return JSON.stringify({ error: 'stx not initialized' });

    // Legend State .peek() reads without subscribing
    const d = stx.data;
    const peek = (field) => {
      const f = d[field];
      return (typeof f?.peek === 'function') ? f.peek() : f;
    };

    const panelsMap = peek('panels');
    const strip = peek('strip');
    const activeId = peek('activePanel');
    const zOrder = peek('zOrder');

    // Materialize panels from Map or Legend-State observable Map
    const panels = [];
    if (panelsMap && typeof panelsMap.forEach === 'function') {
      panelsMap.forEach((p) => {
        // Each panel might also be an observable — peek its fields
        const get = (obj, key) => {
          const v = obj[key];
          return (v && typeof v.peek === 'function') ? v.peek() : v;
        };
        panels.push({
          id: get(p, 'id'),
          mode: get(p, 'mode'),
          isCollapsed: get(p, 'isCollapsed'),
        });
      });
    }

    // Count states
    let tiled = 0, floating = 0, collapsed = 0, expanded = 0;
    for (const p of panels) {
      if (p.mode === 'tiled') {
        tiled++;
        if (p.isCollapsed) collapsed++;
        else expanded++;
      } else if (p.mode === 'floating') {
        floating++;
      }
    }

    // Column analysis from strip
    const columns = strip?.columns ?? [];
    const columnCount = columns.length;
    let collapsedColumnCount = 0;

    const collectIds = (node) => {
      if (!node) return [];
      const n = (typeof node.peek === 'function') ? node.peek() : node;
      if (n.type === 'leaf') return [n.panelId];
      if (n.children) return n.children.flatMap(collectIds);
      return [];
    };

    for (const col of columns) {
      const c = (typeof col.peek === 'function') ? col.peek() : col;
      const ids = collectIds(c.tree);
      if (ids.length > 0) {
        const allCollapsed = ids.every(id => {
          const p = panels.find(pp => pp.id === id);
          return p?.isCollapsed;
        });
        if (allCollapsed) collapsedColumnCount++;
      }
    }

    // Focus position
    let focusPosition = 'none';
    if (activeId) {
      for (let ci = 0; ci < columns.length; ci++) {
        const c = (typeof columns[ci].peek === 'function') ? columns[ci].peek() : columns[ci];
        const ids = collectIds(c.tree);
        const idx = ids.indexOf(activeId);
        if (idx >= 0) {
          focusPosition = ids.length === 1 ? 'col:' + ci : 'col:' + ci + '/row:' + idx;
          break;
        }
      }
    }

    // Width of focused column
    let focusedColumnWidth = 'unknown';
    if (activeId) {
      for (const col of columns) {
        const c = (typeof col.peek === 'function') ? col.peek() : col;
        const ids = collectIds(c.tree);
        if (ids.includes(activeId)) {
          focusedColumnWidth = c.width ?? 'unknown';
          break;
        }
      }
    }

    // Overlay
    const overlayOpen = !!document.querySelector('[data-panel-workspace-overlay]');

    return JSON.stringify({
      totalPanels: panels.length,
      tiledCount: tiled,
      floatCount: floating,
      collapsedCount: collapsed,
      expandedCount: expanded,
      columnCount,
      collapsedColumnCount,
      focusPosition,
      stripMode: 'unknown',
      overlayOpen,
      focusedColumnWidth,
      raw: {
        activePanel: activeId,
        zOrderLen: Array.isArray(zOrder) ? zOrder.length : 0,
        stripColumnsLen: columnCount,
        panelIds: panels.map(p => p.id),
      },
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
})()
`

// ─── Assertion Engine ───────────────────────────────────────────────────────

/**
 * Compare expected vs actual state, producing structured assertion results.
 */
export function assertState(
  expected: ExpectedPanelState,
  actual: ActualPanelState,
): AssertionResult[] {
  const results: AssertionResult[] = []

  const check = (
    field: string,
    exp: string | number | boolean | undefined,
    act: string | number | boolean,
  ) => {
    if (exp === undefined) return // skip unspecified fields
    results.push({
      field,
      expected: exp,
      actual: act,
      status: exp === act ? 'pass' : 'fail',
    })
  }

  check('totalPanels', expected.totalPanels, actual.totalPanels)
  check('tiledCount', expected.tiledCount, actual.tiledCount)
  check('floatCount', expected.floatCount, actual.floatCount)
  check('collapsedCount', expected.collapsedCount, actual.collapsedCount)
  check('expandedCount', expected.expandedCount, actual.expandedCount)
  check('columnCount', expected.columnCount, actual.columnCount)
  check('collapsedColumnCount', expected.collapsedColumnCount, actual.collapsedColumnCount)
  check('focusPosition', expected.focusPosition, actual.focusPosition)
  check('stripMode', expected.stripMode, actual.stripMode)
  check('overlayOpen', expected.overlayOpen, actual.overlayOpen)
  check('focusedColumnWidth', expected.focusedColumnWidth, actual.focusedColumnWidth)

  return results
}

/**
 * Build a CheckpointRegression from a checkpoint run.
 */
export function buildCheckpointRegression(
  checkpoint: string,
  description: string,
  scenarioId: string,
  mode: string,
  screenshotPath: string,
  expected: ExpectedPanelState,
  actual: ActualPanelState,
): CheckpointRegression {
  const assertions = assertState(expected, actual)
  return {
    checkpoint,
    description,
    scenarioId,
    mode,
    timestamp: new Date().toISOString(),
    screenshotPath,
    assertions,
    passed: assertions.every(a => a.status !== 'fail'),
    actual,
    expected,
  }
}

/**
 * Build the final regression report from all checkpoint results.
 */
export function buildRegressionReport(
  runId: string,
  regressions: CheckpointRegression[],
): RegressionReport {
  const passed = regressions.filter(r => r.passed).length
  const failed = regressions.filter(r => !r.passed).length

  return {
    runId,
    timestamp: new Date().toISOString(),
    totalCheckpoints: regressions.length,
    passedCheckpoints: passed,
    failedCheckpoints: failed,
    regressions,
    failures: regressions.filter(r => !r.passed),
  }
}

// ─── Pretty Print ───────────────────────────────────────────────────────────

/**
 * Format regression report for console output.
 */
export function formatRegressionReport(report: RegressionReport): string {
  const lines: string[] = []

  lines.push(`\n🔍 Regression Report: ${report.runId}`)
  lines.push(`   ${report.totalCheckpoints} checkpoints: ${report.passedCheckpoints} ✅ ${report.failedCheckpoints} ❌`)

  if (report.failures.length === 0) {
    lines.push(`\n   All assertions passed.`)
    return lines.join('\n')
  }

  lines.push(`\n❌ Failures:\n`)

  for (const f of report.failures) {
    lines.push(`   📍 ${f.scenarioId} [${f.mode}] → ${f.checkpoint}`)
    lines.push(`      ${f.description}`)

    for (const a of f.assertions.filter(a => a.status === 'fail')) {
      lines.push(`      ✗ ${a.field}: expected ${JSON.stringify(a.expected)}, got ${JSON.stringify(a.actual)}`)
    }

    lines.push(`      📸 ${f.screenshotPath}`)
    lines.push('')
  }

  return lines.join('\n')
}
