/**
 * @tmnl/datagrid — Reactive spreadsheet abstraction.
 *
 * Agentic state primitive with AG-Grid rendering,
 * Effect formulas, CRDT collaboration, and STX reactivity.
 *
 * @module
 */

// ── Schemas ─────────────────────────────────────────
export {
  CellValue,
  CellEmpty, CellNumber, CellString, CellBoolean,
  CellDate, CellJson, CellError, CellFormula,
  CellValueFromString,
  empty, num, str, bool, date, json, error, formula,
  extractNumber, extractDisplay,
} from "./schemas/cell-value"

export {
  type ColRow,
  type RangeRect,
  type CellAddress,
  type RangeAddress,
  CellKeySchema, type CellKey,
  colLetterToIndex, colIndexToLetter,
  parseA1, formatA1,
  parseRange, formatRange,
  resolveCell, resolveRange,
  iterateRange, rangeSize,
  cellKey, parseCellKey, validateCellKey,
} from "./schemas/addressing"

export {
  Cell, makeCell,
  InteractionPhase, Freshness, Computation, Permission, ErrorSource,
  type InteractionPhase as InteractionPhaseType,
  type Freshness as FreshnessType,
  type Computation as ComputationType,
  type Permission as PermissionType,
  type ErrorSource as ErrorSourceType,
} from "./schemas/cell"

// ── Store ───────────────────────────────────────────
export { MIGRATION_0001_INIT, MIGRATION_0002_FTS } from "./store/migrations"
export {
  cellQueries, columnQueries, namedRangeQueries, opsLogQueries,
  type CellRow, type ColumnRow, type NamedRangeRow, type OpsLogRow,
} from "./store/queries"

// ── Services ────────────────────────────────────────
export { Datagrid, DatagridConfig, makeDatagridLayer, type DatagridShape, type DatagridConfigShape } from "./services/datagrid"
export { CellCache, CellCacheConfig, CellCacheLive, type CellCacheShape, type CellCacheConfigShape } from "./services/cell-cache"
export { CellWriteError, makeCellErrorStore, type CellErrorState, type CellErrorStoreShape } from "./services/cell-errors"
export { AddressResolver, AddressResolverConfig, AddressResolverLive, type AddressResolverShape, type AddressResolverConfigShape } from "./services/address-resolver"
export { FormulaEngine, FormulaEngineConfig, FormulaEngineLive, type FormulaEngineShape, type FormulaEngineConfigShape, type FormulaRegistration } from "./services/formula-engine"
export { CrdtLayer, CrdtLayerConfig, CrdtLayerLive, type CrdtLayerShape, type CrdtLayerConfigShape, type CellOp, type MergeResult, type OpLogEntry } from "./services/crdt-layer"
export { UndoStack, UndoStackConfig, UndoStackLive, type UndoStackShape, type UndoStackConfigShape, type UndoEntry, type CellSnapshot, type UndoStackState } from "./services/undo-stack"
export {
  SchemaRegistry, SchemaRegistryConfig, SchemaRegistryLive,
  type SchemaRegistryShape, type SchemaRegistryConfigShape,
  type CellSchema, type ColumnSchemaBinding,
  NumberOnlySchema, StringOnlySchema, BooleanOnlySchema, numberRangeSchema,
} from "./services/schema-registry"
export {
  FormulaConsistency, FormulaConsistencyConfig, FormulaConsistencyLive,
  type FormulaConsistencyShape, type FormulaConsistencyConfigShape, type FormulaRecalcState,
} from "./services/formula-consistency"
export {
  DraftRestore, DraftRestoreConfig, DraftRestoreLive,
  type DraftRestoreShape, type DraftRestoreConfigShape,
  type CellDraftState, type UndoDispatchResult,
} from "./services/draft-restore"
export {
  CellRenderer, CellRendererConfig, CellRendererLive,
  type CellRendererShape, type CellRendererConfigShape,
  type CellVisual, type CellPhaseInput,
} from "./services/cell-renderer"

// ── Bridge ──────────────────────────────────────────
export {
  TransactionCollector,
  type GridTransaction, type RowUpdate, type TransactionStats,
} from "./bridge/transactions"
export {
  GridBridge, generateColDefs, generateDefaultColDefs, parseEditorValue,
  type GridBridgeConfig, type ColumnMeta, type DatagridColDef, type DatagridRowData, type EditRequestResult,
} from "./bridge/ag-grid"

// ── Hooks ───────────────────────────────────────────
export {
  useCell, useCellDisplay, useCellNumber,
  useCellSetter, useTrySetCell, useCellError,
  useRange, useTransactionalPaste,
  useFormula, useClock,
} from "./hooks/index"
