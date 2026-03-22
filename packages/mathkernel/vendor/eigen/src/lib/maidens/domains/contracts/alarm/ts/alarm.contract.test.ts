import { describe, expect, it } from 'vitest';
import {
  AlarmSchema,
  AlarmTransitionEventSchema,
  decodeAlarmSync,
  decodeAlarmTransitionEventSync,
  isLegalTransition,
  makeAlarm,
  makeAlarmId,
  makeAlarmTransitionEvent,
} from './alarm.contract';

describe('alarm.contract', () => {
  it('builds alarm ids using slug+uuid pattern', () => {
    const id = makeAlarmId('ALM high temp', '550e8400-e29b-41d4-a716-446655440000');
    expect(id).toBe('ALM-HIGH-TEMP-550e8400-e29b-41d4-a716-446655440000');
  });

  it('decodes canonical alarm payload', () => {
    const decoded = decodeAlarmSync({
      alarm_id: makeAlarmId('ALM-001', '550e8400-e29b-41d4-a716-446655440000'),
      device_id: 'TMP-001',
      asset_id: 'ASSET-1',
      severity: 'critical',
      state: 'unacknowledged',
      message: 'Over temperature',
      triggered_at: '2026-02-24T00:00:00Z',
      acknowledged_at: null,
      acknowledged_by: null,
      cleared_at: null,
      shelved_until: null,
      suppression_reason: null,
    });

    expect(decoded.state).toBe('unacknowledged');
  });

  it('constructs alarms through helper factory', () => {
    const alarm = makeAlarm({
      slug: 'ALM-HI-TEMP-1',
      device_id: 'TMP-02',
      severity: 'warning',
      state: 'acknowledged',
      triggered_at: '2026-02-24T00:01:00Z',
      acknowledged_at: '2026-02-24T00:02:00Z',
      acknowledged_by: 'operator-7',
      uuid: '123e4567-e89b-42d3-a456-426614174000',
    });

    expect(alarm.alarm_id).toContain('ALM-HI-TEMP-1-');
    expect(alarm.acknowledged_by).toBe('operator-7');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeAlarmTransitionEvent({
      slug: 'ALM-HI-TEMP-2',
      from: 'unacknowledged',
      to: 'acknowledged',
      at: '2026-02-24T00:03:00Z',
      by: 'operator-8',
      uuid: '123e4567-e89b-42d3-a456-426614174001',
    });

    const decoded = decodeAlarmTransitionEventSync(event);
    expect(decoded.to).toBe('acknowledged');
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('unacknowledged', 'acknowledged')).toBe(true);
    expect(isLegalTransition('acknowledged', 'cleared')).toBe(true);
    expect(isLegalTransition('unacknowledged', 'cleared')).toBe(false);
    expect(isLegalTransition('out_of_service', 'suppressed')).toBe(false);
  });

  it('schema exports are defined', () => {
    expect(AlarmSchema).toBeDefined();
    expect(AlarmTransitionEventSchema).toBeDefined();
  });
});
