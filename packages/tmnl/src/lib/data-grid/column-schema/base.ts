/**
 * Base ColumnSchema Implementation
 *
 * Abstract base class providing common functionality for column schemas.
 * Extend this class to create payload-specific schemas.
 *
 * @module
 */

import type { ColDef, ICellRendererParams, ValueGetterParams } from 'ag-grid-community'
import type { GridVariantType } from '../schemas'
import type {
  ColumnSchema,
  SchemaMetadata,
  PayloadSummary,
  ColumnConfig,
  ColumnGroupConfig,
} from './types'

// =============================================================================
// ABSTRACT BASE CLASS
// =============================================================================

/**
 * BaseColumnSchema - Abstract base implementation.
 *
 * Provides:
 * - Metadata storage
 * - Column config → ColDef conversion
 * - Common styling utilities
 *
 * Subclasses must implement:
 * - detect() - Payload type detection
 * - generateColumns() - Column definition generation
 * - getPayloadRenderer() - Compact renderer component
 * - getSummary() - Payload summary extraction
 *
 * @typeParam TData - Row data type
 * @typeParam TPayload - Payload type this schema handles
 */
export abstract class BaseColumnSchema<TData = unknown, TPayload = unknown>
  implements ColumnSchema<TData, TPayload>
{
  readonly metadata: SchemaMetadata

  constructor(metadata: SchemaMetadata) {
    this.metadata = metadata
  }

  // ===========================================================================
  // ABSTRACT METHODS (must be implemented by subclasses)
  // ===========================================================================

  /**
   * Detect if payload matches this schema's format.
   */
  abstract detect(payload: unknown): payload is TPayload

  /**
   * Generate column definitions for this schema.
   */
  abstract generateColumns(variant: GridVariantType): Array<ColDef<TData>>

  /**
   * Get payload renderer component for compact display.
   */
  abstract getPayloadRenderer(variant: GridVariantType): React.ComponentType<ICellRendererParams<TData>>

  /**
   * Extract summary from payload.
   */
  abstract getSummary(payload: TPayload): PayloadSummary

  // ===========================================================================
  // UTILITY METHODS (available to subclasses)
  // ===========================================================================

  /**
   * Convert ColumnConfig to AG-Grid ColDef.
   */
  protected toColDef(config: ColumnConfig<TData>, variant: GridVariantType): ColDef<TData> {
    const colDef: ColDef<TData> = {
      headerName: config.headerName,
      width: config.width,
      minWidth: config.minWidth,
      suppressSizeToFit: config.suppressSizeToFit,
      pinned: config.pinned,
      sortable: config.sortable ?? false,
      resizable: config.resizable ?? true,
    }

    if (config.field) {
      colDef.field = config.field
    }

    if (config.valueGetter) {
      colDef.valueGetter = config.valueGetter
    }

    if (config.valueFormatter) {
      colDef.valueFormatter = config.valueFormatter as ColDef<TData>['valueFormatter']
    }

    // Handle cell renderer
    if (config.cellRenderer) {
      if (typeof config.cellRenderer === 'function') {
        colDef.cellRenderer = config.cellRenderer
      } else {
        // CellRendererConfig - create wrapper component
        const rendererConfig = config.cellRenderer
        colDef.cellRenderer = (params: ICellRendererParams<TData>) => {
          const value = rendererConfig.getValue(params)
          const style = rendererConfig.getStyle(value, variant)
          return (
            <span style={style}>{rendererConfig.formatValue(value)}</span>
          )
        }
      }
    }

    // Handle cell style
    if (config.cellStyle) {
      colDef.cellStyle = config.cellStyle as ColDef<TData>['cellStyle']
    }

    return colDef
  }

  /**
   * Convert ColumnGroupConfig to AG-Grid ColDef with children.
   */
  protected toColDefGroup(config: ColumnGroupConfig<TData>, variant: GridVariantType): ColDef<TData> {
    return {
      headerName: config.headerName,
      headerClass: config.headerClass,
      marryChildren: config.marryChildren ?? true,
      children: config.children.map((child) => this.toColDef(child, variant)),
    } as ColDef<TData>
  }

  /**
   * Create a value cell style with monospace font and tabular nums.
   */
  protected valueStyle(variant: GridVariantType, color?: string): React.CSSProperties {
    return {
      color: color ?? variant.colors.signal.accent,
      fontFamily: 'monospace',
      fontVariantNumeric: 'tabular-nums',
      fontSize: variant.density.fontSize,
    }
  }

  /**
   * Create a label/muted cell style.
   */
  protected mutedStyle(variant: GridVariantType): React.CSSProperties {
    return {
      color: variant.colors.text.muted,
      fontSize: variant.density.fontSizeXs,
    }
  }

  /**
   * Create a secondary cell style.
   */
  protected secondaryStyle(variant: GridVariantType): React.CSSProperties {
    return {
      color: variant.colors.text.secondary,
      fontSize: variant.density.fontSizeXs,
      fontFamily: 'monospace',
    }
  }

  /**
   * Format a number with locale string.
   */
  protected formatNumber(value: unknown, decimals = 2): string {
    if (typeof value !== 'number') return '—'
    return value.toFixed(decimals)
  }

  /**
   * Format a large number with K/M suffix.
   */
  protected formatCompact(value: unknown): string {
    if (typeof value !== 'number') return '—'
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
    return value.toFixed(1)
  }
}
