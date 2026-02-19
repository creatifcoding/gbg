/**
 * @fileoverview Effect Schema definitions for genifer
 *
 * Replaces Zod with Effect Schema for:
 * - Type-safe runtime validation via Schema.decode
 * - TaggedClass for discriminated unions with Match
 * - Built-in Effect integration
 *
 * USAGE: Always use Schema.decode/decodeSync at boundaries,
 * then the types flow naturally through the system.
 */

import * as Schema from "effect/Schema"
import { Effect, pipe } from "effect"
import { EntranceAnimation } from "./animation-schema"

// =============================================================================
// Dynamic Values
// =============================================================================

/**
 * Decode error emitted when a streamed patch line fails JSON parse or Schema decode.
 */
export class JsonRenderDecodeError extends Schema.TaggedClass<JsonRenderDecodeError>()(
  "JsonRenderDecodeError",
  {
    stage: Schema.Literal("parse", "decode"),
    line: Schema.String,
    chunk: Schema.String,
    parsed: Schema.optional(Schema.Unknown),
    message: Schema.String,
    timestamp: Schema.Number,
    streamId: Schema.optional(Schema.String),
    context: Schema.optional(Schema.Unknown),
    lineIndex: Schema.optional(Schema.Number),
  }
) {}

/** Path reference to data model */
export class PathRef extends Schema.Class<PathRef>("PathRef")({
  path: Schema.String
}) {}

/** Dynamic value - literal or path reference */
export const DynamicString = Schema.Union(Schema.String, PathRef)
export type DynamicString = Schema.Schema.Type<typeof DynamicString>

export const DynamicNumber = Schema.Union(Schema.Number, PathRef)
export type DynamicNumber = Schema.Schema.Type<typeof DynamicNumber>

export const DynamicBoolean = Schema.Union(Schema.Boolean, PathRef)
export type DynamicBoolean = Schema.Schema.Type<typeof DynamicBoolean>

export const DynamicUnknown = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.Boolean,
  Schema.Null,
  PathRef
)
export type DynamicUnknown = Schema.Schema.Type<typeof DynamicUnknown>

// =============================================================================
// Visibility Conditions (Tagged Classes for Match.exhaustive)
// =============================================================================

/** Auth condition */
export class AuthCondition extends Schema.TaggedClass<AuthCondition>()("AuthCondition", {
  auth: Schema.Literal("signedIn", "signedOut")
}) {}

/** Path condition - truthy check */
export class PathCondition extends Schema.TaggedClass<PathCondition>()("PathCondition", {
  path: Schema.String
}) {}

/** Equality comparison */
export class EqCondition extends Schema.TaggedClass<EqCondition>()("EqCondition", {
  left: DynamicUnknown,
  right: DynamicUnknown
}) {}

/** Not equal comparison */
export class NeqCondition extends Schema.TaggedClass<NeqCondition>()("NeqCondition", {
  left: DynamicUnknown,
  right: DynamicUnknown
}) {}

/** Greater than comparison */
export class GtCondition extends Schema.TaggedClass<GtCondition>()("GtCondition", {
  left: DynamicNumber,
  right: DynamicNumber
}) {}

/** Greater than or equal comparison */
export class GteCondition extends Schema.TaggedClass<GteCondition>()("GteCondition", {
  left: DynamicNumber,
  right: DynamicNumber
}) {}

/** Less than comparison */
export class LtCondition extends Schema.TaggedClass<LtCondition>()("LtCondition", {
  left: DynamicNumber,
  right: DynamicNumber
}) {}

/** Less than or equal comparison */
export class LteCondition extends Schema.TaggedClass<LteCondition>()("LteCondition", {
  left: DynamicNumber,
  right: DynamicNumber
}) {}

// Forward declaration for recursive schema
type LogicExpressionEncoded =
  | { readonly _tag: "AndCondition"; readonly conditions: readonly LogicExpressionEncoded[] }
  | { readonly _tag: "OrCondition"; readonly conditions: readonly LogicExpressionEncoded[] }
  | { readonly _tag: "NotCondition"; readonly condition: LogicExpressionEncoded }
  | { readonly _tag: "PathCondition"; readonly path: string }
  | { readonly _tag: "EqCondition"; readonly left: DynamicUnknown; readonly right: DynamicUnknown }
  | { readonly _tag: "NeqCondition"; readonly left: DynamicUnknown; readonly right: DynamicUnknown }
  | { readonly _tag: "GtCondition"; readonly left: DynamicNumber; readonly right: DynamicNumber }
  | { readonly _tag: "GteCondition"; readonly left: DynamicNumber; readonly right: DynamicNumber }
  | { readonly _tag: "LtCondition"; readonly left: DynamicNumber; readonly right: DynamicNumber }
  | { readonly _tag: "LteCondition"; readonly left: DynamicNumber; readonly right: DynamicNumber }

