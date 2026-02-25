import { describe, expect, it } from 'vitest';

import {
  decodeOrderAgentStateSync,
  decodeOrderSync,
  decodeTransitionEventSync,
  isLegalTransition,
  makeOrder,
  makeOrderId,
  makeTransitionEvent,
  toMermaid,
} from './order.contract';

describe('OrderSchema (Effect Schema)', () => {
  it('accepts a valid order payload', () => {
    const order = makeOrder({
      slug: 'ORD',
      uuid: '550e8400-e29b-41d4-a716-446655440001',
      customer: 'Alice',
      items: [{ sku: 'SKU-1', qty: 2 }],
      total: 149.5,
    });

    const decoded = decodeOrderSync(order);

    expect(decoded.order_id).toBe('ORD-550e8400-e29b-41d4-a716-446655440001');
    expect(decoded.cancelled_reason).toBeNull();
  });

  it('rejects an invalid order payload', () => {
    expect(() =>
      decodeOrderSync({
        order_id: makeOrderId('ORD', '550e8400-e29b-41d4-a716-446655440002'),
        customer: 'Bob',
        items: [],
        total: '19.99',
        cancelled_reason: null,
        shipped_at: null,
        delivered_at: null,
      })
    ).toThrow();
  });

  it('accepts valid Jido agent-state payload shape with model runtime fields', () => {
    const decoded = decodeOrderAgentStateSync({
      ...makeOrder({
        slug: 'ORD-AGENT',
        uuid: '550e8400-e29b-41d4-a716-446655440003',
        customer: 'Agent Alice',
        items: [{ sku: 'SKU-X', qty: 1 }],
        total: 10,
      }),
      model_request_id: 'req-agent-003',
      model_name: 'noop-model',
      model_prompt: 'classify order risk',
      model_options: { temperature: 0.1 },
      model_status: 'pending',
      model_result: null,
      model_error: null,
    });

    expect(decoded.order_id).toBe('ORD-AGENT-550e8400-e29b-41d4-a716-446655440003');
    expect(decoded.model_status).toBe('pending');
  });

  it('rejects invalid model_status in agent-state payload', () => {
    expect(() =>
      decodeOrderAgentStateSync({
        ...makeOrder({
          slug: 'ORD-AGENT',
          uuid: '550e8400-e29b-41d4-a716-446655440099',
          customer: 'Agent Bad',
          items: [{ sku: 'SKU-BAD', qty: 1 }],
          total: 2,
        }),
        model_request_id: null,
        model_name: null,
        model_prompt: null,
        model_options: {},
        model_status: 'stalled',
        model_result: null,
        model_error: null,
      })
    ).toThrow();
  });
});

describe('TransitionEventSchema + FSM map', () => {
  it('accepts a valid transition event payload', () => {
    const decoded = decodeTransitionEventSync(
      makeTransitionEvent({
        slug: 'ORD',
        uuid: '550e8400-e29b-41d4-a716-446655440010',
        from: 'pending',
        to: 'confirmed',
        at: '2026-02-22T06:00:00Z',
        reason: null,
      })
    );

    expect(decoded.from).toBe('pending');
    expect(decoded.to).toBe('confirmed');
  });

  it('rejects illegal adjacency even if payload is shape-valid', () => {
    const event = decodeTransitionEventSync(
      makeTransitionEvent({
        slug: 'ORD',
        uuid: '550e8400-e29b-41d4-a716-446655440011',
        from: 'pending',
        to: 'delivered',
        at: '2026-02-22T06:00:00Z',
      })
    );

    expect(isLegalTransition(event.from, event.to)).toBe(false);
  });

  it('emits Mermaid state graph', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('pending --> confirmed');
    expect(mermaid).toContain('shipped --> delivered');
  });
});
