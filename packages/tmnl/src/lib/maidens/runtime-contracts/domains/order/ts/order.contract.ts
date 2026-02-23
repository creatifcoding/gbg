import { Schema } from 'effect';

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
  order_id: Schema.String,
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
  order_id: Schema.String,
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
  transitions[from].includes(to);

/**
 * Typed transition graph exporter.
 */
export const toMermaid = (
  graph: Readonly<Record<OrderState, readonly OrderState[]>> = transitions
): string => {
  const lines: string[] = ['stateDiagram-v2'];

  for (const from of orderStates) {
    const outs = graph[from];
    if (outs.length === 0) {
      lines.push(`  state ${from}`);
      continue;
    }

    for (const to of outs) {
      lines.push(`  ${from} --> ${to}`);
    }
  }

  return `${lines.join('\n')}\n`;
};

export const decodeOrderSync = Schema.decodeUnknownSync(OrderSchema);
export const decodeTransitionEventSync =
  Schema.decodeUnknownSync(TransitionEventSchema);
