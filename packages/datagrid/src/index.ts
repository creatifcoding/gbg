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

// ── Stack VM (Formula DSL) ──────────────────────────
export {
  // Value types + constructors
  VMValue, VMNum, VMStr, VMBool, VMError,
  num as vmNum, str as vmStr, bool as vmBool,
  vmError, err as vmErr, isVMError, isNumeric, toNumber, asNum, vmEq, vmDisplay,
  propagateError,
  // Error codes + display
  VMErrorCode, errorCodeDisplay,
  // Effect E channel errors
  CompileError, EvalError, ResourceError, type VMFailure,
  failureToVMError, timeoutToVMError, catchToErrorState,
  // Opcodes
  Opcode, type StackIR,
  PUSH_NUM, PUSH_STR, PUSH_BOOL,
  ADD, SUB, MUL, DIV, MOD, ABS,
  CONCAT, TO_NUM, TO_STR,
  DUP, SWAP, DROP, NEG,
  EQ, LT, GT, GTE, LTE, NEQ, NOT, IF, IFERROR,
  SUM_N, MIN_N, MAX_N, AVG_N,
  SUM_DYN, MIN_DYN, MAX_DYN, AVG_DYN, COUNT_DYN,
  POWER, ROUND, FLOOR_OP, CEIL_OP,
  NOW_OP, RAND_OP,
  HALT, READ_CELL, WRITE_CELL, READ_RANGE,
  // VM State
  type VMState, type TrailEntry,
  VMStateSchema, TrailEntrySchema, vmStateDiffer,
  emptyState, MAX_EVAL_STEPS,
  // Cell Context
  type CellContext, emptyCellContext,
  // Execution
  execOpcode, runIR, runEffect,
  evalProgram, evalExpr, compileExpr, compileExprSync,
  compileInfix, compileInfixSync, extractDepsInfix,
  isVolatileIR,
  evalProgramDirect,
  decompileIR,
  evalProgramBulk,
  analyzeIR,
  type IRMetrics,
  formatVMError,
  formatCellValue,
  FUNCTION_CATALOG,
  completeFunctions,
  type FunctionSignature,
  extractDeps, extractDepsFromIR,
  type EvalInput, dualEval,
  // Service
  StackVM, StackVMLive, type StackVMConfig,
  // Metrics
  evalCounter, evalErrorCounter, compileErrorCounter, evalLatency, cacheHitCounter,
} from "./services/stack-vm"
export {
  cellToVM, vmToCell, cellsToVM, vmsToCell,
  cellDisplayVM, isLosslessRoundTrip,
} from "./services/vm-cell-bridge"
export {
  DepGraph, makeDepGraph, CircularDepError,
  type CellNode,
} from "./services/dep-graph"

// ── FormulaEngine V2 (StackVM-powered) ─────────────
export {
  FormulaEngineV2, FormulaEngineV2Config, FormulaEngineV2Live,
  type FormulaEngineV2Shape, type FormulaEngineV2ConfigShape,
  type FormulaRecord, type RecalcResult, type CellStore,
} from "./services/formula-engine-v2"

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
