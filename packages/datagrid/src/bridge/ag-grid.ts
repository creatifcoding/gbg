/**
 * AG-Grid Bridge — readOnlyEdit architecture (G5 + SYN-1)
 *
 * STX-Primary: AG-Grid is a pure renderer. All writes route
 * through STX's transactional pipeline.
 *
 * Flow:
 *   User edit → cellEditRequest → SchemaRegistry.coerce → validate
 *   → UndoStack.record → CellCache.transactionalSetBulk
 *   → Atom.batch → TransactionCollector → applyTransactionAsync
 *
 * AG-Grid config:
 *   readOnlyEdit: true          — AG doesn't mutate data
 *   undoRedoCellEditing: false  — STX UndoStack owns undo
 *
 * @module
 */

import * as Effect from "effect-v4/Effect"
import { AtomRegistry } from "effect-v4/unstable/reactivity"
import { extractDisplay, extractNumber, type CellValue, str, num, bool } from "../schemas/cell-value"
import { cellKey, colIndexToLetter, type ColRow } from "../schemas/addressing"
import type { DatagridShape } from "../services/datagrid"
import type { UndoStackShape } from "../services/undo-stack"
import type { SchemaRegistryShape } from "../services/schema-registry"
import type { CellErrorStoreShape, CellErrorState } from "../services/cell-errors"
import { CellWriteError } from "../services/cell-errors"
import { TransactionCollector, type GridTransaction } from "./transactions"

// ─── Types ──────────────────────────────────────────

export interface ColumnMeta {
  readonly col: number
  readonly name: string
  readonly dtype: "number" | "string" | "boolean" | "date" | "formula"
  readonly width?: number
  readonly editable?: boolean
}

export interface DatagridColDef {
  /** AG-Grid field identifier */
  readonly field: string
  /** Display header */
  readonly headerName: string
  /** Column width in px */
  readonly width: number
  /** Whether the column is editable */
  readonly editable: boolean
  /** Value getter — pure function reading from stxFamily atoms */
  readonly valueGetter: (params: { data?: { _rowIndex: number } }) => string
  /** Optional: value formatter for number columns */
  readonly type?: string
}

export interface DatagridRowData {
  /** Row identifier used by AG-Grid */
  readonly _rowIndex: number
  /** Keyed by field name */
  [field: string]: unknown
}

/**
 * Result of processing a cellEditRequest.
 * Returned to the caller for optional handling.
 */
export interface EditRequestResult {
  readonly success: boolean
  readonly addr: ColRow
  readonly value: CellValue
  readonly error?: CellWriteError
}

// ─── ColDef generation ──────────────────────────────

/**
 * Generate AG-Grid ColDefs from column metadata.
 *
 * Each column gets a pure valueGetter that reads from
 * the Datagrid's cell atoms via the stxFamily.
 * No valueSetter — readOnlyEdit routes edits elsewhere.
 */
export function generateColDefs(
  columns: ReadonlyArray<ColumnMeta>,
  datagrid: DatagridShape,
): DatagridColDef[] {
  return columns.map((col) => ({
    field: `col_${col.col}`,
    headerName: col.dtype === "formula" ? `ƒ ${col.name}` : col.name,
    width: col.width ?? 120,
    editable: col.editable ?? col.dtype !== "formula",
    type: col.dtype === "number" ? "numericColumn" : undefined,
    valueGetter: (params: { data?: { _rowIndex: number } }) => {
      const rowIndex = params.data?._rowIndex ?? 0
      return extractDisplay(datagrid.getCell({ col: col.col, row: rowIndex }))
    },
  }))
}

/**
 * Generate default columns from a column count.
 * Uses spreadsheet-style headers: A, B, C, ..., AA, AB, ...
 */
export function generateDefaultColDefs(
  colCount: number,
  datagrid: DatagridShape,
): DatagridColDef[] {
  const columns: ColumnMeta[] = []
  for (let i = 0; i < colCount; i++) {
    columns.push({
      col: i,
      name: colIndexToLetter(i),
      dtype: "string",
      width: 120,
    })
  }
  return generateColDefs(columns, datagrid)
}

// ─── Parse raw editor value → CellValue ─────────────

/**
 * Convert a raw string from AG-Grid's cell editor into
 * a typed CellValue. Attempts number → boolean → string.
 */
export function parseEditorValue(raw: string, dtype?: string): CellValue {
  if (raw === "") return { _tag: "Empty" }

  if (dtype === "number" || dtype === "numericColumn") {
    const n = parseFloat(raw)
    if (!isNaN(n)) return num(n)
  }

  // Try number
  const n = parseFloat(raw)
  if (!isNaN(n) && String(n) === raw.trim()) return num(n)

  // Try boolean
  const lower = raw.toLowerCase().trim()
  if (lower === "true") return bool(true)
  if (lower === "false") return bool(false)

  return str(raw)
}