/** Union of all logic expressions */
export type LogicExpression =
  | AndCondition
  | OrCondition
  | NotCondition
  | PathCondition
  | EqCondition
  | NeqCondition
  | GtCondition
  | GteCondition
  | LtCondition
  | LteCondition

// Lazy schema for recursive types
const LogicExpressionSchema: Schema.Schema<LogicExpression, LogicExpressionEncoded> = Schema.suspend(
  () => Schema.Union(
    AndCondition,
    OrCondition,
    NotCondition,
    PathCondition,
    EqCondition,
    NeqCondition,
    GtCondition,
    GteCondition,
    LtCondition,
    LteCondition
  )
) as Schema.Schema<LogicExpression, LogicExpressionEncoded>

/** AND condition - all must be true */
export class AndCondition extends Schema.TaggedClass<AndCondition>()("AndCondition", {
  conditions: Schema.Array(LogicExpressionSchema)
}) {}

/** OR condition - any must be true */
export class OrCondition extends Schema.TaggedClass<OrCondition>()("OrCondition", {
  conditions: Schema.Array(LogicExpressionSchema)
}) {}

/** NOT condition - negation */
export class NotCondition extends Schema.TaggedClass<NotCondition>()("NotCondition", {
  condition: LogicExpressionSchema
}) {}

/** Full visibility condition */
export const VisibilityCondition = Schema.Union(
  Schema.Boolean,
  AuthCondition,
  LogicExpressionSchema
)
export type VisibilityCondition = Schema.Schema.Type<typeof VisibilityCondition>

// =============================================================================
// UI Element & Tree
// =============================================================================

/** Base UI element */
export class UIElement extends Schema.Class<UIElement>("UIElement")({
  key: Schema.String,
  type: Schema.String,
  props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  children: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  parentKey: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  visible: Schema.optional(VisibilityCondition),
  /** Entrance animation configuration (LLM-generated or catalog default) */
  entrance: Schema.optional(EntranceAnimation),
}) {}

/** Flat UI tree structure */
export class UITree extends Schema.Class<UITree>("UITree")({
  root: Schema.String,
  elements: Schema.Record({ key: Schema.String, value: UIElement })
}) {
  /** Create empty tree */
  static empty(): UITree {
    return new UITree({ root: "", elements: {} })
  }

  /** Get element by key */
  getElement(key: string): UIElement | undefined {
    return this.elements[key]
  }

  /** Set element (returns new tree) */
  setElement(key: string, element: UIElement): UITree {
    return new UITree({
      root: this.root,
      elements: { ...this.elements, [key]: element }
    })
  }

  /** Remove element (returns new tree) */
  removeElement(key: string): UITree {
    const { [key]: _, ...rest } = this.elements
    return new UITree({ root: this.root, elements: rest })
  }

  /** Set root (returns new tree) */
  setRoot(root: string): UITree {
    return new UITree({ root, elements: this.elements })
  }
}

// =============================================================================
// Actions
// =============================================================================

/** Confirmation dialog configuration */
export class ActionConfirm extends Schema.Class<ActionConfirm>("ActionConfirm")({
  title: Schema.String,
  message: Schema.String,
  confirmLabel: Schema.optional(Schema.String),
  cancelLabel: Schema.optional(Schema.String),
  variant: Schema.optional(Schema.Literal("default", "danger"))
}) {}

/** Navigate success handler */
export class NavigateHandler extends Schema.TaggedClass<NavigateHandler>()("NavigateHandler", {
  navigate: Schema.String
}) {}

