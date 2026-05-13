/**
 * Datagrid Testbed
 *
 * Stress-testable testbed for @tmnl/datagrid — the reactive spreadsheet
 * abstraction built on STX as agentic state primitive.
 *
 * Route: /testbed/datagrid
 *
 * HYPOTHESES:
 * - H1: STX family atoms provide surgical cell subscriptions (0 spurious renders)
 * - H2: Bulk writes (10K+ cells) complete under 100ms
 * - H3: Formula cascades propagate reactively through derived atoms
 * - H4: CRDT merge resolves concurrent agent writes correctly (LWW)
 * - H5: AG-Grid bridge coalesces writes into batched transactions
 * - H6: Named ranges resolve A1 ↔ R1C1 ↔ alias correctly
 *
 * Architecture: @tmnl/datagrid (ServiceMap DI) + TmnlDataGrid (compound component)
 *              + STX atoms (all state) — zero useState.
 */

import { useEffect, useCallback, useMemo, useRef, memo } from 'react'
import { Effect, Layer } from 'effect-v4'
import { Atom, AtomRegistry } from 'effect-v4/unstable/reactivity'
import { stx, useStx, useFocus, useAtomDirect, type StxInstance } from '@tmnl/stx'

import {
  makeDatagridLayer,
  Datagrid,
  type DatagridShape,
  type DatagridConfigShape,
  type CellValue,
  type RangeRect,
  num, str, bool, empty, formula, json, error as cellError,
  extractDisplay, extractNumber,
  colIndexToLetter,
  cellKey,
  generateColDefs, generateDefaultColDefs,
  GridBridge,
  TransactionCollector,
  type ColumnMeta,
  type DatagridColDef,
  type GridTransaction,
  useCell, useCellDisplay, useCellNumber, useCellSetter, useClock,
} from '@tmnl/datagrid'

import { DataGrid, type DataGridRow } from '@/components/data-grid'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, type ColDef, type GridApi } from 'ag-grid-community'
import { tmnlDataGridTheme, TMNL_TOKENS } from '@/components/data-grid'

import {
  TestbedHeader,
  TestCard,
  SectionLabel,
  Button,
  ValueDisplay,
  StatusIndicator,
  CollapsiblePanel,
  DemoSection,
  HypothesisSummary,
  type ValidationStatus,
} from '@/components/testbed/shared'

ModuleRegistry.registerModules([AllCommunityModule])

// ═════════════════════════════════════════════════════════════
// STX State — all testbed state lives here, zero useState
// ═════════════════════════════════════════════════════════════

interface StressConfig {
  rows: number
  cols: number
  agentCount: number
}

interface BenchResult {
  label: string
  elapsed: number
  opsPerSec: number
  status: 'idle' | 'running' | 'done'
}

interface TestbedState {
  config: StressConfig
  datagrid: DatagridShape | null
  gridApi: GridApi | null
  hypotheses: Record<string, ValidationStatus>
  benches: BenchResult[]
  log: string[]
  activePanel: 'grid' | 'bench' | 'crdt'
  clockDisplay: number
}

const initialState: TestbedState = {
  config: { rows: 100, cols: 10, agentCount: 3 },
  datagrid: null,
  gridApi: null,
  hypotheses: {
    H1: 'pending', H2: 'pending', H3: 'pending',
    H4: 'pending', H5: 'pending', H6: 'pending',
  },
  benches: [],
  log: [],
  activePanel: 'grid',
  clockDisplay: 0,
}

const store = stx(initialState)

// ═════════════════════════════════════════════════════════════
// Memory store — in-memory cell/range backing for the Datagrid
// ═════════════════════════════════════════════════════════════

