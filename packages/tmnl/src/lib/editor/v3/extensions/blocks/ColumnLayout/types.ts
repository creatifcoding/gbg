/**
 * ColumnLayout Types
 *
 * TypeScript interfaces for the column layout extension.
 *
 * @module editor/v3/extensions/blocks/ColumnLayout/types
 */

// =============================================================================
// Node Attributes
// =============================================================================

/**
 * Responsive behavior when viewport narrows.
 */
export type ResponsiveBehavior = 'stack' | 'scroll' | 'preserve';

/**
 * ColumnLayout node attributes stored in ProseMirror/Y.js.
 */
export interface ColumnLayoutAttrs {
  /** Unique block ID */
  readonly id: string;
  /** Number of columns (2-6) */
  readonly columns: number;
  /** Width ratios for each column (must sum to 1) */
  readonly widths: readonly number[];
  /** Gap between columns in pixels */
  readonly gap: number;
  /** Responsive behavior */
  readonly responsive: ResponsiveBehavior;
  /** Breakpoint for responsive stacking (px) */
  readonly stackBreakpoint: number;
}

/**
 * Column node attributes.
 */
export interface ColumnAttrs {
  /** Unique column ID */
  readonly id: string;
}

// =============================================================================
// Reactive State (Atom-based)
// =============================================================================

/**
 * Per-block reactive state managed via effect-atom.
 * This is ephemeral UI state, not persisted to the document.
 */
export interface ColumnLayoutState {
  /** Current width ratios (may differ during resize drag) */
  readonly widths: readonly number[];
  /** Whether resize drag is active */
  readonly isDragging: boolean;
  /** Index of the active resize handle (null if not dragging) */
  readonly activeHandle: number | null;
  /** Whether responsive stacking is currently active */
  readonly isStacked: boolean;
}

// =============================================================================
// Commands
// =============================================================================

/**
 * Options for inserting a column layout.
 */
export interface InsertColumnLayoutOptions {
  /** Number of columns (default: 2) */
  columns?: number;
  /** Initial width ratios (defaults to equal widths) */
  widths?: number[];
  /** Gap in pixels (default: 16) */
  gap?: number;
}

// =============================================================================
// Extension Options
// =============================================================================

/**
 * Configuration options for the ColumnLayout extension.
 */
export interface ColumnLayoutOptions {
  /** HTML attributes for the container */
  HTMLAttributes: Record<string, unknown>;
  /** Minimum column width ratio (default: 0.1) */
  minColumnWidth: number;
  /** Maximum columns allowed (default: 6) */
  maxColumns: number;
  /** Default gap in pixels (default: 16) */
  defaultGap: number;
  /** Default responsive breakpoint (default: 768) */
  defaultStackBreakpoint: number;
}

/**
 * Configuration options for the Column extension.
 */
export interface ColumnOptions {
  /** HTML attributes for the column container */
  HTMLAttributes: Record<string, unknown>;
}
