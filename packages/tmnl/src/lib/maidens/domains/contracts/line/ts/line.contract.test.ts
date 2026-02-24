import { describe, expect, it } from 'vitest';

import {
  LineSchema,
  LineTransitionEventSchema,
  decodeLineSync,
  decodeLineTransitionEventSync,
  isLegalTransition,
  makeLine,
  makeLineId,
  makeLineTransitionEvent,
  toMermaid,
} from './line.contract';

describe('line.contract', () => {
  it('builds line ids using canonical LIN-{slug} format', () => {
    const id = makeLineId('Assembly Line 01');
    expect(id).toBe('LIN-assembly-line-01');
  });

  it('decodes canonical line payload', () => {
    const decoded = decodeLineSync({
      line_id: makeLineId('assembly-01'),
      name: 'Assembly Line 01',
      status: 'running',
      description: 'Primary widget assembly line',
      location: {
        latitude: 41.5,
        longitude: -81.7,
        building: 'A',
        floor: '1',
        zone: 'Z-01',
        address: '100 Factory Way',
        timezone: 'America/Chicago',
      },
      metadata: { owner: 'ops' },
      hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-assembly-01',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-cleveland',
      area_id: null,
      plant_id: 'PLT-main',
      capacity: 500,
      line_type: 'assembly',
      operating_hours_per_day: 16,
      created_at: '2026-02-24T00:00:00Z',
      updated_at: null,
    });

    expect(decoded.status).toBe('running');
    expect(decoded.line_id).toBe('LIN-assembly-01');
    expect(decoded.capacity).toBe(500);
  });

  it('constructs line payloads through helper factory', () => {
    const line = makeLine({
      slug: 'packaging-a',
      name: 'Packaging Line A',
      status: 'idle',
      hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-packaging-a',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-cleveland',
      plant_id: 'PLT-main',
      created_at: '2026-02-24T00:01:00Z',
      metadata: { erp_code: 'LINE-A' },
      line_type: 'packaging',
      operating_hours_per_day: 20,
    });

    expect(line.line_id).toBe('LIN-packaging-a');
    expect(line.status).toBe('idle');
    expect(line.metadata.erp_code).toBe('LINE-A');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeLineTransitionEvent({
      slug: 'packaging-a',
      from: 'idle',
      to: 'running',
      at: '2026-02-24T00:03:00Z',
      initiated_by: 'operator-8',
    });

    const decoded = decodeLineTransitionEventSync(event);
    expect(decoded.to).toBe('running');
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('idle', 'running')).toBe(true);
    expect(isLegalTransition('running', 'blocked')).toBe(true);
    expect(isLegalTransition('maintenance', 'decommissioned')).toBe(true);
    expect(isLegalTransition('running', 'decommissioned')).toBe(false);
    expect(isLegalTransition('decommissioned', 'running')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('idle --> running');
    expect(mermaid).toContain('maintenance --> decommissioned');
  });

  it('schema exports are defined', () => {
    expect(LineSchema).toBeDefined();
    expect(LineTransitionEventSchema).toBeDefined();
  });
});
