import { Schema } from "effect"

export const NuCmdkShellMode = Schema.Literal("command", "prompt", "yOrN", "whichKey")
export type NuCmdkShellMode = typeof NuCmdkShellMode.Type

export const NuCmdkShellKind = Schema.Literal(
  "all",
  "command",
  "pipeline",
  "entity",
  "action",
  "view",
  "navigation",
  "docs",
  "terminal",
  "workflow",
  "agent",
  "history",
  "file",
  "generic",
)
export type NuCmdkShellKind = typeof NuCmdkShellKind.Type

export const NuCmdkShellBadge = Schema.Struct({
  text: Schema.String,
  tone: Schema.NullOr(Schema.Literal("neutral", "warn", "success", "error", "info")),
})
export type NuCmdkShellBadge = typeof NuCmdkShellBadge.Type

export const NuCmdkShellRow = Schema.Struct({
  rowId: Schema.String,
  label: Schema.String,
  description: Schema.NullOr(Schema.String),
  kind: NuCmdkShellKind,
  score: Schema.Number,
  rendererToken: Schema.String,
  resolverIdentity: Schema.String,
  badges: Schema.Array(NuCmdkShellBadge),
  shortcuts: Schema.Array(Schema.String),
  sectionKey: Schema.optional(Schema.String),
  sectionTitle: Schema.optional(Schema.String),
  sectionPriority: Schema.optional(Schema.Int),
})
export type NuCmdkShellRow = typeof NuCmdkShellRow.Type

export const NuCmdkShellState = Schema.Struct({
  mode: NuCmdkShellMode,
  query: Schema.String,
  activeKind: NuCmdkShellKind,
  kinds: Schema.Array(NuCmdkShellKind),
  rows: Schema.Array(NuCmdkShellRow),
  selectedRowId: Schema.NullOr(Schema.String),
  isStreaming: Schema.Boolean,
  statusText: Schema.String,
})
export type NuCmdkShellState = typeof NuCmdkShellState.Type
