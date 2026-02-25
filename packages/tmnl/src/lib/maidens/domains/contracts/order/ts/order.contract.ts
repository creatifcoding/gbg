import { Schema } from 'effect';
import {
  isLegalTransition as isLegalTransitionFor,
  toMermaid as toMermaidFor,
} from '../../../../core/contracts/fsm';

/**
 * Effect Schema feature:
 * - Canonical domain contract in TypeScript.
 * - Provides static types + runtime decode/validation in TS.
 */
export const OrderStateSchema = Schema.Literal(
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled'
).annotations({
  identifier: 'OrderState',
  title: 'Order State',
  description: 'Allowed finite states for an order lifecycle.',
});

export type OrderState = typeof OrderStateSchema.Type;

export const ORDER_ID_PATTERN =
  /^[A-Z][A-Z0-9_-]*-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const OrderIdSchema = Schema.String.pipe(
  Schema.pattern(ORDER_ID_PATTERN)
).annotations({
  identifier: 'OrderId',
  title: 'Order ID',
  description: 'Slug-prefixed UUID (e.g. ORD-550e8400-e29b-41d4-a716-446655440000).',
});

export type OrderId = typeof OrderIdSchema.Type;

const ItemMapSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'OrderItemMap',
  title: 'Order Item Map',
  description: 'Opaque item payload map (list of maps in OrderSchema.items).',
});

const NullableUnknown = Schema.Union(Schema.Null, Schema.Unknown).annotations({
  title: 'Nullable Unknown',
  description:
    'Represents Elixir nil-or-any contract fields (shipped_at / delivered_at).',
  // JSON Schema contract semantics:
  // Interchange-only representation; validator behavior is owned by Elixir validator libs.
  jsonSchema: {
    anyOf: [{ type: 'null' }, {}],
  },
});

/**
 * Effect Schema feature: canonical Order state contract.
 */
export const OrderSchema = Schema.Struct({
  order_id: OrderIdSchema,
  customer: Schema.String,
  items: Schema.Array(ItemMapSchema),
  total: Schema.Number,
  cancelled_reason: Schema.NullOr(Schema.String),
  shipped_at: NullableUnknown,
  delivered_at: NullableUnknown,
}).annotations({
  identifier: 'Order',
  title: 'Order',
  description:
    'Canonical order state payload defined in Effect Schema and exported as JSON Schema for Elixir runtime validation.',
});

export type Order = typeof OrderSchema.Type;

const ModelOptionsSchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).annotations({
  identifier: 'OrderModelOptions',
  title: 'Order Model Options',
  description: 'Runtime model adapter options map.',
});

const OrderModelStatusSchema = Schema.Literal(
  'idle',
  'pending',
  'completed',
  'failed'
).annotations({
  identifier: 'OrderModelStatus',
  title: 'Order Model Status',
  description: 'Runtime model inference lifecycle status for the order agent.',
});

const NullableModelRuntimeValue = Schema.Union(Schema.Null, Schema.Unknown).annotations({
  title: 'Nullable Model Runtime Value',
  description: 'Model runtime payload fields (result/error) represented as nil-or-any.',
  jsonSchema: {
    anyOf: [{ type: 'null' }, {}],
  },
});

/**
 * Jido agent schema contract (TS canonical):
 * mirrors agent state fields configured in Elixir `use Jido.Agent, schema: [...]`.
 */
export const OrderAgentStateSchema = OrderSchema.pipe(
  Schema.extend(
    Schema.Struct({
      model_request_id: Schema.NullOr(Schema.String),
      model_name: Schema.NullOr(Schema.String),
      model_prompt: Schema.NullOr(Schema.String),
      model_options: ModelOptionsSchema,
      model_status: OrderModelStatusSchema,
      model_result: NullableModelRuntimeValue,
      model_error: NullableModelRuntimeValue,
    })
  )
).annotations({
  identifier: 'OrderAgentState',
  title: 'Order Agent State',
  description:
    'Canonical Jido agent state contract generated from Effect Schema and validated in Elixir before Jido.Agent.validate/2 and cmd/2.',
});

export type OrderAgentState = typeof OrderAgentStateSchema.Type;

const IsoTimestampString = Schema.String.pipe(
  Schema.pattern(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
  )
).annotations({
  title: 'ISO8601 Timestamp',
  description: 'ISO8601 UTC or offset timestamp string.',
  jsonSchema: { format: 'date-time' },
});

/**
 * Effect Schema feature: canonical transition event contract.
 */
export const TransitionEventSchema = Schema.Struct({
  order_id: OrderIdSchema,
  from: OrderStateSchema,
  to: OrderStateSchema,
  at: IsoTimestampString,
  reason: Schema.optional(Schema.NullOr(Schema.String)),
}).annotations({
  identifier: 'OrderTransitionEvent',
  title: 'Order Transition Event',
  description:
    'Lifecycle transition event payload validated in TS and in Elixir via generated JSON Schema artifacts.',
});

export type TransitionEvent = typeof TransitionEventSchema.Type;

/**
 * FSM transition adjacency map.
 *
 * Provenance:
 * - Mirrors Jido FSM strategy transition semantics.
 * - Enforcement is local in our contract layer (TS + Elixir) before Jido cmd/2.
 */
export const transitions = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
} as const satisfies Readonly<Record<OrderState, readonly OrderState[]>>;

export const orderStates: ReadonlyArray<OrderState> = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
];

export const isLegalTransition = (from: OrderState, to: OrderState): boolean =>
  isLegalTransitionFor(transitions, from, to);

/**
 * Typed transition graph exporter.
 */
export const toMermaid = (
  graph: Readonly<Record<OrderState, readonly OrderState[]>> = transitions
): string => toMermaidFor(graph, orderStates);

export interface MakeOrderInput {
  readonly slug: string;
  readonly customer: string;
  readonly items: ReadonlyArray<Record<string, unknown>>;
  readonly total: number;
  readonly cancelled_reason?: string | null;
  readonly shipped_at?: unknown;
  readonly delivered_at?: unknown;
  readonly uuid?: string;
}

export interface MakeTransitionEventInput {
  readonly slug: string;
  readonly from: OrderState;
  readonly to: OrderState;
  readonly at: string;
  readonly reason?: string | null;
  readonly uuid?: string;
}

const normalizeSlug = (slug: string): string =>
  slug
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9_-]/g, '-');

export const makeOrderId = (slug: string, uuid = crypto.randomUUID()): OrderId => {
  const candidate = `${normalizeSlug(slug)}-${uuid.toLowerCase()}`;
  return Schema.decodeUnknownSync(OrderIdSchema)(candidate);
};

export const makeOrder = (input: MakeOrderInput): Order =>
  Schema.decodeUnknownSync(OrderSchema)({
    order_id: makeOrderId(input.slug, input.uuid),
    customer: input.customer,
    items: input.items,
    total: input.total,
    cancelled_reason: input.cancelled_reason ?? null,
    shipped_at: input.shipped_at ?? null,
    delivered_at: input.delivered_at ?? null,
  });

export const makeTransitionEvent = (
  input: MakeTransitionEventInput
): TransitionEvent =>
  Schema.decodeUnknownSync(TransitionEventSchema)({
    order_id: makeOrderId(input.slug, input.uuid),
    from: input.from,
    to: input.to,
    at: input.at,
    reason: input.reason ?? null,
  });

export const decodeOrderSync = Schema.decodeUnknownSync(OrderSchema);
export const decodeOrderAgentStateSync = Schema.decodeUnknownSync(
  OrderAgentStateSchema
);
export const decodeTransitionEventSync =
  Schema.decodeUnknownSync(TransitionEventSchema);
