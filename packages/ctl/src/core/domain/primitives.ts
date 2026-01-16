/**
 * UI Primitive Schemas
 *
 * React-compatible primitives that work across Ink (inline) and OpenTUI (full TUI).
 * These map to actual React components in the render layer.
 *
 * @module @gbg/ctl/core/domain/primitives
 */

import { Schema } from "effect"

// =============================================================================
// OUTPUT MODE
// =============================================================================

export const OutputMode = Schema.Literal("inline", "agent", "tui")
export type OutputMode = Schema.Schema.Type<typeof OutputMode>

// =============================================================================
// LAYOUT PRIMITIVES
// =============================================================================

export const BoxProps = Schema.Struct({
  flexDirection: Schema.optional(Schema.Literal("row", "column")),
  gap: Schema.optional(Schema.Number),
  padding: Schema.optional(Schema.Number),
  borderStyle: Schema.optional(Schema.Literal("single", "double", "round", "bold", "classic")),
})

export const TextProps = Schema.Struct({
  color: Schema.optional(Schema.String),
  bold: Schema.optional(Schema.Boolean),
  italic: Schema.optional(Schema.Boolean),
  dimColor: Schema.optional(Schema.Boolean),
})

export const SpacerProps = Schema.Struct({})

export const DividerProps = Schema.Struct({
  title: Schema.optional(Schema.String),
})

// =============================================================================
// INTERACTIVE PRIMITIVES
// =============================================================================

export const SelectOption = Schema.Struct({
  label: Schema.String,
  value: Schema.String,
  description: Schema.optional(Schema.String),
})

export const SelectProps = Schema.Struct({
  options: Schema.Array(SelectOption),
  placeholder: Schema.optional(Schema.String),
})

export const TextInputProps = Schema.Struct({
  placeholder: Schema.optional(Schema.String),
  mask: Schema.optional(Schema.String),
})

export const ConfirmProps = Schema.Struct({
  message: Schema.String,
  defaultValue: Schema.optional(Schema.Boolean),
})

// =============================================================================
// FEEDBACK PRIMITIVES
// =============================================================================

export const SpinnerProps = Schema.Struct({
  type: Schema.optional(Schema.Literal("dots", "line", "arc", "bounce")),
  label: Schema.optional(Schema.String),
})

export const ProgressBarProps = Schema.Struct({
  value: Schema.Number,
  max: Schema.optionalWith(Schema.Number, { default: () => 100 }),
  label: Schema.optional(Schema.String),
})

export const AlertType = Schema.Literal("info", "success", "warning", "error")

export const AlertProps = Schema.Struct({
  type: AlertType,
  title: Schema.optional(Schema.String),
  message: Schema.String,
})

export const BadgeProps = Schema.Struct({
  label: Schema.String,
  color: Schema.optional(Schema.String),
})

// =============================================================================
// DATA PRIMITIVES
// =============================================================================

export const TableColumn = Schema.Struct({
  key: Schema.String,
  header: Schema.String,
  width: Schema.optional(Schema.Number),
})

export const TableProps = Schema.Struct({
  columns: Schema.Array(TableColumn),
  data: Schema.Array(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

export const ListProps = Schema.Struct({
  items: Schema.Array(Schema.String),
  ordered: Schema.optional(Schema.Boolean),
})

export type TreeNode = {
  readonly label: string
  readonly children?: readonly TreeNode[]
}

export const TreeNode: Schema.Schema<TreeNode> = Schema.Struct({
  label: Schema.String,
  children: Schema.optional(Schema.Array(Schema.suspend(() => TreeNode))),
})

export const TreeProps = Schema.Struct({
  root: TreeNode,
})

export const KeyValueProps = Schema.Struct({
  data: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

// =============================================================================
// AI PRIMITIVES
// =============================================================================

export const ToolCallProps = Schema.Struct({
  name: Schema.String,
  args: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  status: Schema.Literal("pending", "running", "success", "error"),
  result: Schema.optional(Schema.Unknown),
})

export const StreamingTextProps = Schema.Struct({
  content: Schema.String,
  isComplete: Schema.Boolean,
})

export const CodeBlockProps = Schema.Struct({
  code: Schema.String,
  language: Schema.optional(Schema.String),
  showLineNumbers: Schema.optional(Schema.Boolean),
})

export const DiffLine = Schema.Struct({
  type: Schema.Literal("add", "remove", "context"),
  content: Schema.String,
  lineNumber: Schema.optional(Schema.Number),
})

export const DiffProps = Schema.Struct({
  lines: Schema.Array(DiffLine),
  filename: Schema.optional(Schema.String),
})

// =============================================================================
// PRIMITIVE UNION (for agent output)
// =============================================================================

export const PrimitiveType = Schema.Literal(
  // Layout
  "box", "text", "spacer", "divider",
  // Interactive
  "select", "text-input", "confirm",
  // Feedback
  "spinner", "progress", "alert", "badge",
  // Data
  "table", "list", "tree", "key-value",
  // AI
  "tool-call", "streaming-text", "code-block", "diff"
)
export type PrimitiveType = Schema.Schema.Type<typeof PrimitiveType>