// ─── Grid Bridge ────────────────────────────────────

export interface GridBridgeConfig {
  /** The Datagrid service instance */
  readonly datagrid: DatagridShape
  /** Called when a transaction is ready to apply to AG-Grid */
  readonly applyTransaction: (tx: GridTransaction) => void
  /** Custom flush scheduler */
  readonly scheduleFlush?: (cb: () => void) => void
  /** Optional: UndoStack for recording edits */
  readonly undoStack?: UndoStackShape
  /** Optional: SchemaRegistry for validation/coercion */
  readonly schemaRegistry?: SchemaRegistryShape
  /** Optional: Error store for posting validation errors */
  readonly errorStore?: CellErrorStoreShape
  /** Optional: callback when an edit is processed */
  readonly onEditResult?: (result: EditRequestResult) => void
}

/**
 * GridBridge connects a Datagrid to AG-Grid.
 *
 * readOnlyEdit architecture:
 * - Subscribes to atom changes → batches into applyTransaction
 * - Handles cellEditRequest → validate → commit via STX
 * - Posts validation errors to error atoms
 * - Records edits in UndoStack
 */
export class GridBridge {
  readonly datagrid: DatagridShape
  readonly collector: TransactionCollector
  private readonly undoStack?: UndoStackShape
  private readonly schemaRegistry?: SchemaRegistryShape
  private readonly errorStore?: CellErrorStoreShape
  private readonly onEditResult?: (result: EditRequestResult) => void
  private subscriptions: Array<() => void> = []

  constructor(config: GridBridgeConfig) {
    this.datagrid = config.datagrid
    this.undoStack = config.undoStack
    this.schemaRegistry = config.schemaRegistry
    this.errorStore = config.errorStore
    this.onEditResult = config.onEditResult
    this.collector = new TransactionCollector({
      onFlush: config.applyTransaction,
      scheduleFlush: config.scheduleFlush,
    })
  }

  // ── Effect pipelines ───────────────────────────

  /**
   * Build the Effect pipeline for a single cell edit.
   *
   * Compose: parse → coerce → validate → record → commit → clear error
   * Error branch: post to error store, yield EditRequestResult.
   */
  private editEffect(
    addr: ColRow,
    value: CellValue,
  ): Effect.Effect<EditRequestResult, never, never> {
    const { col, row } = addr

    // Coerce
    const coerced = this.schemaRegistry
      ? this.schemaRegistry.coerce(addr, value)
      : value

    // Validate — early exit on failure
    if (this.schemaRegistry) {
      const issues = this.schemaRegistry.validate(addr, coerced)
      if (issues.length > 0) {
        return Effect.sync(() => this.postError(addr, coerced, issues, "validation"))
      }
    }

    // Record → Commit → Clear
    if (this.undoStack) this.undoStack.record([{ addr, value: coerced }])

    return this.datagrid.cells
      .transactionalSetBulk([{ addr, value: coerced }])
      .pipe(
        Effect.as<EditRequestResult>({ success: true, addr, value: coerced }),
        Effect.tap(() => Effect.sync(() => this.errorStore?.clearError(addr))),
        Effect.catchTag("CellWriteError", (error) =>
          Effect.succeed(this.postError(addr, coerced, [...error.issues], error.source)),
        ),
      )
  }

  /**
   * Build the Effect pipeline for a bulk paste.
   *
   * Validates each cell, partitions into valid/rejected,
   * commits valid set atomically.
   */
  private pasteEffect(
    entries: ReadonlyArray<{ addr: ColRow; rawValue: string; dtype?: string }>,
  ): Effect.Effect<ReadonlyArray<EditRequestResult>, never, never> {
    const rejected: EditRequestResult[] = []
    const valid: { addr: ColRow; value: CellValue }[] = []

    // Parse, coerce, validate
    for (const entry of entries) {
      let value = parseEditorValue(entry.rawValue, entry.dtype)

      if (this.schemaRegistry) {
        value = this.schemaRegistry.coerce(entry.addr, value)
        const issues = this.schemaRegistry.validate(entry.addr, value)
        if (issues.length > 0) {
          rejected.push(this.postError(entry.addr, value, issues, "validation"))
          continue
        }
      }

      valid.push({ addr: entry.addr, value })
    }

    if (valid.length === 0) return Effect.succeed(rejected)

    // Record undo, commit atomically
    if (this.undoStack) this.undoStack.record(valid, "paste")

    return this.datagrid.cells
      .transactionalSetBulk(valid)
      .pipe(
        Effect.tap(() => Effect.sync(() => {
          for (const e of valid) this.errorStore?.clearError(e.addr)
        })),
        Effect.as([
          ...rejected,
          ...valid.map((e): EditRequestResult => ({ success: true, addr: e.addr, value: e.value })),
        ]),
        Effect.catchTag("CellWriteError", (error) =>
          Effect.succeed([
            ...rejected,
            ...valid.map((e): EditRequestResult => ({
              success: false, addr: e.addr, value: e.value,
              error: new CellWriteError({
                col: e.addr.col, row: e.addr.row,
                issues: [...error.issues], source: error.source,
              }),
            })),
          ]),
        ),
      )
  }

