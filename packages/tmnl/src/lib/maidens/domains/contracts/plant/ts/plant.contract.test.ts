import { describe, expect, it } from 'vitest';

import {
  PlantSchema,
  PlantTransitionEventSchema,
  decodePlantSync,
  decodePlantTransitionEventSync,
  isLegalTransition,
  makePlant,
  makePlantId,
  makePlantTransitionEvent,
  toMermaid,
} from './plant.contract';

describe('plant.contract', () => {
  it('builds plant ids using canonical PLT-{slug} format', () => {
    const id = makePlantId('Chicago Assembly');
    expect(id).toBe('PLT-chicago-assembly');
  });

  it('decodes canonical plant payload', () => {
    const decoded = decodePlantSync({
      plant_id: makePlantId('chicago-assembly'),
      name: 'Chicago Assembly Plant',
      status: 'commissioning',
      timezone: 'America/Chicago',
      site_code: 'CHI-01',
      description: null,
      location: null,
      metadata: {},
      hierarchy_path: '/ENT-acme/SIT-chicago/AREA-body/PLT-chicago-assembly',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-chicago',
      area_id: 'AREA-body',
      created_at: '2026-02-24T00:00:00Z',
      updated_at: null,
    });

    expect(decoded.status).toBe('commissioning');
    expect(decoded.plant_id).toBe('PLT-chicago-assembly');
  });

  it('constructs plant payloads through helper factory', () => {
    const plant = makePlant({
      slug: 'munich-packaging',
      name: 'Munich Packaging',
      status: 'operational',
      timezone: 'Europe/Berlin',
      hierarchy_path: '/ENT-acme/SIT-munich/AREA-packaging/PLT-munich-packaging',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-munich',
      area_id: 'AREA-packaging',
      created_at: '2026-02-24T00:01:00Z',
      metadata: { erp_code: 'MUC-17' },
      location: { building: 'A', floor: '2' },
    });

    expect(plant.plant_id).toBe('PLT-munich-packaging');
    expect(plant.status).toBe('operational');
    expect(plant.metadata.erp_code).toBe('MUC-17');
  });

  it('constructs transition events through helper factory', () => {
    const event = makePlantTransitionEvent({
      slug: 'munich-packaging',
      from: 'commissioning',
      to: 'operational',
      at: '2026-02-24T00:03:00Z',
      initiated_by: 'operator-8',
    });

    const decoded = decodePlantTransitionEventSync(event);
    expect(decoded.to).toBe('operational');
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('commissioning', 'operational')).toBe(true);
    expect(isLegalTransition('operational', 'scheduled_shutdown')).toBe(true);
    expect(isLegalTransition('scheduled_shutdown', 'decommissioned')).toBe(true);
    expect(isLegalTransition('commissioning', 'decommissioned')).toBe(false);
    expect(isLegalTransition('decommissioned', 'operational')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('commissioning --> operational');
    expect(mermaid).toContain('maintenance_shutdown --> decommissioned');
  });

  it('schema exports are defined', () => {
    expect(PlantSchema).toBeDefined();
    expect(PlantTransitionEventSchema).toBeDefined();
  });
});
