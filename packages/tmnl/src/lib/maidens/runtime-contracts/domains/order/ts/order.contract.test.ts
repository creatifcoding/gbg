import { describe, expect, it } from 'vitest';

import {
  decodeOrderSync,
  decodeTransitionEventSync,
  isLegalTransition,
  toMermaid,
} from './order.contract';

describe('OrderSchema (Effect Schema)', () => {
  it('accepts a valid order payload', () => {
    const decoded = decodeOrderSync({
      order_id: 'ORD-001',
      customer: 'Alice',
      items: [{ sku: 'SKU-1', qty: 2 }],
      total: 149.5,
      cancelled_reason: null,
      shipped_at: null,
      delivered_at: null,
    });

    expect(decoded.order_id).toBe('ORD-001');
    expect(decoded.cancelled_reason).toBeNull();
  });

  it('rejects an invalid order payload', () => {
    expect(() =>
      decodeOrderSync({
        order_id: 'ORD-002',
        customer: 'Bob',
        items: [],
        total: '19.99',
        cancelled_reason: null,
        shipped_at: null,
        delivered_at: null,
      })
    ).toThrow();
  });
});

describe('TransitionEventSchema + FSM map', () => {
  it('accepts a valid transition event payload', () => {
    const decoded = decodeTransitionEventSync({
      order_id: 'ORD-001',
      from: 'pending',
      to: 'confirmed',
      at: '2026-02-22T06:00:00Z',
      reason: null,
    });

    expect(decoded.from).toBe('pending');
    expect(decoded.to).toBe('confirmed');
  });

  it('rejects illegal adjacency even if payload is shape-valid', () => {
    const event = decodeTransitionEventSync({
      order_id: 'ORD-001',
      from: 'pending',
      to: 'delivered',
      at: '2026-02-22T06:00:00Z',
    });

    expect(isLegalTransition(event.from, event.to)).toBe(false);
  });

  it('emits Mermaid state graph', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('pending --> confirmed');
    expect(mermaid).toContain('shipped --> delivered');
  });
});