  /**
   * Post an error to the error store and return a failed EditRequestResult.
   */
  private postError(
    addr: ColRow,
    value: CellValue,
    issues: ReadonlyArray<string>,
    source: "validation" | "constraint" | "db" | "conflict",
  ): EditRequestResult {
    this.errorStore?.setError(addr, {
      _tag: "CellError", source, issues, timestamp: Date.now(),
    })
    return {
      success: false, addr, value,
      error: new CellWriteError({
        col: addr.col, row: addr.row, issues: [...issues], source,
      }),
    }
  }

  // ── readOnlyEdit: cellEditRequest handler ─────

  /**
   * Handle AG-Grid's cellEditRequest event.
   *
   * With readOnlyEdit: true, AG-Grid fires this instead of
   * mutating data. Runs the full Effect pipeline:
   *   parse → coerce → validate → record → commit
   *
   * Returns an EditRequestResult (also fires onEditResult callback).
   */
  handleCellEditRequest(params: {
    colDef: { field?: string }
    data: { _rowIndex: number }
    newValue: unknown
    column?: { getColId?: () => string }
  }): EditRequestResult {
    const field = params.colDef.field ?? params.column?.getColId?.() ?? ""
    const colMatch = field.match(/^col_(\d+)$/)
    const col = colMatch ? parseInt(colMatch[1]!, 10) : 0
    const row = params.data._rowIndex
    const addr: ColRow = { col, row }
    const rawValue = params.newValue

    const value: CellValue = typeof rawValue === "string"
      ? parseEditorValue(rawValue)
      : typeof rawValue === "number"
        ? num(rawValue)
        : typeof rawValue === "boolean"
          ? bool(rawValue)
          : str(String(rawValue ?? ""))

    const result = Effect.runSync(this.editEffect(addr, value))
    this.onEditResult?.(result)
    return result
  }

  /**
   * Handle bulk paste via cellEditRequest.
   *
   * Same pipeline as single edit but batched:
   * all cells validated first, then committed atomically.
   */
  handlePasteRequest(
    entries: ReadonlyArray<{ addr: ColRow; rawValue: string; dtype?: string }>,
  ): ReadonlyArray<EditRequestResult> {
    return Effect.runSync(this.pasteEffect(entries))
  }

  // ── Atom → AG-Grid subscription ───────────────

  /**
   * Subscribe to cell changes in a range and auto-queue
   * AG-Grid transactions via the TransactionCollector.
   */
  subscribeRange(startRow: number, endRow: number, cols: ReadonlyArray<number>): void {
    for (let row = startRow; row <= endRow; row++) {
      for (const col of cols) {
        const atom = this.datagrid.getCellAtom({ col, row })
        const unsub = this.datagrid.registry.subscribe(atom, (value) => {
          this.collector.queueUpdate(
            this.datagrid.sheetId,
            row,
            col,
            extractDisplay(value),
          )
        })
        this.subscriptions.push(unsub)
      }
    }
  }

  /**
   * Generate row data array for AG-Grid's rowData prop.
   */
  generateRowData(rowCount: number, colCount: number): DatagridRowData[] {
    const rows: DatagridRowData[] = []
    for (let row = 0; row < rowCount; row++) {
      const rowData: Record<string, unknown> = { _rowIndex: row }
      for (let col = 0; col < colCount; col++) {
        rowData[`col_${col}`] = extractDisplay(this.datagrid.getCell({ col, row }))
      }
      rows.push(rowData as DatagridRowData)
    }
    return rows
  }

  // ── AG-Grid gridOptions fragment ──────────────

  /**
   * Returns the AG-Grid gridOptions fragment for readOnlyEdit mode.
   *
   * Plug this into your <AgGridReact> props:
   * ```tsx
   * const bridge = new GridBridge(config)
   * <AgGridReact {...bridge.gridOptions()} columnDefs={colDefs} rowData={rowData} />
   * ```
   */
  gridOptions(): Record<string, unknown> {
    return {
      readOnlyEdit: true,
      undoRedoCellEditing: false,
      onCellEditRequest: (params: any) => this.handleCellEditRequest(params),
      getRowId: (params: any) => String(params.data._rowIndex),
    }
  }

  /** Flush pending transactions immediately */
  flush(): void {
    this.collector.flush()
  }

  /** Cleanup all subscriptions */
  destroy(): void {
    for (const unsub of this.subscriptions) unsub()
    this.subscriptions = []
    this.flush()
  }
}