/** Set data success handler */
export class SetDataHandler extends Schema.TaggedClass<SetDataHandler>()("SetDataHandler", {
  set: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}

/** Chain action handler */
export class ChainActionHandler extends Schema.TaggedClass<ChainActionHandler>()("ChainActionHandler", {
  action: Schema.String
}) {}

/** Success handler union */
export const ActionOnSuccess = Schema.Union(
  NavigateHandler,
  SetDataHandler,
  ChainActionHandler
)
export type ActionOnSuccess = Schema.Schema.Type<typeof ActionOnSuccess>

/** Error handler union */
export const ActionOnError = Schema.Union(
  SetDataHandler,
  ChainActionHandler
)
export type ActionOnError = Schema.Schema.Type<typeof ActionOnError>

/** Rich action definition (pre-resolution - params may contain dynamic refs) */
export class Action extends Schema.Class<Action>("Action")({
  name: Schema.String,
  params: Schema.optional(Schema.Record({ key: Schema.String, value: DynamicUnknown })),
  confirm: Schema.optional(ActionConfirm),
  onSuccess: Schema.optional(ActionOnSuccess),
  onError: Schema.optional(ActionOnError)
}) {}

/** Resolved action (post-resolution - all dynamic values resolved) */
export class ResolvedAction extends Schema.Class<ResolvedAction>("ResolvedAction")({
  name: Schema.String,
  params: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  confirm: Schema.optional(ActionConfirm),
  onSuccess: Schema.optional(ActionOnSuccess),
  onError: Schema.optional(ActionOnError)
}) {}

// =============================================================================
// Validation
// =============================================================================

/** Validation check */
export class ValidationCheck extends Schema.Class<ValidationCheck>("ValidationCheck")({
  fn: Schema.String,
  args: Schema.optional(Schema.Record({ key: Schema.String, value: DynamicUnknown })),
  message: Schema.String
}) {}

/** Field validation configuration */
export class ValidationConfig extends Schema.Class<ValidationConfig>("ValidationConfig")({
  checks: Schema.optionalWith(Schema.Array(ValidationCheck), { default: () => [] }),
  validateOn: Schema.optional(Schema.Literal("change", "blur", "submit")),
  enabled: Schema.optional(LogicExpressionSchema)
}) {}

// =============================================================================
// JSON Patch
// =============================================================================

/** Patch operation types */
export const PatchOp = Schema.Literal("add", "remove", "replace", "set")
export type PatchOp = Schema.Schema.Type<typeof PatchOp>

/** JSON patch operation */
export class JsonPatch extends Schema.Class<JsonPatch>("JsonPatch")({
  op: PatchOp,
  path: Schema.String,
  value: Schema.optional(Schema.Unknown)
}) {}

// =============================================================================
// Context Types
// =============================================================================

/** Auth state for visibility evaluation */
export class AuthState extends Schema.Class<AuthState>("AuthState")({
  isSignedIn: Schema.Boolean,
  user: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
}) {}

/** Data model type */
export const DataModel = Schema.Record({ key: Schema.String, value: Schema.Unknown })
export type DataModel = Schema.Schema.Type<typeof DataModel>

/** Validation mode for catalog validation */
export const ValidationMode = Schema.Literal("strict", "warn", "ignore")
export type ValidationMode = Schema.Schema.Type<typeof ValidationMode>

// =============================================================================
// Decoders (use at boundaries!)
// =============================================================================

/** Decode a JsonPatch from unknown */
export const decodeJsonPatch = Schema.decodeUnknown(JsonPatch)

/** Decode a UIElement from unknown */
export const decodeUIElement = Schema.decodeUnknown(UIElement)

/** Decode a UITree from unknown */
export const decodeUITree = Schema.decodeUnknown(UITree)

/** Decode an Action from unknown */
export const decodeAction = Schema.decodeUnknown(Action)

/** Decode sync versions */
export const decodeJsonPatchSync = Schema.decodeUnknownSync(JsonPatch)
export const decodeUIElementSync = Schema.decodeUnknownSync(UIElement)
export const decodeUITreeSync = Schema.decodeUnknownSync(UITree)
export const decodeActionSync = Schema.decodeUnknownSync(Action)

// =============================================================================
// Type Guards (use Schema.is for runtime checks)
// =============================================================================

export const isPathRef = Schema.is(PathRef)
export const isUIElement = Schema.is(UIElement)
export const isUITree = Schema.is(UITree)
export const isJsonPatch = Schema.is(JsonPatch)
export const isAction = Schema.is(Action)
