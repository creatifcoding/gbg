/**
 * ColumnSchema Types
 *
 * Generic, extensible column definition system for AG-Grid.
 * Allows payload-specific schemas to generate semantic column definitions.
 *
 * @module
 */

import type { ColDef, ICellRendererParams, ValueGetterParams } from 'ag-grid-community'
import type { GridVariantType } from '../schemas'

// =============================================================================
// CORE TYPES
// =============================================================================

/**
 * Cell renderer configuration extracted from column schema.
 * Allows schemas to define renderers without direct React component coupling.
 */
export interface CellRendererConfig<TData = unknown> {
  /** Unique renderer ID for registry */
  id: string
  /** Display name for debugging */
  name: string
  /** Value extractor from cell params */
  getValue: (params: ICellRendererParams<TData>) => unknown
  /** Style generator (receives variant + value) */
  getStyle: (value: unknown, variant: GridVariantType) => React.CSSProperties
  /** Format value for display */
  formatValue: (value: unknown) => string | React.ReactNode
}

/**
 * Column group definition for semantic grouping.
 * E.g., "Sensor" group with "Value" and "Unit" children.
 */
export interface ColumnGroupConfig<TData = unknown> {
  /** Group header name */
  headerName: string
  /** Header CSS class */
  headerClass?: string
  /** Keep children together when resizing */
  marryChildren?: boolean
  /** Child column definitions */
  children: ColumnConfig<TData>[]
}

/**
 * Single column configuration.
 * Abstraction over AG-Grid ColDef with schema-aware defaults.
 */
export interface ColumnConfig<TData = unknown> {
  /** Column field (for direct field mapping) */
  field?: string
  /** Header display name */
  headerName: string
  /** Column width */
  width?: number
  /** Minimum width */
  minWidth?: number
  /** Prevent auto-sizing */
  suppressSizeToFit?: boolean
  /** Pin to left/right */
  pinned?: 'left' | 'right'
  /** Value getter (for computed values) */
  valueGetter?: (params: ValueGetterParams<TData>) => unknown
  /** Value formatter (for display) */
  valueFormatter?: (params: { value: unknown }) => string
  /** Cell renderer (React component or renderer config) */
  cellRenderer?: React.ComponentType<ICellRendererParams<TData>> | CellRendererConfig<TData>
  /** Cell style object or function */
  cellStyle?: React.CSSProperties | ((params: ICellRendererParams<TData>) => React.CSSProperties)
  /** Sortable */
  sortable?: boolean
  /** Resizable */
  resizable?: boolean
}

/**
 * Schema metadata for registration and introspection.
 */
export interface SchemaMetadata {
  /** Unique schema ID (e.g., 'senml', 'opcua', 'prometheus') */
  id: string
  /** Human-readable name */
  name: string
  /** Description of the payload format */
  description: string
  /** Brand color (hex) */
  color: string
  /** Icon (emoji or component) */
  icon?: string
}

// =============================================================================
// COLUMN SCHEMA INTERFACE
// =============================================================================

/**
 * ColumnSchema interface - the core abstraction.
 *
 * Implement this interface to create custom payload schemas.
 * Each schema knows how to:
 * 1. Detect if a payload matches its format
 * 2. Generate semantic column definitions
 * 3. Provide cell renderers for payload-specific fields
 *
 * @typeParam TData - Row data type
 * @typeParam TPayload - Payload type this schema handles
 */
export interface ColumnSchema<TData = unknown, TPayload = unknown> {
  /** Schema metadata */
  readonly metadata: SchemaMetadata

  /**
   * Detect if a payload matches this schema's format.
   * @param payload - Raw payload to check
   * @returns true if payload matches this schema
   */
  detect(payload: unknown): payload is TPayload

  /**
   * Generate column definitions for this schema.
   * @param variant - Grid variant for styling
   * @returns Array of column definitions (groups or single columns)
   */
  generateColumns(variant: GridVariantType): Array<ColDef<TData>>

  /**
   * Get the primary cell renderer for this schema.
   * Used for the main "Payload" column in compact views.
   * @param variant - Grid variant for styling
   * @returns React component for cell rendering
   */
  getPayloadRenderer(variant: GridVariantType): React.ComponentType<ICellRendererParams<TData>>

  /**
   * Extract summary info from payload for quick display.
   * @param payload - Payload to summarize
   * @returns Summary object with label, value, count, etc.
   */
  getSummary(payload: TPayload): PayloadSummary
}

/**
 * Payload summary for quick display in compact views.
 */
export interface PayloadSummary {
  /** Primary label (e.g., sensor name, metric name) */
  label: string
  /** Primary value */
  value: string | number
  /** Unit if applicable */
  unit?: string
  /** Count of items (e.g., "5 sensors", "3 metrics") */
  count?: number
  /** Additional context */
  context?: string
}

// =============================================================================
// REGISTRY TYPES
// =============================================================================

/**
 * Schema registry configuration.
 */
export interface ColumnSchemaRegistryConfig {
  /** Default schema ID to use when no match found */
  defaultSchemaId?: string
  /** Enable debug logging */
  debug?: boolean
}

/**
 * Column schema registry interface.
 */
export interface ColumnSchemaRegistry {
  /**
   * Register a schema.
   * @param schema - Schema to register
   */
  register<TData, TPayload>(schema: ColumnSchema<TData, TPayload>): void

  /**
   * Get schema by ID.
   * @param id - Schema ID
   * @returns Schema or undefined
   */
  get<TData = unknown, TPayload = unknown>(id: string): ColumnSchema<TData, TPayload> | undefined

  /**
   * Detect schema from payload.
   * @param payload - Payload to analyze
   * @returns Matching schema or undefined
   */
  detect<TData = unknown>(payload: unknown): ColumnSchema<TData, unknown> | undefined

  /**
   * Get all registered schemas.
   * @returns Array of registered schemas
   */
  getAll(): ReadonlyArray<ColumnSchema<unknown, unknown>>

  /**
   * Get schema IDs.
   * @returns Array of schema IDs
   */
  getIds(): ReadonlyArray<string>
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Convert ColumnConfig to AG-Grid ColDef.
 */
export type ToColDef<TData> = (
  config: ColumnConfig<TData> | ColumnGroupConfig<TData>,
  variant: GridVariantType
) => ColDef<TData>

/**
 * Column schema factory function type.
 */
export type ColumnSchemaFactory<TData = unknown, TPayload = unknown> = (
  options?: Partial<SchemaMetadata>
) => ColumnSchema<TData, TPayload>
