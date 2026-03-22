import { describe, expect, it } from 'vitest';

import {
  AreaSchema,
  AreaTransitionEventSchema,
  decodeAreaSync,
  decodeAreaTransitionEventSync,
  isLegalTransition,
  makeArea,
  makeAreaHierarchyPath,
  makeAreaId,
  makeAreaTransitionEvent,
  toMermaid,
} from './area.contract';

describe('area.contract', () => {
  it('builds area ids from slug input', () => {
    const id = makeAreaId('production west 1');
    expect(id).toBe('ARA-PRODUCTION-WEST-1');
  });

  it('decodes canonical area payload', () => {
    const decoded = decodeAreaSync({
      area_id: makeAreaId('warehouse-east'),
      name: 'Warehouse East',
      status: 'active',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-cleveland',
      area_type: 'warehouse',
      building: 'Building 2',
      floor: 'Ground',
      zone: 'ZE-2',
      description: 'Bulk receiving and staging',
      location: {
        latitude: 41.5,
        longitude: -81.7,
        building: 'Building 2',
        floor: 'Ground',
        zone: 'ZE-2',
        address: '200 Harbor Road',
        timezone: 'America/New_York',
      },
      metadata: { owner: 'ops' },
      hierarchy_path: '/ENT-acme/SIT-cleveland/ARA-WAREHOUSE-EAST',
      created_at: '2026-02-24T00:00:00Z',
      updated_at: null,
    });

    expect(decoded.status).toBe('active');
    expect(decoded.area_type).toBe('warehouse');
  });

  it('constructs areas through helper factory', () => {
    const area = makeArea({
      slug: 'production-1',
      name: 'Production Area 1',
      status: 'restricted',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-cleveland',
      area_type: 'production',
      hierarchy_path: '/ENT-acme/SIT-cleveland/ARA-PRODUCTION-1',
      created_at: '2026-02-24T00:01:00Z',
      metadata: { owner: 'operations' },
    });

    expect(area.area_id).toBe('ARA-PRODUCTION-1');
    expect(area.metadata.owner).toBe('operations');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeAreaTransitionEvent({
      slug: 'production-1',
      from: 'active',
      to: 'maintenance',
      at: '2026-02-24T00:05:00Z',
      reason: 'scheduled inspection',
      by: 'supervisor-2',
    });

    const decoded = decodeAreaTransitionEventSync(event);
    expect(decoded.to).toBe('maintenance');
  });

  it('builds hierarchy paths for both lane models', () => {
    const siteScoped = makeAreaHierarchyPath({
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-cleveland',
      slug: 'receiving-east',
    });

    const plantScoped = makeAreaHierarchyPath({
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-cleveland',
      plant_id: 'PLT-cleveland-main',
      slug: 'receiving-east',
    });

    expect(siteScoped).toBe('/ENT-acme/SIT-cleveland/ARA-RECEIVING-EAST');
    expect(plantScoped).toBe('/ENT-acme/SIT-cleveland/PLT-cleveland-main/ARA-RECEIVING-EAST');
  });

  it('rejects hierarchy paths that violate ISA-95 area parent semantics', () => {
    expect(() =>
      decodeAreaSync({
        area_id: makeAreaId('warehouse-east'),
        name: 'Warehouse East',
        status: 'active',
        enterprise_id: 'ENT-acme',
        site_id: 'SIT-cleveland',
        area_type: 'warehouse',
        building: null,
        floor: null,
        zone: null,
        description: null,
        location: null,
        metadata: {},
        hierarchy_path: '/ENT-acme/PLT-cleveland-main/ARA-WAREHOUSE-EAST',
        created_at: '2026-02-24T00:00:00Z',
        updated_at: null,
      })
    ).toThrow();
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('active', 'restricted')).toBe(true);
    expect(isLegalTransition('maintenance', 'decommissioned')).toBe(true);
    expect(isLegalTransition('restricted', 'decommissioned')).toBe(false);
    expect(isLegalTransition('decommissioned', 'active')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('active --> restricted');
    expect(mermaid).toContain('maintenance --> decommissioned');
  });

  it('schema exports are defined', () => {
    expect(AreaSchema).toBeDefined();
    expect(AreaTransitionEventSchema).toBeDefined();
  });
});
