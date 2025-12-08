/**
 * SCADA Overlay Types
 *
 * Domain primitives for industrial HMI overlays.
 * Port naming convention: {domain}:{entity}:{property}
 *
 * Uses Effect Schema for runtime validation and branded types.
 *
 * @example
 * - tag:FIC-101:pv     → Process value for flow controller
 * - alarm:FIC-101:active → Alarm state
 * - faceplate:FIC-101:open → Faceplate visibility
 */

import { Schema } from "effect"
import type { PortId } from "../schemas"

// ─────────────────────────────────────────────────────────────
// Tag Domain
// ─────────────────────────────────────────────────────────────

/** Tag identifier (ISA-95 style) */
export const TagId = Schema.String.pipe(
  Schema.brand("TagId"),
  Schema.minLength(1),
)
export type TagId = typeof TagId.Type

/** Tag quality indicators */
export const TagQuality = Schema.Literal("good", "bad", "uncertain", "stale")
export type TagQuality = typeof TagQuality.Type

/** Tag value with metadata */
export class TagValue<T = number> extends Schema.TaggedClass<TagValue<T>>()(
  "TagValue",
  {
    value: Schema.Unknown,
    quality: TagQuality,
    timestamp: Schema.Number,
    units: Schema.optional(Schema.String),
  }
) {}

/** Numeric tag value (most common) */
export const NumericTagValue = Schema.TaggedStruct("TagValue", {
  value: Schema.Number,
  quality: TagQuality,
  timestamp: Schema.Number,
  units: Schema.optional(Schema.String),
})
export type NumericTagValue = typeof NumericTagValue.Type

/** Tag configuration */
export const TagConfig = Schema.Struct({
  tagId: TagId,
  description: Schema.optional(Schema.String),
  units: Schema.optional(Schema.String),
  engLow: Schema.optional(Schema.Number),
  engHigh: Schema.optional(Schema.Number),
  precision: Schema.optional(Schema.Number),
})
export type TagConfig = typeof TagConfig.Type

/** Port ID factory for tag domain */
export const tagPort = {
  pv: (tagId: TagId): PortId => `tag:${tagId}:pv` as PortId,
  sp: (tagId: TagId): PortId => `tag:${tagId}:sp` as PortId,
  op: (tagId: TagId): PortId => `tag:${tagId}:op` as PortId,
  mode: (tagId: TagId): PortId => `tag:${tagId}:mode` as PortId,
}

// ─────────────────────────────────────────────────────────────
// Alarm Domain
// ─────────────────────────────────────────────────────────────

/** Alarm priority levels */
export const AlarmPriority = Schema.Literal("critical", "high", "medium", "low", "info")
export type AlarmPriority = typeof AlarmPriority.Type

/** Alarm state */
export const AlarmState = Schema.Literal("active", "acknowledged", "cleared", "shelved")
export type AlarmState = typeof AlarmState.Type

/** Alarm instance */
export const Alarm = Schema.TaggedStruct("Alarm", {
  tagId: TagId,
  priority: AlarmPriority,
  state: AlarmState,
  message: Schema.String,
  timestamp: Schema.Number,
  acknowledgedBy: Schema.optional(Schema.String),
  acknowledgedAt: Schema.optional(Schema.Number),
})
export type Alarm = typeof Alarm.Type

/** Port ID factory for alarm domain */
export const alarmPort = {
  active: (tagId: TagId): PortId => `alarm:${tagId}:active` as PortId,
  state: (tagId: TagId): PortId => `alarm:${tagId}:state` as PortId,
  list: (): PortId => `alarm:list` as PortId,
}

// ─────────────────────────────────────────────────────────────
// Faceplate Domain
// ─────────────────────────────────────────────────────────────

/** Faceplate open state */
export const FaceplateState = Schema.TaggedStruct("FaceplateState", {
  tagId: TagId,
  open: Schema.Boolean,
  position: Schema.optional(Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
  })),
})
export type FaceplateState = typeof FaceplateState.Type