function makeMemoryStore() {
  const cells = new Map<string, CellValue>()
  const ranges = new Map<string, RangeRect>()
  const ck = (s: string, c: number, r: number) => `${s}:${c}:${r}`
  const rk = (s: string, n: string) => `${s}:${n}`

  return {
    readCell: (s: string, c: number, r: number) => cells.get(ck(s, c, r)) ?? null,
    writeCell: (s: string, c: number, r: number, v: CellValue) =>
      Effect.sync(() => { cells.set(ck(s, c, r), v) }),
    writeCellBulk: (s: string, es: ReadonlyArray<{ col: number; row: number; value: CellValue }>) =>
      Effect.sync(() => { for (const e of es) cells.set(ck(s, e.col, e.row), e.value) }),
    upsertNamedRange: (s: string, n: string, r: RangeRect) =>
      Effect.sync(() => { ranges.set(rk(s, n), r) }),
    getNamedRange: (s: string, n: string) =>
      Effect.sync(() => ranges.get(rk(s, n)) ?? null),
    listNamedRanges: (s: string) => Effect.sync(() => {
      const result: { name: string; range: RangeRect }[] = []
      for (const [k, r] of ranges) if (k.startsWith(`${s}:`))
        result.push({ name: k.slice(s.length + 1), range: r })
      return result
    }),
    deleteNamedRange: (s: string, n: string) =>
      Effect.sync(() => { ranges.delete(rk(s, n)) }),
  }
}

// ═════════════════════════════════════════════════════════════
// Logging helper
// ═════════════════════════════════════════════════════════════

function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23)
  store.modify(store.lens.log, (prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 100))
}

function addBench(b: BenchResult) {
  store.modify(store.lens.benches, (prev) => [b, ...prev])
}

function setHypothesis(id: string, status: ValidationStatus) {
  store.modify(store.lens.hypotheses, (prev) => ({ ...prev, [id]: status }))
}

// ═════════════════════════════════════════════════════════════
// Initialization
// ═════════════════════════════════════════════════════════════

async function initDatagrid() {
  const config = store.getAt(store.lens.config)
  const memStore = makeMemoryStore()

  const dgConfig: DatagridConfigShape = {
    sheetId: 'stress-sheet',
    agentId: 'agent-prime',
    ...memStore,
  }

  const layer = makeDatagridLayer(dgConfig)
  const dg = await Effect.runPromise(
    Effect.gen(function*() {
      return yield* Datagrid
    }).pipe(Effect.provide(layer)),
  )

  store.setAt(store.lens.datagrid, dg as any)
  store.setAt(store.lens.clockDisplay, dg.clock())

  log(`Datagrid initialized: ${config.rows}×${config.cols} (sheet: stress-sheet)`)
  return dg
}

// ═════════════════════════════════════════════════════════════
// Stress operations
// ═════════════════════════════════════════════════════════════

async function runBulkFill(dg: DatagridShape) {
  const { rows, cols } = store.getAt(store.lens.config)
  const total = rows * cols

  log(`Bulk fill: ${total} cells...`)
  const t0 = performance.now()

  const entries: { addr: string; value: CellValue }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      entries.push({
        addr: `${colIndexToLetter(c)}${r + 1}`,
        value: num(Math.random() * 1000),
      })
    }
  }

  await Effect.runPromise(dg.setCells(entries))
  const elapsed = performance.now() - t0

  const result: BenchResult = {
    label: `Bulk fill ${total} cells`,
    elapsed,
    opsPerSec: Math.round((total / elapsed) * 1000),
    status: 'done',
  }
  addBench(result)
  log(`Bulk fill complete: ${elapsed.toFixed(1)}ms (${result.opsPerSec.toLocaleString()} ops/sec)`)

  // H2: Bulk writes under 100ms for 10K
  if (total >= 10_000 && elapsed < 100) {
    setHypothesis('H2', 'validated')
  } else if (total >= 10_000) {
    setHypothesis('H2', 'failed')
  }
}

