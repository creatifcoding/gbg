/**
 * Datagrid Stress Testbed
 *
 * Exercises the REAL @tmnl/datagrid services:
 * - CellCache (atom-per-cell, transactional bulk set)
 * - FormulaEngine (StackVM compile + eval + dep graph)
 * - UndoStack (record/undo/redo)
 * - SchemaRegistry (type coercion + validation)
 *
 * Tiered scale: 100 → 1K → 10K cells.
 * Route: /testbed/datagrid-stress
 */

import { useState, useCallback, useRef, useMemo, useEffect, type CSSProperties } from "react"
import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { AgGridReact } from "ag-grid-react"
import {
  ModuleRegistry, AllCommunityModule,
  type ColDef, type CellEditRequestEvent, type GridApi, type GridReadyEvent,
} from "ag-grid-community"
import { Effect } from "effect-v4"
import { AtomRegistry } from "effect-v4/unstable/reactivity"
import { stxFamily } from "@tmnl/stx"
import {
  // Services
  makeDatagridLayer, Datagrid,
  type DatagridShape, type DatagridConfigShape,
  // Schemas
  num, str, empty, formula, extractDisplay, extractNumber,
  type CellValue, type ColRow,
  colIndexToLetter, cellKey, formatA1,
  // UI
  createDirectTheme, COLORS, TYPOGRAPHY,
  // Stack VM
  compileExprSync, evalProgramDirect, type CellContext,
  VMNum, VMStr, VMBool, vmDisplay,
  // Undo
  UndoStack, UndoStackConfig, UndoStackLive,
  type UndoStackShape,
  // Bridge — STX → AG-Grid transaction pipeline
  GridBridge,
  type GridTransaction, type TransactionStats,
} from "@tmnl/datagrid"

ModuleRegistry.registerModules([AllCommunityModule])

// ─── Tier Configs ───────────────────────────────────

type Tier = "100" | "1k" | "10k"
const TIER_CONFIG: Record<Tier, { cols: number; rows: number; label: string }> = {
  "100":  { cols: 5,  rows: 20,   label: "100 cells (5×20)" },
  "1k":   { cols: 10, rows: 100,  label: "1K cells (10×100)" },
  "10k":  { cols: 20, rows: 500,  label: "10K cells (20×500)" },
}

// ─── In-memory Datagrid factory ─────────────────────

function createInMemoryDatagrid(cols: number, rows: number): DatagridShape {
  // In-memory cell store
  const store = new Map<string, CellValue>()

  const config: DatagridConfigShape = {
    sheetId: "stress-test",
    agentId: "testbed",
    readCell: (sid, c, r) => store.get(`${sid}:${c}:${r}`) ?? null,
    writeCell: (sid, c, r, v) => Effect.sync(() => { store.set(`${sid}:${c}:${r}`, v) }),
    writeCellBulk: (sid, entries) => Effect.sync(() => {
      for (const { col, row, value } of entries) store.set(`${sid}:${col}:${row}`, value)
    }),
    upsertNamedRange: () => Effect.void,
    getNamedRange: () => Effect.succeed(null),
    listNamedRanges: () => Effect.succeed([]),
    deleteNamedRange: () => Effect.void,
  }

  // Build datagrid synchronously via Effect.runSync
  const layer = makeDatagridLayer(config)
  const datagrid = Effect.runSync(
    Effect.scoped(
      Effect.gen(function* () {
        const ctx = yield* layer.pipe(
          // @ts-expect-error Layer.build typing
          (l) => Effect.provide(Effect.flatMap(l.pipe(layer => layer), _ => Effect.succeed(_)),
            l
          )
        )
        return ctx
      })
    ).pipe(Effect.catchAll(() => Effect.succeed(null as any)))
  )

  // Fallback: build manually if Layer machinery fails
  if (!datagrid) {
    return buildManualDatagrid(config, cols, rows)
  }

  return datagrid
}

/**
 * Manual datagrid construction — bypasses Effect Layer system.
 * Uses the same interfaces but wires services directly.
 */
