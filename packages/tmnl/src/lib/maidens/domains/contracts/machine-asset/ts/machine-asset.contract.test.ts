import { describe, expect, it } from 'vitest';

import {
  MachineAssetSchema,
  MachineAssetTransitionEventSchema,
  decodeMachineAssetSync,
  decodeMachineAssetTransitionEventSync,
  isLegalTransition,
  makeMachineAsset,
  makeMachineAssetId,
  makeMachineAssetTransitionEvent,
  toMermaid,
} from './machine-asset.contract';

describe('machine-asset.contract', () => {
  it('builds machine ids using canonical MCH-{slug} format', () => {
    const id = makeMachineAssetId('CNC Lathe 001');
    expect(id).toBe('MCH-cnc-lathe-001');
  });

  it('decodes canonical machine payload', () => {
    const decoded = decodeMachineAssetSync({
      machine_id: makeMachineAssetId('cnc-lathe-001'),
      name: 'CNC Lathe 001',
      status: 'operational',
      description: null,
      location: null,
      metadata: {},
      created_at: '2026-02-24T00:00:00Z',
      updated_at: null,
      hierarchy_path: '/ENT-acme/SIT-chicago/PLT-main/LIN-01/MCH-cnc-lathe-001',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-chicago',
      plant_id: 'PLT-main',
      line_id: 'LIN-01',
      work_cell_id: 'WCL-01',
      machine_type: 'CNC Lathe',
      manufacturer: 'Haas',
      model_number: 'ST-10',
      serial_number: 'HZ-2026-0001',
      installation_date: '2026-01-01T00:00:00Z',
      last_maintenance_date: null,
      next_maintenance_date: '2026-03-01T00:00:00Z',
    });

    expect(decoded.status).toBe('operational');
    expect(decoded.machine_id).toBe('MCH-cnc-lathe-001');
  });

  it('constructs machine payloads through helper factory', () => {
    const machine = makeMachineAsset({
      slug: 'press-007',
      name: 'Hydraulic Press 007',
      status: 'scheduled_maintenance',
      hierarchy_path: '/ENT-acme/SIT-detroit/PLT-body/LIN-09/MCH-press-007',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-detroit',
      plant_id: 'PLT-body',
      line_id: 'LIN-09',
      machine_type: 'Hydraulic Press',
      manufacturer: 'Komatsu',
      created_at: '2026-02-24T00:02:00Z',
      next_maintenance_date: '2026-03-15T12:00:00Z',
      metadata: { cell: 'B-12' },
    });

    expect(machine.machine_id).toBe('MCH-press-007');
    expect(machine.status).toBe('scheduled_maintenance');
    expect(machine.metadata.cell).toBe('B-12');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeMachineAssetTransitionEvent({
      slug: 'press-007',
      from: 'scheduled_maintenance',
      to: 'operational',
      at: '2026-02-24T00:03:00Z',
      initiated_by: 'operator-9',
    });

    const decoded = decodeMachineAssetTransitionEventSync(event);
    expect(decoded.to).toBe('operational');
  });

  it('enforces legal transitions from canonical machine graph', () => {
    expect(isLegalTransition('commissioned', 'operational')).toBe(true);
    expect(isLegalTransition('faulted', 'scheduled_maintenance')).toBe(true);
    expect(isLegalTransition('scheduled_maintenance', 'decommissioned')).toBe(true);
    expect(isLegalTransition('operational', 'decommissioned')).toBe(false);
    expect(isLegalTransition('decommissioned', 'operational')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('commissioned --> operational');
    expect(mermaid).toContain('retired --> decommissioned');
  });

  it('schema exports are defined', () => {
    expect(MachineAssetSchema).toBeDefined();
    expect(MachineAssetTransitionEventSchema).toBeDefined();
  });
});