async function runFormulaStress(dg: DatagridShape) {
  log('Formula cascade stress...')
  const t0 = performance.now()

  // Chain: A1 → A2 → A3 → ... → A100 (each doubles previous)
  await Effect.runPromise(dg.setCell('A1', num(1)))

  const chainLen = 100
  for (let i = 1; i < chainLen; i++) {
    const addr = `A${i + 1}`
    const depAddr = `A${i}`
    dg.registerFormula(
      addr, `=A${i}*2`, [depAddr],
      (deps) => num(extractNumber(deps[0]) * 2),
    )
  }

  // Trigger cascade
  await Effect.runPromise(dg.setCell('A1', num(2)))

  const finalVal = extractNumber(dg.getCell(`A${chainLen}`))
  const elapsed = performance.now() - t0
  const expected = 2 * Math.pow(2, chainLen - 1)

  addBench({
    label: `Formula cascade (${chainLen} chain)`,
    elapsed,
    opsPerSec: Math.round((chainLen / elapsed) * 1000),
    status: 'done',
  })

  // Clean up formulas
  for (let i = 1; i < chainLen; i++) dg.unregisterFormula(`A${i + 1}`)

  if (finalVal === expected && elapsed < 50) {
    setHypothesis('H3', 'validated')
    log(`Formula cascade: ${elapsed.toFixed(1)}ms, A${chainLen} = ${finalVal} ✓`)
  } else {
    setHypothesis('H3', 'failed')
    log(`Formula cascade: expected ${expected}, got ${finalVal} (${elapsed.toFixed(1)}ms)`)
  }
}

async function runCrdtStress(dg: DatagridShape) {
  const { agentCount } = store.getAt(store.lens.config)
  log(`CRDT conflict stress: ${agentCount} agents...`)

  const results: { agent: string; clock: number; won: boolean }[] = []

  // All agents write to B1 — last one wins (LWW)
  for (let i = 0; i < agentCount; i++) {
    const agentId = `agent-${i}`
    const val = num(100 + i)
    const result = await Effect.runPromise(
      dg.applyRemoteOp({
        col: 1, row: 0,
        payload: val,
        lamport: i + 1,
        agent_id: agentId,
      }),
    )
    results.push({ agent: agentId, clock: i + 1, won: result.applied })
  }

  const finalCell = dg.getCell({ col: 1, row: 0 })
  const finalVal = extractNumber(finalCell)
  const expectedWinner = 100 + (agentCount - 1) // Highest lamport wins

  store.setAt(store.lens.clockDisplay, dg.clock())

  if (finalVal === expectedWinner) {
    setHypothesis('H4', 'validated')
    log(`CRDT: LWW correct — agent-${agentCount - 1} won (val=${finalVal}, clock=${dg.clock()})`)
  } else {
    setHypothesis('H4', 'failed')
    log(`CRDT: Expected ${expectedWinner}, got ${finalVal}`)
  }

  addBench({
    label: `CRDT merge (${agentCount} agents)`,
    elapsed: 0,
    opsPerSec: 0,
    status: 'done',
  })
}

async function runAddressStress(dg: DatagridShape) {
  log('Address resolution stress...')

  // Name a range
  await Effect.runPromise(dg.nameRange('prices', 'A1:C10'))
  const resolved = await Effect.runPromise(dg.resolveAlias('prices'))

  if (resolved && resolved.start.col === 0 && resolved.start.row === 0 &&
      resolved.end.col === 2 && resolved.end.row === 9) {
    setHypothesis('H6', 'validated')
    log('Address resolution: A1:C10 ↔ {0,0}→{2,9} ✓')
  } else {
    setHypothesis('H6', 'failed')
    log(`Address resolution: unexpected result ${JSON.stringify(resolved)}`)
  }
}