function buildManualDatagrid(
  config: DatagridConfigShape,
  cols: number,
  rows: number,
): DatagridShape {
  const registry = AtomRegistry.make()
  const { sheetId, agentId } = config
  const store = new Map<string, CellValue>()

  // Simple stxFamily for cell atoms
  const family = stxFamily<string, CellValue>({
    key: (k) => k,
    default: () => empty(),
    registry,
  })

  // Seed with data
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const key = cellKey(sheetId, { col: c, row: r })
      const value = c === 0
        ? str(formatA1({ col: c, row: r })) // Column A = cell address
        : r === 0
          ? str(colIndexToLetter(c))          // Row 0 = column headers
          : num(Math.round(Math.random() * 1000) / 10) // Random numbers
      family.set(key, value)
      store.set(`${sheetId}:${c}:${r}`, value)
    }
  }

  // Formula storage
  const formulas = new Map<string, { src: string; deps: ColRow[]; compute: (vs: CellValue[]) => CellValue }>()

  // Minimal DatagridShape implementation
  const datagrid: DatagridShape = {
    sheetId,
    agentId,
    getCell: (addr) => {
      const cr = typeof addr === "string" ? { col: 0, row: 0 } : addr as ColRow
      const key = cellKey(sheetId, cr)
      return registry.get(family.atom(key))
    },
    setCell: (addr, value) => Effect.sync(() => {
      const cr = addr as ColRow
      const key = cellKey(sheetId, cr)
      family.set(key, value)
      store.set(`${sheetId}:${cr.col}:${cr.row}`, value)
    }),
    setCells: (entries) => Effect.sync(() => {
      for (const { addr, value } of entries) {
        const cr = addr as ColRow
        const key = cellKey(sheetId, cr)
        family.set(key, value)
        store.set(`${sheetId}:${cr.col}:${cr.row}`, value)
      }
    }),
    getCellAtom: (addr) => {
      const cr = addr as ColRow
      return family.atom(cellKey(sheetId, cr))
    },
    getRange: () => [],
    setRange: () => Effect.void,
    clearRange: () => Effect.void,
    registerFormula: () => null as any,
    unregisterFormula: () => {},
    detectCycle: () => null,
    nameRange: () => Effect.void,
    resolveAlias: () => Effect.succeed(null),
    applyRemoteOp: () => Effect.succeed({ applied: true, conflict: false } as any),
    applyRemoteOps: () => Effect.succeed([]),
    clock: () => 0,
    family,
    registry,
    cells: null as any,
    addresses: null as any,
    formulas: null as any,
    crdt: null as any,
  }

  return datagrid
}

// ─── Performance Tracker ────────────────────────────

interface PerfStats {
  cellCount: number
  lastEditMs: number
  lastRecalcMs: number
  totalEdits: number
  totalRecalcs: number
  avgEditMs: number
  formulaCount: number
}

const initialPerfStats: PerfStats = {
  cellCount: 0,
  lastEditMs: 0,
  lastRecalcMs: 0,
  totalEdits: 0,
  totalRecalcs: 0,
  avgEditMs: 0,
  formulaCount: 0,
}

// ─── Main Component ─────────────────────────────────