/** Port ID factory for faceplate domain */
export const faceplatePort = {
  open: (tagId: TagId): PortId => `faceplate:${tagId}:open` as PortId,
  state: (tagId: TagId): PortId => `faceplate:${tagId}:state` as PortId,
}

// ─────────────────────────────────────────────────────────────
// Navigation Domain
// ─────────────────────────────────────────────────────────────

/** Screen identifier */
export const ScreenId = Schema.String.pipe(
  Schema.brand("ScreenId"),
  Schema.minLength(1),
)
export type ScreenId = typeof ScreenId.Type

/** Navigation state */
export const NavigationState = Schema.TaggedStruct("NavigationState", {
  currentScreen: ScreenId,
  previousScreen: Schema.optional(ScreenId),
  breadcrumb: Schema.Array(ScreenId),
})
export type NavigationState = typeof NavigationState.Type

/** Port ID factory for navigation domain */
export const navPort = {
  current: (): PortId => `nav:screen:current` as PortId,
  breadcrumb: (): PortId => `nav:screen:breadcrumb` as PortId,
  navigate: (): PortId => `nav:screen:navigate` as PortId,
}

// ─────────────────────────────────────────────────────────────
// Chart Domain
// ─────────────────────────────────────────────────────────────

/** Chart identifier */
export const ChartId = Schema.String.pipe(
  Schema.brand("ChartId"),
  Schema.minLength(1),
)
export type ChartId = typeof ChartId.Type

/** Chart data point */
export const ChartDataPoint = Schema.Struct({
  timestamp: Schema.Number,
  value: Schema.Number,
})
export type ChartDataPoint = typeof ChartDataPoint.Type

/** Chart trace */
export const ChartTrace = Schema.TaggedStruct("ChartTrace", {
  tagId: TagId,
  data: Schema.Array(ChartDataPoint),
  color: Schema.optional(Schema.String),
})
export type ChartTrace = typeof ChartTrace.Type

/** Port ID factory for chart domain */
export const chartPort = {
  data: (chartId: ChartId): PortId => `chart:${chartId}:data` as PortId,
  config: (chartId: ChartId): PortId => `chart:${chartId}:config` as PortId,
}

// ─────────────────────────────────────────────────────────────
// Grid Domain
// ─────────────────────────────────────────────────────────────

/** Grid identifier */
export const GridId = Schema.String.pipe(
  Schema.brand("GridId"),
  Schema.minLength(1),
)
export type GridId = typeof GridId.Type

/** Port ID factory for grid domain */
export const gridPort = {
  rows: (gridId: GridId): PortId => `grid:${gridId}:rows` as PortId,
  selected: (gridId: GridId): PortId => `grid:${gridId}:selected` as PortId,
  config: (gridId: GridId): PortId => `grid:${gridId}:config` as PortId,
}

// ─────────────────────────────────────────────────────────────
// Command Domain
// ─────────────────────────────────────────────────────────────

/** Command target */
export const CommandTarget = Schema.String.pipe(
  Schema.brand("CommandTarget"),
)
export type CommandTarget = typeof CommandTarget.Type

/** Command request */
export const CommandRequest = Schema.TaggedStruct("CommandRequest", {
  target: CommandTarget,
  action: Schema.String,
  params: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  requiresConfirmation: Schema.optional(Schema.Boolean),
})
export type CommandRequest = typeof CommandRequest.Type

/** Command result */
export const CommandResult = Schema.TaggedStruct("CommandResult", {
  success: Schema.Boolean,
  message: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
})
export type CommandResult = typeof CommandResult.Type

/** Port ID factory for command domain */
export const cmdPort = {
  execute: (target: CommandTarget): PortId => `cmd:${target}:execute` as PortId,
  result: (target: CommandTarget): PortId => `cmd:${target}:result` as PortId,
}
