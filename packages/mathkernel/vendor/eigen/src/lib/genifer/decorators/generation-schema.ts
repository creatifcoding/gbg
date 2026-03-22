/**
 * Generation Schema — what the LLM actually outputs.
 *
 * Three tiers:
 *   Tier 1: ComponentRef — "use FlightSearchBar with these props"
 *   Tier 2: BehaviorBlock — inline state/actions/events/bindings in JSON DSL
 *   Tier 3: CodeBlock — sandboxed Effect program (escalation from Tier 2)
 *
 * The LLM outputs UITree nodes that may contain any of these.
 * The interpreter reads them and creates the same atom-backed structures
 * that the decorator bootstrap produces.
 *
 * @module genifer/decorators/generation-schema
 */

import { Schema } from 'effect'

// =============================================================================
// TIER 1: Component References
// =============================================================================

/**
 * Reference a human-authored @component by name.
 * Runtime looks up the component registry, hydrates the associated
 * @actionGroup (if any), and renders via @renders method.
 *
 * LLM output:
 * ```json
 * { "_tag": "FlightSearchBar", "ref": { "component": "FlightSearchBar", "props": { "placeholder": "Search..." } } }
 * ```
 */
export class ComponentRef extends Schema.TaggedClass<ComponentRef>()('ComponentRef', {
  /** Name matching @component registration */
  component: Schema.String,
  /** Props to pass (validated against Schema.Class fields) */
  props: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  /** If the component has an @actionGroup, override the group name */
  actionGroup: Schema.optional(Schema.String),
  /** Template mode: clone the component's behavior with different state defaults */
  templateOverrides: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

// =============================================================================
// TIER 2: JSON Behavior DSL
// =============================================================================

// --- Action Types (catalog of what actions can do) ---

/**
 * setState: Write values directly to atoms.
 * ```json
 * { "type": "setState", "values": { "query": "", "results": [] } }
 * ```
 */
export class SetStateAction extends Schema.TaggedClass<SetStateAction>()('setState', {
  /** Map of field → value to write to atoms */
  values: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
}) {}

/**
 * callRpc: Invoke a registered RPC (from @rpc decorator or DynamicRpcService).
 * ```json
 * { "type": "callRpc", "rpc": "opensky/SearchFlights", "payload": { "query": "{{@state:query}}" } }
 * ```
 */
export class CallRpcAction extends Schema.TaggedClass<CallRpcAction>()('callRpc', {
  /** RPC tag to invoke */
  rpc: Schema.String,
  /** Payload — may contain sigils like {{@state:field}} for interpolation */
  payload: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  /** Where to store the result */
  resultField: Schema.optional(Schema.String),
  /** Where to store errors */
  errorField: Schema.optional(Schema.String),
  /** Loading state field to toggle */
  loadingField: Schema.optional(Schema.String),
}) {}

/**
 * emitEvent: Fire an event on the bus.
 * ```json
 * { "type": "emitEvent", "event": "FlightSearched", "payload": { "query": "{{@state:query}}" } }
 * ```
 */
export class EmitEventAction extends Schema.TaggedClass<EmitEventAction>()('emitEvent', {
  event: Schema.String,
  payload: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/**
 * navigate: Route navigation.
 * ```json
 * { "type": "navigate", "to": "/flights/{{@state:selectedId}}" }
 * ```
 */
export class NavigateAction extends Schema.TaggedClass<NavigateAction>()('navigate', {
  to: Schema.String,
  params: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
}) {}

/**
 * sequence: Execute multiple actions in order.
 * Uses Schema.Unknown for recursive children — validated structurally by the interpreter.
 *
 * ```json
 * { "_tag": "sequence", "actions": [
 *   { "_tag": "setState", "values": { "loading": true } },
 *   { "_tag": "callRpc", "rpc": "opensky/SearchFlights", "resultField": "results" },
 *   { "_tag": "setState", "values": { "loading": false } }
 * ]}
 * ```
 */
export class SequenceAction extends Schema.TaggedClass<SequenceAction>()('sequence', {
  /** Array of ActionDef objects — recursive, validated at interpretation time */
  actions: Schema.Array(Schema.Unknown),
}) {}

/**
 * conditional: Branch on state.
 * ```json
 * { "_tag": "conditional", "field": "query", "op": "notEmpty",
 *   "then": { "_tag": "callRpc", "rpc": "search" },
 *   "else": { "_tag": "setState", "values": { "error": "Enter a query" } }
 * }
 * ```
 */
export class ConditionalAction extends Schema.TaggedClass<ConditionalAction>()('conditional', {
  field: Schema.String,
  op: Schema.Literal('eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'empty', 'notEmpty', 'contains', 'matches'),
  value: Schema.optional(Schema.Unknown),
  /** Then branch — ActionDef, validated by interpreter */
  then: Schema.Unknown,
  /** Else branch — optional ActionDef */
  else: Schema.optional(Schema.Unknown),
}) {}

/**
 * Union of all leaf action types. Recursive types (sequence, conditional)
 * hold their children as Schema.Unknown — the interpreter walks and validates.
 *
 * This avoids TypeScript circular reference limitations while keeping
 * the Schema.TaggedClass pattern for all action types.
 */
export const ActionDef = Schema.Union(
  SetStateAction,
  CallRpcAction,
  EmitEventAction,
  NavigateAction,
  SequenceAction,
  ConditionalAction,
)
export type ActionDef = typeof ActionDef.Type

// --- State Definition ---

/**
 * Declares an atom with a name, initial value, and optional schema for validation.
 */
export class StateDef extends Schema.Class<StateDef>('StateDef')({
  /** Field name → becomes an atom */
  field: Schema.String,
  /** Initial value */
  initial: Schema.Unknown,
  /** Optional: schema tag for validation (e.g., "String", "Number", "Array<Flight>") */
  schemaHint: Schema.optional(Schema.String),
}) {}

// --- Event Subscription ---

export class EventSubscription extends Schema.Class<EventSubscription>('EventSubscription')({
  /** Event tag to listen for */
  event: Schema.String,
  /** Action to execute when event fires */
  action: ActionDef,
}) {}

// --- Binding Definition ---

/**
 * Binding types for connecting UI elements to state:
 *
 * Sigils in props:
 *   "@state:query"          → reads atom value
 *   "bind:value"            → two-way binding (read + onChange writes back)
 *   "{{@state:query}}"      → string interpolation
 *   "@action:search"        → onClick dispatches action
 *   "@action:setQuery"      → onChange dispatches with event.target.value
 */
export class BindingDef extends Schema.Class<BindingDef>('BindingDef')({
  /** The prop name on the UI element (e.g., "value", "onChange", "disabled") */
  prop: Schema.String,
  /** Binding expression — one of the sigil patterns */
  expression: Schema.String,
}) {}

// --- The Full Behavior Block ---

/**
 * A BehaviorBlock is embedded in a UITree node to give it dynamic behavior.
 *
 * LLM output example:
 * ```json
 * {
 *   "_tag": "container",
 *   "behavior": {
 *     "name": "flight-search",
 *     "state": [
 *       { "field": "query", "initial": "" },
 *       { "field": "results", "initial": [] },
 *       { "field": "loading", "initial": false },
 *       { "field": "error", "initial": null }
 *     ],
 *     "actions": {
 *       "search": {
 *         "_tag": "sequence",
 *         "actions": [
 *           { "_tag": "setState", "values": { "loading": true, "error": null } },
 *           { "_tag": "callRpc", "rpc": "opensky/SearchFlights",
 *             "payload": { "query": "{{@state:query}}" },
 *             "resultField": "results", "loadingField": "loading", "errorField": "error" }
 *         ]
 *       },
 *       "clear": { "_tag": "setState", "values": { "query": "", "results": [], "error": null } },
 *       "setQuery": { "_tag": "setState", "values": { "query": "{{$payload}}" } }
 *     },
 *     "subscriptions": [
 *       { "event": "FlightSearched", "action": { "_tag": "setState", "values": { "lastSearch": "{{$event}}" } } }
 *     ]
 *   },
 *   "children": [...]
 * }
 * ```
 */
export class BehaviorBlock extends Schema.Class<BehaviorBlock>('BehaviorBlock')({
  /** Unique name for this behavior group — becomes the ActionGroup name */
  name: Schema.String,
  /** State field definitions — each becomes a Writable atom */
  state: Schema.Array(StateDef),
  /** Named actions — each is an ActionDef tree */
  actions: Schema.Record({ key: Schema.String, value: ActionDef }),
  /** Event subscriptions — react to bus events */
  subscriptions: Schema.optionalWith(Schema.Array(EventSubscription), { default: () => [] }),
  /** Events this behavior emits (for documentation/type checking) */
  emits: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** RPCs this behavior depends on */
  requires: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {}

// =============================================================================
// TIER 3: Code Block (escalation)
// =============================================================================

/**
 * A CodeBlock is an Effect program the LLM writes when the JSON DSL can't express
 * what it needs. Sandboxed execution with service access.
 *
 * ```json
 * {
 *   "code": "Effect.gen(function*() {\n  const http = yield* HttpClient;\n  ...\n})",
 *   "expose": { "asAction": "customSearch", "asAtom": "enrichedResults" }
 * }
 * ```
 */
export class CodeBlock extends Schema.TaggedClass<CodeBlock>()('CodeBlock', {
  /** The Effect program source — sandboxed execution */
  code: Schema.String,
  /** Language hint (always TypeScript/Effect for now) */
  language: Schema.optionalWith(Schema.Literal('effect-ts', 'typescript'), { default: () => 'effect-ts' as const }),
  /** What to expose from the code execution */
  expose: Schema.optional(Schema.Struct({
    /** Register result as an action on the parent behavior group */
    asAction: Schema.optional(Schema.String),
    /** Register result as a readable atom */
    asAtom: Schema.optional(Schema.String),
    /** Register as a dynamic RPC */
    asRpc: Schema.optional(Schema.String),
    /** Register as a dynamic event */
    asEvent: Schema.optional(Schema.String),
    /** Register as a tool */
    asTool: Schema.optional(Schema.String),
  })),
}) {}

// =============================================================================
// COMPOSITE: What a UITree node looks like with behavior
// =============================================================================

/**
 * Extended UIElement props that the LLM can set to wire behavior.
 *
 * These are resolved by the interpreter before rendering:
 *   - `ref` → Tier 1 component reference
 *   - `behavior` → Tier 2 JSON behavior block
 *   - `codeBlocks` → Tier 3 code escalation
 *   - `bindings` → Sigil-based prop bindings
 */
export class BehaviorProps extends Schema.Class<BehaviorProps>('BehaviorProps')({
  /** Tier 1: Reference a registered component */
  ref: Schema.optional(ComponentRef),
  /** Tier 2: Inline behavior block (state + actions + events) */
  behavior: Schema.optional(BehaviorBlock),
  /** Tier 3: Code blocks for advanced logic */
  codeBlocks: Schema.optionalWith(Schema.Array(CodeBlock), { default: () => [] }),
  /** Prop bindings using sigil expressions */
  bindings: Schema.optionalWith(Schema.Array(BindingDef), { default: () => [] }),
}) {}

// =============================================================================
// PROMPT FRAGMENT — teaches the LLM the DSL
// =============================================================================

/**
 * System prompt fragment that teaches the LLM how to generate behavior.
 * Injected by the PromptCompiler when behavior generation is enabled.
 */
export const BEHAVIOR_DSL_PROMPT = `
## Behavior Generation

You can make UI interactive using three tiers:

### Tier 1: Component References
Use a pre-built component by name:
\`\`\`json
{ "_tag": "FlightSearchBar", "ref": { "component": "FlightSearchBar", "props": { "placeholder": "Search..." } } }
\`\`\`

### Tier 2: Behavior Blocks
Add state + actions + events inline:
\`\`\`json
{
  "_tag": "container",
  "behavior": {
    "name": "my-search",
    "state": [
      { "field": "query", "initial": "" },
      { "field": "results", "initial": [] },
      { "field": "loading", "initial": false }
    ],
    "actions": {
      "search": {
        "_tag": "sequence",
        "actions": [
          { "_tag": "setState", "values": { "loading": true } },
          { "_tag": "callRpc", "rpc": "opensky/SearchFlights",
            "payload": { "query": "{{@state:query}}" },
            "resultField": "results", "loadingField": "loading" }
        ]
      },
      "clear": { "_tag": "setState", "values": { "query": "", "results": [] } }
    }
  },
  "children": [
    { "_tag": "input", "props": { "value": "@state:query", "onChange": "@action:setQuery", "placeholder": "Search..." } },
    { "_tag": "button", "props": { "onClick": "@action:search", "disabled": "@state:loading" }, "children": [{ "_tag": "text", "value": "Search" }] }
  ]
}
\`\`\`

### Sigil Bindings
- \`@state:fieldName\` — reads atom value as prop
- \`@action:actionName\` — dispatches action on event (onClick, onChange, etc.)
- \`bind:fieldName\` — two-way binding (reads + writes on change)
- \`{{@state:fieldName}}\` — string interpolation inside text values
- \`{{$payload}}\` — the event payload (in action definitions)
- \`{{$event}}\` — the full event object (in subscription actions)

### Action Types
- \`setState\` — \`{ "_tag": "setState", "values": { "field": "value" } }\`
- \`callRpc\` — \`{ "_tag": "callRpc", "rpc": "tag", "payload": {...}, "resultField": "f", "loadingField": "f" }\`
- \`emitEvent\` — \`{ "_tag": "emitEvent", "event": "tag", "payload": {...} }\`
- \`navigate\` — \`{ "_tag": "navigate", "to": "/path" }\`
- \`sequence\` — \`{ "_tag": "sequence", "actions": [...] }\` (run in order)
- \`conditional\` — \`{ "_tag": "conditional", "field": "f", "op": "notEmpty", "then": {...}, "else": {...} }\`

### Tier 3: Code Blocks (escalation)
When the DSL can't express what you need, write Effect programs:
\`\`\`json
{
  "codeBlocks": [{
    "_tag": "CodeBlock",
    "code": "Effect.gen(function*() { const http = yield* HttpClient; ... })",
    "expose": { "asAction": "customSearch" }
  }]
}
\`\`\`
` as const