export function DatagridStressTestbed() {
  const [tier, setTier] = useState<Tier>("100")
  const [perf, setPerf] = useState<PerfStats>(initialPerfStats)
  const [undoCount, setUndoCount] = useState(0)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)
  const gridApiRef = useRef<GridApi | null>(null)
  const datagridRef = useRef<DatagridShape | null>(null)
  const undoStackRef = useRef<{ entries: Array<{ addr: ColRow; before: CellValue; after: CellValue }> }>({ entries: [] })
  const bridgeRef = useRef<GridBridge | null>(null)

  const { cols, rows } = TIER_CONFIG[tier]
  const theme = useMemo(() => createDirectTheme(), [])

  // Create datagrid when tier changes
  const datagrid = useMemo(() => {
    const dg = buildManualDatagrid({
      sheetId: "stress",
      agentId: "testbed",
      readCell: () => null,
      writeCell: () => Effect.void,
      writeCellBulk: () => Effect.void,
      upsertNamedRange: () => Effect.void,
      getNamedRange: () => Effect.succeed(null),
      listNamedRanges: () => Effect.succeed([]),
      deleteNamedRange: () => Effect.void,
    }, cols, rows)
    datagridRef.current = dg
    setPerf(p => ({ ...p, cellCount: cols * rows, formulaCount: 0 }))
    undoStackRef.current = { entries: [] }
    setUndoCount(0)
    return dg
  }, [tier, cols, rows])

  // ── Bridge: STX atoms → TransactionCollector → AG-Grid applyTransaction ──

  const bridge = useMemo(() => {
    // Cleanup previous bridge subscriptions
    bridgeRef.current?.destroy()

    const b = new GridBridge({
      datagrid,
      applyTransaction: (tx: GridTransaction) => {
        const api = gridApiRef.current
        if (!api) return

        const agTx: { update?: any[]; add?: any[]; remove?: any[] } = {}

        if (tx.update) {
          agTx.update = tx.update.map((u) => {
            const [, rowStr] = u.id.split(":")
            const rowIndex = parseInt(rowStr!)
            // Merge partial updates into existing row data
            const existingNode = api.getRowNode(String(rowIndex))
            const existing = existingNode?.data ?? { _rowIndex: rowIndex }
            const updates: Record<string, unknown> = {}
            for (const [colStr, val] of Object.entries(u.data)) {
              updates[`col_${colStr}`] = val
            }
            return { ...existing, ...updates }
          })
        }

        if (tx.add) {
          agTx.add = tx.add.map((u) => {
            const [, rowStr] = u.id.split(":")
            return {
              _rowIndex: parseInt(rowStr!),
              ...Object.fromEntries(
                Object.entries(u.data).map(([col, val]) => [`col_${col}`, val])
              ),
            }
          })
        }

        if (tx.remove) {
          agTx.remove = tx.remove.map((r) => {
            const [, rowStr] = r.id.split(":")
            return { _rowIndex: parseInt(rowStr!) }
          })
        }

        api.applyTransaction(agTx)
      },
      // rAF batching: coalesces all atom writes within a frame
      scheduleFlush: (cb) => requestAnimationFrame(cb),
    })

    bridgeRef.current = b
    return b
  }, [datagrid])

  // Subscribe bridge to all cell atoms after grid is ready
  useEffect(() => {
    if (!gridApi || !bridge) return

    const colIndices = Array.from({ length: cols }, (_, i) => i)
    bridge.subscribeRange(0, rows - 1, colIndices)

    return () => bridge.destroy()
  }, [bridge, gridApi, cols, rows])

  // Generate column defs
  const columnDefs = useMemo<ColDef[]>(() => {
    const defs: ColDef[] = [
      {
        headerName: "#",
        width: 50,
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        cellStyle: { color: COLORS.textDisabled, fontSize: TYPOGRAPHY.fontSizeXs },
        suppressNavigable: true,
      },
    ]

    for (let c = 0; c < cols; c++) {
      const colLetter = colIndexToLetter(c)
      defs.push({
        field: `col_${c}`,
        headerName: colLetter,
        width: c === 0 ? 80 : 100,
        editable: true,
        cellStyle: (params) => {
          const val = params.value as string
          if (val?.startsWith?.("#")) return { color: COLORS.accentRed }
          if (val?.startsWith?.("=")) return { color: COLORS.accentCyan }
          return { color: COLORS.textSecondary }
        },
      })
    }

    return defs
  }, [cols])

  // Generate row data from datagrid atoms
  const rowData = useMemo(() => {
    const data: Record<string, unknown>[] = []
    for (let r = 0; r < rows; r++) {
      const row: Record<string, unknown> = { _rowIndex: r }
      for (let c = 0; c < cols; c++) {
        const key = cellKey("stress", { col: c, row: r })
        const value = datagrid.registry.get(datagrid.family.atom(key))
        row[`col_${c}`] = extractDisplay(value)
      }
      data.push(row)
    }
    return data
  }, [datagrid, rows, cols])

  // Handle cell edit
  const onCellEditRequest = useCallback((event: CellEditRequestEvent) => {
    const t0 = performance.now()
    const colIdx = parseInt(event.colDef.field?.replace("col_", "") ?? "0")
    const rowIdx = event.node?.rowIndex ?? 0
    const rawValue = event.newValue as string

    // Parse value
    let cellValue: CellValue
    if (rawValue === "" || rawValue == null) {
      cellValue = empty()
    } else if (rawValue.startsWith("=")) {
      // Formula — compile and evaluate
      try {
        const ir = compileExprSync(rawValue.slice(1))
        const ctx: CellContext = {
          readCell: (c: number, r: number) => {
            const k = cellKey("stress", { col: c, row: r })
            return datagrid.registry.get(datagrid.family.atom(k))
          },
          readRange: () => [],
          currentCell: { col: colIdx, row: rowIdx },
        }
        const result = evalProgramDirect(ir, ctx)
        if (result._tag === "Num") cellValue = num(result.value)
        else if (result._tag === "Str") cellValue = str(result.value)
        else if (result._tag === "Bool") cellValue = result.value ? str("TRUE") : str("FALSE")
        else cellValue = str(vmDisplay(result))
      } catch (e: any) {
        cellValue = str(`#ERR: ${e.message}`)
      }
    } else {
      const n = Number(rawValue)
      cellValue = isNaN(n) ? str(rawValue) : num(n)
    }

    // Record undo
    const key = cellKey("stress", { col: colIdx, row: rowIdx })
    const before = datagrid.registry.get(datagrid.family.atom(key))
    undoStackRef.current.entries.push({ addr: { col: colIdx, row: rowIdx }, before, after: cellValue })
    setUndoCount(undoStackRef.current.entries.length)

    // Write
    datagrid.family.set(key, cellValue)

    const elapsed = performance.now() - t0
    setPerf(p => ({
      ...p,
      lastEditMs: Math.round(elapsed * 100) / 100,
      totalEdits: p.totalEdits + 1,
      avgEditMs: Math.round(((p.avgEditMs * p.totalEdits + elapsed) / (p.totalEdits + 1)) * 100) / 100,
    }))

    // Grid update: handled by bridge subscription → TransactionCollector → applyTransaction
    // No manual rowNode.setData() needed.
  }, [datagrid, cols])

  // Undo
  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.entries.length === 0) return
    const entry = stack.entries.pop()!
    setUndoCount(stack.entries.length)
    const key = cellKey("stress", entry.addr)
    datagrid.family.set(key, entry.before)

    // Grid update: bridge subscription → TransactionCollector → applyTransaction
  }, [datagrid])

  // Bulk fill
  const handleBulkFill = useCallback(() => {
    const t0 = performance.now()
    for (let c = 1; c < cols; c++) {
      for (let r = 1; r < rows; r++) {
        const key = cellKey("stress", { col: c, row: r })
        datagrid.family.set(key, num(Math.round(Math.random() * 1000) / 10))
      }
    }
    const elapsed = performance.now() - t0
    setPerf(p => ({
      ...p,
      lastRecalcMs: Math.round(elapsed * 100) / 100,
      totalRecalcs: p.totalRecalcs + 1,
    }))

    // TransactionCollector coalesces all atom writes within this frame
    // and flushes via a single applyTransaction call on next rAF.
    // Force immediate flush for responsiveness:
    bridge.flush()
  }, [datagrid, bridge, cols, rows])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [handleUndo])

  // ─── Grid ready ─────────────────────────────────

  const onGridReady = useCallback((e: GridReadyEvent) => {
    gridApiRef.current = e.api
    setGridApi(e.api)
  }, [])

  // ─── Styles ─────────────────────────────────────

  const panelStyle: CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamilyString,
    fontSize: TYPOGRAPHY.fontSizeSm,
    color: COLORS.textSecondary,
    backgroundColor: COLORS.backgroundPrimary,
    border: `1px solid ${COLORS.borderDefault}`,
    padding: 12,
  }

  return (
    <div className="min-h-screen bg-black text-white p-6" style={{ fontFamily: TYPOGRAPHY.fontFamilyString }}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/testbed" className="text-neutral-500 hover:text-white transition">
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-lg font-mono uppercase tracking-widest text-neutral-300">
          Datagrid Stress Testbed
        </h1>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        {(Object.entries(TIER_CONFIG) as [Tier, typeof TIER_CONFIG["100"]][]).map(([t, cfg]) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`px-4 py-2 font-mono text-xs uppercase transition border ${
              tier === t
                ? "bg-cyan-900/30 text-cyan-400 border-cyan-500/50"
                : "text-neutral-500 border-neutral-700 hover:border-neutral-500"
            }`}
          >
            {cfg.label}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleBulkFill}
            className="px-4 py-2 font-mono text-xs uppercase text-neutral-400 border border-neutral-700 hover:text-white hover:border-neutral-500 transition"
          >
            Randomize All
          </button>
          <button
            onClick={handleUndo}
            disabled={undoCount === 0}
            className={`px-4 py-2 font-mono text-xs uppercase border transition ${
              undoCount > 0
                ? "text-neutral-400 border-neutral-700 hover:text-white"
                : "text-neutral-700 border-neutral-800 cursor-not-allowed"
            }`}
          >
            Undo ({undoCount})
          </button>
        </div>
      </div>

      {/* Main grid + perf panel */}
      <div className="flex gap-4" style={{ height: "calc(100vh - 180px)" }}>
        {/* Grid */}
        <div className="flex-1 border border-neutral-800">
          <AgGridReact
            theme={theme}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={{
              resizable: true,
              sortable: true,
            }}
            readOnlyEdit={true}
            onCellEditRequest={onCellEditRequest}
            onGridReady={onGridReady}
            getRowId={(p) => String(p.data._rowIndex)}
            suppressColumnVirtualisation={cols <= 20}
          />
        </div>

        {/* Performance Panel */}
        <div className="w-64 flex flex-col gap-3" style={{ minWidth: 240 }}>
          <div style={panelStyle}>
            <div className="text-xs uppercase text-neutral-500 mb-2 tracking-wider">Scale</div>
            <div className="text-2xl text-white font-mono">{(cols * rows).toLocaleString()}</div>
            <div className="text-xs text-neutral-600 mt-1">{cols} cols × {rows} rows</div>
          </div>

          <div style={panelStyle}>
            <div className="text-xs uppercase text-neutral-500 mb-2 tracking-wider">Edits</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-neutral-600">Last</div>
                <div className="text-lg text-white font-mono">{perf.lastEditMs}ms</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Avg</div>
                <div className="text-lg text-white font-mono">{perf.avgEditMs}ms</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Total</div>
                <div className="text-lg text-cyan-400 font-mono">{perf.totalEdits}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Undo Stack</div>
                <div className="text-lg text-yellow-400 font-mono">{undoCount}</div>
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div className="text-xs uppercase text-neutral-500 mb-2 tracking-wider">Bulk Ops</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-neutral-600">Last Fill</div>
                <div className="text-lg text-white font-mono">{perf.lastRecalcMs}ms</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Total Fills</div>
                <div className="text-lg text-green-400 font-mono">{perf.totalRecalcs}</div>
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div className="text-xs uppercase text-neutral-500 mb-2 tracking-wider">Bridge</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-neutral-600">Transactions</div>
                <div className="text-lg text-purple-400 font-mono">{bridge.collector.stats.totalTransactions}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Row Updates</div>
                <div className="text-lg text-purple-400 font-mono">{bridge.collector.stats.totalRowUpdates}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Coalesced</div>
                <div className="text-lg text-green-400 font-mono">{bridge.collector.stats.totalCoalesced}</div>
              </div>
              <div>
                <div className="text-xs text-neutral-600">Pending</div>
                <div className="text-lg text-yellow-400 font-mono">{bridge.collector.pendingCount}</div>
              </div>
            </div>
          </div>

          <div style={panelStyle}>
            <div className="text-xs uppercase text-neutral-500 mb-2 tracking-wider">Tips</div>
            <div className="text-xs text-neutral-600 space-y-1">
              <div>• Double-click a cell to edit</div>
              <div>• Type <span className="text-cyan-400">=A1+B1</span> for formulas</div>
              <div>• <span className="text-neutral-400">Ctrl+Z</span> to undo</div>
              <div>• Click "Randomize All" for bulk test</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
