/**
 * Canvas Shape Schemas
 *
 * Effect Schema definitions for custom tldraw shapes used in collaborative canvas.
 * These schemas define the props for shapes that embed React components.
 *
 * @module canvas/schemas/shapes
 */

import { Schema } from 'effect';
import { SubdocId, SubdocType } from './canvas';

// =============================================================================
// EditorPanelShape Props
// =============================================================================

/**
 * Props for the EditorPanelShape - a tldraw shape that embeds AutonomousEditorPanel.
 *
 * The shape uses HTMLContainer to render the editor panel inside tldraw,
 * with a nested Y.Doc subdocument for isolated collaborative editing.
 */
export const EditorPanelShapeProps = Schema.Struct({
  /** Subdoc ID referencing the nested Y.Doc for this panel's content */
  subdocId: SubdocId,

  /** Type of content (currently always 'editor', but extensible) */
  contentType: Schema.optionalWith(SubdocType, {
    default: () => 'editor' as const,
  }),

  /** Panel title displayed in header */
  title: Schema.optionalWith(Schema.String, {
    default: () => 'Untitled Panel',
  }),

  /** Whether the panel is collapsed (header only) */
  collapsed: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),

  /** Whether the panel content is locked (read-only) */
  locked: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),

  /** Minimum width constraint */
  minWidth: Schema.optionalWith(Schema.Number, {
    default: () => 300,
  }),

  /** Minimum height constraint */
  minHeight: Schema.optionalWith(Schema.Number, {
    default: () => 200,
  }),

  /** Background opacity (0-1) */
  backgroundOpacity: Schema.optionalWith(Schema.Number.pipe(
    Schema.clamp({ minimum: 0, maximum: 1 })
  ), {
    default: () => 0.95,
  }),

  /** Custom CSS class for styling */
  className: Schema.optional(Schema.String),
});
export type EditorPanelShapeProps = typeof EditorPanelShapeProps.Type;

/**
 * Default props for creating a new EditorPanelShape.
 */
export const EditorPanelShapeDefaultProps: EditorPanelShapeProps = {
  subdocId: 'subdoc-placeholder' as SubdocId, // Will be replaced at creation
  contentType: 'editor',
  title: 'Untitled Panel',
  collapsed: false,
  locked: false,
  minWidth: 300,
  minHeight: 200,
  backgroundOpacity: 0.95,
};

// =============================================================================
// Future Shape Props (extensibility)
// =============================================================================

/**
 * Props for CodePanelShape - a shape that embeds a code editor (future).
 */
export const CodePanelShapeProps = Schema.Struct({
  /** Subdoc ID for code content */
  subdocId: SubdocId,

  /** Programming language for syntax highlighting */
  language: Schema.optionalWith(Schema.String, {
    default: () => 'typescript',
  }),

  /** Whether to show line numbers */
  showLineNumbers: Schema.optionalWith(Schema.Boolean, {
    default: () => true,
  }),

  /** Panel title */
  title: Schema.optionalWith(Schema.String, {
    default: () => 'Code',
  }),

  /** Collapsed state */
  collapsed: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),

  /** Read-only state */
  locked: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),

  /** Minimum dimensions */
  minWidth: Schema.optionalWith(Schema.Number, {
    default: () => 400,
  }),
  minHeight: Schema.optionalWith(Schema.Number, {
    default: () => 150,
  }),
});
export type CodePanelShapeProps = typeof CodePanelShapeProps.Type;

/**
 * Props for DataGridShape - a shape that embeds AG-Grid (future).
 */
export const DataGridShapeProps = Schema.Struct({
  /** Subdoc ID for data content */
  subdocId: SubdocId,

  /** Panel title */
  title: Schema.optionalWith(Schema.String, {
    default: () => 'Data Grid',
  }),

  /** Collapsed state */
  collapsed: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),

  /** Read-only state */
  locked: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),

  /** Column definitions (JSON-serializable) */
  columnDefs: Schema.optional(Schema.Array(Schema.Unknown)),

  /** Minimum dimensions */
  minWidth: Schema.optionalWith(Schema.Number, {
    default: () => 500,
  }),
  minHeight: Schema.optionalWith(Schema.Number, {
    default: () => 300,
  }),
});
export type DataGridShapeProps = typeof DataGridShapeProps.Type;

// =============================================================================
// Shape Type Union (for type guards)
// =============================================================================

/**
 * Union of all custom shape props for exhaustive pattern matching.
 */
export const CustomShapeProps = Schema.Union(
  EditorPanelShapeProps,
  CodePanelShapeProps,
  DataGridShapeProps
);
export type CustomShapeProps = typeof CustomShapeProps.Type;
