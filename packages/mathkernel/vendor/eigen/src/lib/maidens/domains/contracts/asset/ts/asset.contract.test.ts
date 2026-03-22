import { describe, expect, it } from 'vitest';

import {
  AssetCanonicalSourceMap,
  AssetSchema,
  AssetTransitionEventSchema,
  decodeAssetAgentStateSync,
  decodeAssetSync,
  decodeAssetTransitionEventSync,
  isLegalTransition,
  makeAsset,
  makeAssetId,
  makeAssetTransitionEvent,
  toMermaid,
} from './asset.contract';

describe('asset.contract', () => {
  it('builds canonical asset ids from kind + slug', () => {
    expect(makeAssetId('enterprise', 'Acme Group')).toBe('ENT-acme-group');
    expect(makeAssetId('line', 'A-01')).toBe('LIN-a-01');
    expect(makeAssetId('workcell', 'Cell 7')).toBe('WCL-cell-7');
    expect(makeAssetId('sensor', 'Temp Probe #1')).toBe('SNS-temp-probe-1');
  });

  it('decodes canonical polymorphic asset payload', () => {
    const decoded = decodeAssetSync({
      asset_id: makeAssetId('machine', 'press-12'),
      name: 'Hydraulic Press 12',
      kind: 'machine',
      status: 'maintenance',
      description: 'Downtime planned for hydraulic seal replacement',
      location: {
        latitude: 41.4993,
        longitude: -81.6944,
        building: 'B',
        floor: '1',
        zone: 'Press Hall',
        address: '100 Foundry Way',
        timezone: 'America/New_York',
      },
      properties: {
        machineType: 'hydraulic_press',
        manufacturer: 'Komatsu',
      },
      metadata: {
        owner: 'maintenance',
      },
      parent_id: makeAssetId('line', 'body-line-2'),
      hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-body-line-2/MCH-press-12',
      enterprise_id: makeAssetId('enterprise', 'acme'),
      site_id: makeAssetId('site', 'cleveland'),
      area_id: makeAssetId('area', 'stamping'),
      plant_id: makeAssetId('plant', 'main'),
      line_id: makeAssetId('line', 'body-line-2'),
      work_cell_id: makeAssetId('workcell', 'cell-12'),
      machine_id: makeAssetId('machine', 'press-12'),
      created_at: '2026-02-24T12:00:00Z',
      updated_at: null,
    });

    expect(decoded.asset_id).toBe('MCH-press-12');
    expect(decoded.kind).toBe('machine');
    expect(decoded.status).toBe('maintenance');
  });

  it('constructs assets through helper factory', () => {
    const asset = makeAsset({
      kind: 'sensor',
      slug: 'temp-alpha-01',
      name: 'Temperature Alpha 01',
      status: 'active',
      parent_id: makeAssetId('machine', 'press-12'),
      hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-body/MCH-press-12/SNS-temp-alpha-01',
      machine_id: makeAssetId('machine', 'press-12'),
      properties: { sensorType: 'temperature', unit: 'celsius' },
      metadata: { calibrationWindowDays: 30 },
      created_at: '2026-02-24T12:01:00Z',
    });

    expect(asset.asset_id).toBe('SNS-temp-alpha-01');
    expect(asset.properties.sensorType).toBe('temperature');
    expect(asset.metadata.calibrationWindowDays).toBe(30);
  });

  it('constructs transition events through helper factory', () => {
    const event = makeAssetTransitionEvent({
      idKind: 'line',
      kind: 'line',
      slug: 'body-line-2',
      from: 'active',
      to: 'maintenance',
      at: '2026-02-24T12:02:00Z',
      action: 'StartMaintenance',
      initiated_by: 'planner-1',
    });

    const decoded = decodeAssetTransitionEventSync(event);
    expect(decoded.asset_id).toBe('LIN-body-line-2');
    expect(decoded.to).toBe('maintenance');
  });

  it('accepts valid asset agent-state payload shape', () => {
    const decoded = decodeAssetAgentStateSync(
      makeAsset({
        kind: 'device',
        slug: 'servo-z',
        name: 'Servo Z',
        status: 'inactive',
        hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-body/MCH-press-12/DEV-servo-z',
        machine_id: makeAssetId('machine', 'press-12'),
        created_at: '2026-02-24T12:03:00Z',
      })
    );

    expect(decoded.kind).toBe('device');
    expect(decoded.asset_id).toBe('DEV-servo-z');
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('active', 'inactive')).toBe(true);
    expect(isLegalTransition('active', 'maintenance')).toBe(true);
    expect(isLegalTransition('inactive', 'active')).toBe(true);
    expect(isLegalTransition('maintenance', 'decommissioned')).toBe(true);
    expect(isLegalTransition('decommissioned', 'active')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('active --> maintenance');
    expect(mermaid).toContain('inactive --> decommissioned');
  });

  it('rejects malformed payloads', () => {
    expect(() =>
      decodeAssetSync({
        asset_id: 'BAD-asset',
        name: 'Broken Asset',
        kind: 'machine',
        status: 'active',
        description: null,
        location: null,
        properties: {},
        metadata: {},
        parent_id: null,
        hierarchy_path: null,
        enterprise_id: null,
        site_id: null,
        area_id: null,
        plant_id: null,
        line_id: null,
        work_cell_id: null,
        machine_id: null,
        created_at: '2026-02-24T12:00:00Z',
        updated_at: null,
      })
    ).toThrow();
  });

  it('exports canonical source map metadata', () => {
    expect(AssetCanonicalSourceMap.preferred).toContain('asset-polymorphic.ts');
    expect(AssetCanonicalSourceMap.related).toContain(
      'src/lib/iiot/schemas/assets/common/types.ts'
    );
  });

  it('schema exports are defined', () => {
    expect(AssetSchema).toBeDefined();
    expect(AssetTransitionEventSchema).toBeDefined();
  });
});