async function runBridgeStress(dg: DatagridShape) {
  const { cols } = store.getAt(store.lens.config)
  log('AG-Grid bridge coalescing stress...')

  const txns: GridTransaction[] = []
  let pendingCb: (() => void) | null = null

  const collector = new TransactionCollector({
    onFlush: (tx) => txns.push(tx),
    scheduleFlush: (cb) => { pendingCb = cb },
  })

  // 50 writes to same row — should coalesce into 1 row update
  const writes = 50
  for (let i = 0; i < writes; i++) {
    collector.queueUpdate('stress-sheet', 0, i % cols, `v${i}`)
  }
  pendingCb?.()

  const coalesced = collector.stats.totalCoalesced
  const rowUpdates = collector.stats.totalRowUpdates

  if (txns.length === 1 && rowUpdates <= 1) {
    setHypothesis('H5', 'validated')
    log(`Bridge: ${writes} writes → 1 tx, ${rowUpdates} row update, ${coalesced} coalesced ✓`)
  } else {
    setHypothesis('H5', 'failed')
    log(`Bridge: ${writes} writes → ${txns.length} tx, ${rowUpdates} row updates`)
  }

  addBench({
    label: `Bridge coalesce (${writes} writes → ${txns.length} tx)`,
    elapsed: 0,
    opsPerSec: 0,
    status: 'done',
  })
}

async function runSubscriptionStress(dg: DatagridShape) {
  log('Subscription surgical isolation stress...')

  let renderCount = 0
  const unsub = dg.registry.subscribe(
    dg.getCellAtom('C3'),
    () => { renderCount++ },
  )

  // Write to A1 (different cell) — should NOT trigger our C3 subscription
  await Effect.runPromise(dg.setCell('A1', num(999)))
  const falsePositives = renderCount

  // Write to C3 — SHOULD trigger
  await Effect.runPromise(dg.setCell('C3', num(42)))
  const correctFires = renderCount - falsePositives

  unsub()

  if (falsePositives === 0 && correctFires === 1) {
    setHypothesis('H1', 'validated')
    log(`Subscriptions: 0 false positives, 1 correct fire ✓`)
  } else {
    setHypothesis('H1', 'failed')
    log(`Subscriptions: ${falsePositives} false positives, ${correctFires} correct fires`)
  }
}

async function runAllStress() {
  store.setAt(store.lens.benches, [])
  Object.keys(initialState.hypotheses).forEach((h) => setHypothesis(h, 'pending'))

  const dg = await initDatagrid()

  await runBulkFill(dg)
  await runSubscriptionStress(dg)
  await runFormulaStress(dg)
  await runCrdtStress(dg)
  await runBridgeStress(dg)
  await runAddressStress(dg)

  log('─── ALL STRESS TESTS COMPLETE ───')
}

// ═════════════════════════════════════════════════════════════
// AG-Grid rowData + colDefs generation (from datagrid service)
// ═════════════════════════════════════════════════════════════

function buildGridData(dg: DatagridShape, rows: number, cols: number): {
  rowData: DataGridRow[]
  colDefs: ColDef[]
} {
  const colDefs: ColDef[] = []
  for (let c = 0; c < cols; c++) {
    colDefs.push({
      field: `col_${c}`,
      headerName: colIndexToLetter(c),
      width: 100,
      valueGetter: (params: any) => {
        const rowIdx = params.data?._rowIndex ?? 0
        return extractDisplay(dg.getCell({ col: c, row: rowIdx }))
      },
      editable: true,
    })
  }

  const rowData: DataGridRow[] = []
  for (let r = 0; r < Math.min(rows, 200); r++) {
    const row: any = {
      id: String(r),
      _rowIndex: r,
      name: `Row ${r}`,
      value: 0,
      status: 'active' as const,
    }
    for (let c = 0; c < cols; c++) {
      row[`col_${c}`] = extractDisplay(dg.getCell({ col: c, row: r }))
    }
    rowData.push(row)
  }
  return { rowData, colDefs }
}

// ═════════════════════════════════════════════════════════════
// Components — all subscribe to STX, zero useState
// ═════════════════════════════════════════════════════════════

// ── Config Panel ────────────────────────────────────

