import { describe, expect, it } from 'vitest';

import {
  EquipmentStateSchema,
  EquipmentStateTransitionEventSchema,
  decodeEquipmentStateSync,
  decodeEquipmentStateTransitionEventSync,
  getValidReasonsForState,
  isLegalTransition,
  makeEquipmentState,
  makeEquipmentStateId,
  makeEquipmentStateTransitionEvent,
  toMermaid,
} from './equipment-state.contract';

describe('equipment-state.contract', () => {
  it('builds equipment state ids using slug+uuid pattern', () => {
    const id = makeEquipmentStateId(
      'EST cnc lathe 001',
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(id).toBe('EST-CNC-LATHE-001-550e8400-e29b-41d4-a716-446655440000');
  });

  it('decodes canonical equipment state payload', () => {
    const decoded = decodeEquipmentStateSync({
      equipment_state_id: makeEquipmentStateId(
        'EST-001',
        '550e8400-e29b-41d4-a716-446655440000'
      ),
      machine_id: 'MCH-001',
      state: 'running',
      reason: 'production',
      started_at: '2026-02-24T00:00:00Z',
      ended_at: null,
      operator_id: 'operator-1',
      notes: null,
      metadata: {},
    });

    expect(decoded.state).toBe('running');
  });

  it('constructs equipment state payloads through helper factory', () => {
    const equipmentState = makeEquipmentState({
      slug: 'EST-CNC-001',
      machine_id: 'MCH-002',
      state: 'setup',
      reason: 'changeover',
      started_at: '2026-02-24T00:01:00Z',
      operator_id: 'operator-7',
      uuid: '123e4567-e89b-42d3-a456-426614174000',
    });

    expect(equipmentState.equipment_state_id).toContain('EST-CNC-001-');
    expect(equipmentState.reason).toBe('changeover');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeEquipmentStateTransitionEvent({
      slug: 'EST-CNC-002',
      machine_id: 'MCH-002',
      from: 'setup',
      to: 'running',
      at: '2026-02-24T00:03:00Z',
      reason: 'production',
      operator_id: 'operator-8',
      uuid: '123e4567-e89b-42d3-a456-426614174001',
    });

    const decoded = decodeEquipmentStateTransitionEventSync(event);
    expect(decoded.to).toBe('running');
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('running', 'idle')).toBe(true);
    expect(isLegalTransition('blocked', 'setup')).toBe(true);
    expect(isLegalTransition('running', 'running')).toBe(false);
    expect(isLegalTransition('planned_downtime', 'blocked')).toBe(false);
  });

  it('exports reason sets aligned with state semantics', () => {
    expect(getValidReasonsForState('running')).toContain('production');
    expect(getValidReasonsForState('blocked')).toContain('starved');
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('running --> idle');
    expect(mermaid).toContain('blocked --> running');
  });

  it('schema exports are defined', () => {
    expect(EquipmentStateSchema).toBeDefined();
    expect(EquipmentStateTransitionEventSchema).toBeDefined();
  });
});
