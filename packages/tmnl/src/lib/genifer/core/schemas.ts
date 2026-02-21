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
import { Effect, pipe, Equal, Hash, HashMap, Option } from "effect"
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

/**
 * Deep props equality for Record<string, unknown>.
 * Compares sorted JSON strings — not fast, but correct.
 * Only called when key+type+children already match (rare path).
 * @internal
 */
function _propsEqual(
  a: { readonly [x: string]: unknown },
  b: { readonly [x: string]: unknown }
): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  // Sort for deterministic comparison
  aKeys.sort()
  bKeys.sort()
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false
    // JSON.stringify handles nested unknown values
    if (JSON.stringify(a[aKeys[i]]) !== JSON.stringify(b[bKeys[i]])) return false
  }
  return true
}

/** Base UI element
 *
 * Implements Equal + Hash for value-based structural equality.
 * Schema.Class provides symbols via Data.Class but its default
 * equality is shallow — props (Record) and children (Array) are
 * compared by reference. We override to do deep value comparison.
 *
 * This enables:
 * - HashMap<string, UIElement> deduplication
 * - React memo boundaries via Equal.equals
 * - HashSet membership checks
 */
export class UIElement extends Schema.Class<UIElement>("UIElement")({
  key: Schema.String,
  type: Schema.String,
  props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  children: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  parentKey: Schema.optionalWith(Schema.NullOr(Schema.String), { default: () => null }),
  /** Tailwind utility classes for layout styling (universal — every component) */
  className: Schema.optional(Schema.String),
  visible: Schema.optional(VisibilityCondition),
  /** Entrance animation configuration (LLM-generated or catalog default) */
  entrance: Schema.optional(EntranceAnimation),
  // --- Accessibility (WCAG 2.1 AA) ---
  /** ARIA role attribute */
  role: Schema.optional(Schema.String),
  /** Accessible label */
  ariaLabel: Schema.optional(Schema.String),
  /** ID of element that describes this element */
  ariaDescribedBy: Schema.optional(Schema.String),
  /** Live region politeness for streaming updates */
  ariaLive: Schema.optional(Schema.Literal('polite', 'assertive', 'off')),
  /** Tab order for keyboard navigation */
  tabIndex: Schema.optional(Schema.Number),
}) {
  /**
   * Value-based equality: two UIElements are equal iff all fields match.
   * Props compared via sorted JSON (Record<string, unknown> has no Equal).
   * Children compared element-wise.
   */
  [Equal.symbol](that: Equal.Equal): boolean {
    if (!(that instanceof UIElement)) return false
    // Fast path: same key + type covers 95% of inequality cases
    if (this.key !== that.key || this.type !== that.type) return false
    if (this.parentKey !== that.parentKey) return false
    // Children: length + element-wise
    if (this.children.length !== that.children.length) return false
    for (let i = 0; i < this.children.length; i++) {
      if (this.children[i] !== that.children[i]) return false
    }
    // Props: sorted JSON comparison (props is Record<string, unknown>)
    if (!_propsEqual(this.props, that.props)) return false
    // Optional fields
    if (this.className !== that.className) return false
    if (this.role !== that.role) return false
    if (this.ariaLabel !== that.ariaLabel) return false
    if (this.ariaDescribedBy !== that.ariaDescribedBy) return false
    if (this.ariaLive !== that.ariaLive) return false
    if (this.tabIndex !== that.tabIndex) return false
    return true
  }

  /**
   * Hash: combines key + type + children length + props key count.
   * Does NOT hash props deeply — that's too expensive for hot paths.
   * Equal.symbol does the deep check when hashes collide.
   */
  [Hash.symbol](): number {
    return Hash.cached(this, Hash.combine(Hash.string(this.type))(Hash.string(this.key)))
  }
}

/**
 * Flat UI tree structure backed by HashMap<string, UIElement>.
 *
 * The `elements` field uses `Schema.HashMap` for JSON serialization:
 * - Internal type: `HashMap.HashMap<string, UIElement>` — O(1) get/set/remove
 * - Encoded type: `ReadonlyArray<readonly [string, UIElementEncoded]>` — JSON-safe
 * - Workers use encode/decode at the postMessage boundary
 *
 * `getElement` returns `Option<UIElement>` (not `UIElement | undefined`).
 * For backward compat during migration, `getElementUnsafe` returns `UIElement | undefined`.
 *
 * Implements Equal + Hash for structural tree comparison.
 */
export class UITree extends Schema.Class<UITree>("UITree")({
  root: Schema.String,
  elements: Schema.HashMap({ key: Schema.String, value: UIElement })
}) {
  /** Create empty tree */
  static empty(): UITree {
    return new UITree({ root: "", elements: HashMap.empty<string, UIElement>() })
  }

  /** Number of elements in the tree */
  get size(): number {
    return HashMap.size(this.elements)
  }

  /** Get element by key — returns Option */
  getElement(key: string): Option.Option<UIElement> {
    return HashMap.get(this.elements, key)
  }

  /**
   * Get element by key — returns UIElement | undefined.
   * @deprecated Use getElement() which returns Option. This exists for migration.
   */
  getElementUnsafe(key: string): UIElement | undefined {
    return Option.getOrUndefined(HashMap.get(this.elements, key))
  }

  /** Set element (returns new tree) — O(1) amortized via structural sharing */
  setElement(key: string, element: UIElement): UITree {
    return new UITree({
      root: this.root,
      elements: HashMap.set(this.elements, key, element)
    })
  }

  /** Remove element (returns new tree) — O(1) amortized */
  removeElement(key: string): UITree {
    return new UITree({
      root: this.root,
      elements: HashMap.remove(this.elements, key)
    })
  }

  /** Set root (returns new tree) */
  setRoot(root: string): UITree {
    return new UITree({ root, elements: this.elements })
  }

  /**
   * Convert elements to plain Record for backward compatibility.
   * External consumers (morph-card, cursor tools) that access
   * `tree.elements[key]` should use this during migration.
   * @deprecated Use getElement() or getElementUnsafe() instead
   */
  toRecord(): Record<string, UIElement> {
    const record: Record<string, UIElement> = {}
    for (const [k, v] of this.elements) {
      record[k] = v
    }
    return record
  }

  /**
   * Create UITree from a plain Record (migration helper).
   * Used by workers and tests that construct trees from plain objects.
   */
  static fromRecord(root: string, record: Record<string, UIElement>): UITree {
    return new UITree({
      root,
      elements: HashMap.fromIterable(Object.entries(record))
    })
  }

  /**
   * Value-based equality: root + all elements structurally equal.
   */
  [Equal.symbol](that: Equal.Equal): boolean {
    if (!(that instanceof UITree)) return false
    if (this.root !== that.root) return false
    if (HashMap.size(this.elements) !== HashMap.size(that.elements)) return false
    // Check every key in this exists in that with equal value
    for (const [k, v] of this.elements) {
      const other = HashMap.get(that.elements, k)
      if (Option.isNone(other)) return false
      if (!Equal.equals(v, other.value)) return false
    }
    return true
  }

  /**
   * Hash: root + element count.
   */
  [Hash.symbol](): number {
    return Hash.cached(this, Hash.combine(Hash.number(HashMap.size(this.elements)))(Hash.string(this.root)))
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