const ConfigPanel = memo(function ConfigPanel() {
  const config = useFocus(store, store.lens.config)

  const presets = [
    { label: '100×10', rows: 100, cols: 10 },
    { label: '1K×20', rows: 1000, cols: 20 },
    { label: '10K×10', rows: 10_000, cols: 10 },
    { label: '100K×5', rows: 100_000, cols: 5 },
  ]

  return (
    <TestCard title="STRESS CONFIG">
      <div className="flex gap-2 flex-wrap">
        {presets.map((p) => (
          <Button
            key={p.label}
            variant={config.rows === p.rows && config.cols === p.cols ? 'primary' : 'default'}
            onClick={() => store.setAt(store.lens.config, {
              ...config, rows: p.rows, cols: p.cols,
            })}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="mt-4 flex gap-6">
        <ValueDisplay label="Rows" value={config.rows.toLocaleString()} accent="cyan" />
        <ValueDisplay label="Cols" value={config.cols} accent="cyan" />
        <ValueDisplay label="Total" value={(config.rows * config.cols).toLocaleString()} accent="amber" />
        <ValueDisplay label="Agents" value={config.agentCount} accent="green" />
      </div>
    </TestCard>
  )
})

// ── Hypothesis Dashboard ────────────────────────────

const HypothesisDashboard = memo(function HypothesisDashboard() {
  const hypotheses = useFocus(store, store.lens.hypotheses)

  const items = [
    { id: 'H1', title: 'Surgical subscriptions (0 spurious)' },
    { id: 'H2', title: 'Bulk fill 10K cells < 100ms' },
    { id: 'H3', title: 'Formula cascade propagation' },
    { id: 'H4', title: 'CRDT LWW merge correctness' },
    { id: 'H5', title: 'Bridge coalesces transactions' },
    { id: 'H6', title: 'Address A1↔R1C1↔alias resolution' },
  ]

  return (
    <HypothesisSummary
      hypotheses={items.map((h) => ({
        id: h.id,
        title: h.title,
        status: hypotheses[h.id] ?? 'pending',
      }))}
    />
  )
})

// ── Benchmark Results ───────────────────────────────

const BenchResults = memo(function BenchResults() {
  const benches = useFocus(store, store.lens.benches)

  if (benches.length === 0) {
    return (
      <div
        className="text-neutral-600 font-mono text-center py-8"
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        Run stress tests to see benchmark results
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {benches.map((b, i) => (
        <div
          key={`${b.label}-${i}`}
          className="flex items-center justify-between py-2 px-3 bg-neutral-900/50 border border-neutral-800 rounded font-mono"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          <span className="text-neutral-300">{b.label}</span>
          <div className="flex gap-4">
            <span className="text-cyan-400">{b.elapsed.toFixed(1)}ms</span>
            {b.opsPerSec > 0 && (
              <span className="text-amber-400">{b.opsPerSec.toLocaleString()} ops/s</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
})

// ── Event Log ───────────────────────────────────────

const EventLog = memo(function EventLog() {
  const logEntries = useFocus(store, store.lens.log)

  return (
    <div
      className="h-48 overflow-y-auto bg-black border border-neutral-800 rounded p-3 font-mono"
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {logEntries.length === 0 ? (
        <span className="text-neutral-700">awaiting operations...</span>
      ) : (
        logEntries.map((entry, i) => (
          <div key={i} className="text-neutral-500 leading-relaxed">
            {entry}
          </div>
        ))
      )}
    </div>
  )
})

// ── Live Grid (AG-Grid via TmnlDataGrid) ────────────

const LiveGrid = memo(function LiveGrid() {
  const dg = useFocus(store, store.lens.datagrid)
  const config = useFocus(store, store.lens.config)

  if (!dg) {
    return (
      <div className="h-96 border border-dashed border-neutral-800 rounded flex items-center justify-center">
        <span
          className="text-neutral-600 font-mono"
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          Initialize datagrid to view data
        </span>
      </div>
    )
  }

  const { rowData, colDefs } = useMemo(
    () => buildGridData(dg, config.rows, config.cols),
    [dg, config.rows, config.cols],
  )

  // Build DataGridRow-compatible data from datagrid cells
  const gridRowData: DataGridRow[] = useMemo(() => {
    const cap = Math.min(config.rows, 200)
    const rows: DataGridRow[] = []
    for (let r = 0; r < cap; r++) {
      rows.push({
        id: String(r),
        name: `R${r}`,
        value: extractNumber(dg.getCell({ col: 0, row: r })),
        status: r % 3 === 0 ? 'active' : r % 3 === 1 ? 'pending' : 'inactive',
      })
    }
    return rows
  }, [dg, config.rows])

  return (
    <DataGrid
      id="datagrid-stress"
      rowData={gridRowData}
      height={400}
      behavior={{ enableDrag: false, enableEdit: false, enableSort: true }}
      onGridReady={(api) => store.setAt(store.lens.gridApi, api as any)}
    >
      <DataGrid.CornerDecorations />
      <DataGrid.Header>
        <DataGrid.Title title="STRESS GRID" />
        <DataGrid.StatusIndicator />
      </DataGrid.Header>
      <DataGrid.Body />
    </DataGrid>
  )
})

// ── CRDT Conflict Visualizer ────────────────────────

const CrdtVisualizer = memo(function CrdtVisualizer() {
  const clockVal = useFocus(store, store.lens.clockDisplay)
  const dg = useFocus(store, store.lens.datagrid)

  return (
    <DemoSection title="CRDT STATE" description="Lamport clock and conflict resolution">
      <div className="flex gap-6">
        <ValueDisplay label="Lamport Clock" value={clockVal} accent="cyan" size="lg" />
        <ValueDisplay
          label="B1 (contested)"
          value={dg ? extractDisplay(dg.getCell({ col: 1, row: 0 })) : '—'}
          accent="amber"
          size="lg"
        />
      </div>
    </DemoSection>
  )
})

// ═════════════════════════════════════════════════════════════
// Root Testbed Component
// ═════════════════════════════════════════════════════════════

export function DatagridTestbed() {
  const activePanel = useFocus(store, store.lens.activePanel)

  return (
    <div className="min-h-screen bg-black text-neutral-100 p-6 max-w-7xl mx-auto">
      <TestbedHeader
        title="@tmnl/datagrid"
        subtitle="Reactive spreadsheet abstraction — STX × ServiceMap × AG-Grid"
        actions={
          <div className="flex gap-2">
            <Button variant="primary" onClick={runAllStress}>
              ▶ RUN ALL
            </Button>
            <Button
              variant="default"
              onClick={async () => {
                const dg = await initDatagrid()
                await runBulkFill(dg)
              }}
            >
              FILL
            </Button>
          </div>
        }
      />

      {/* Hypothesis Summary */}
      <div className="mb-6">
        <HypothesisDashboard />
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-neutral-800 pb-1">
        {(['grid', 'bench', 'crdt'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => store.setAt(store.lens.activePanel, tab)}
            className={`px-4 py-2 font-mono uppercase tracking-wider transition-colors rounded-t ${
              activePanel === tab
                ? 'bg-neutral-800 text-cyan-400 border border-neutral-700 border-b-0'
                : 'text-neutral-600 hover:text-neutral-400'
            }`}
            style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
          >
            {tab === 'grid' ? '⊞ Grid' : tab === 'bench' ? '⚡ Benchmarks' : '⟳ CRDT'}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="grid grid-cols-[1fr,340px] gap-6">
        {/* Main content */}
        <div className="space-y-6">
          {activePanel === 'grid' && <LiveGrid />}

          {activePanel === 'bench' && (
            <TestCard title="BENCHMARK RESULTS" description="Throughput and latency metrics">
              <BenchResults />
            </TestCard>
          )}

          {activePanel === 'crdt' && <CrdtVisualizer />}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <ConfigPanel />

          <CollapsiblePanel title="Event Log" defaultOpen>
            <EventLog />
          </CollapsiblePanel>
        </div>
      </div>
    </div>
  )
}

export default DatagridTestbed
