import { describe, expect, it } from 'vitest';

import {
  SiteSchema,
  SiteTransitionEventSchema,
  decodeSiteAgentStateSync,
  decodeSiteSync,
  decodeSiteTransitionEventSync,
  isLegalTransition,
  makeSite,
  makeSiteId,
  makeSiteTransitionEvent,
  toMermaid,
} from './site.contract';

describe('site.contract', () => {
  it('builds site ids using canonical SIT-{slug} format', () => {
    const id = makeSiteId('Chicago Main Campus');
    expect(id).toBe('SIT-chicago-main-campus');
  });

  it('decodes canonical site payload', () => {
    const decoded = decodeSiteSync({
      site_id: makeSiteId('chicago-main'),
      name: 'Chicago Main Site',
      status: 'operational',
      timezone: 'America/Chicago',
      address: '123 Industrial Pkwy',
      city: 'Chicago',
      state: 'IL',
      country: 'USA',
      postal_code: '60601',
      description: 'Primary Midwest campus',
      location: {
        latitude: 41.8781,
        longitude: -87.6298,
        building: 'HQ',
        floor: null,
        zone: 'Z-01',
        address: '123 Industrial Pkwy',
        timezone: 'America/Chicago',
      },
      metadata: { owner: 'operations' },
      hierarchy_path: '/ENT-acme/SIT-chicago-main',
      enterprise_id: 'ENT-acme',
      created_at: '2026-02-24T01:00:00Z',
      updated_at: null,
    });

    expect(decoded.status).toBe('operational');
    expect(decoded.site_id).toBe('SIT-chicago-main');
    expect(decoded.enterprise_id).toBe('ENT-acme');
  });

  it('constructs site payloads through helper factory', () => {
    const site = makeSite({
      slug: 'northeast-hub',
      name: 'Northeast Hub',
      status: 'under_construction',
      timezone: 'America/New_York',
      enterprise_id: 'ENT-acme',
      hierarchy_path: '/ENT-acme/SIT-northeast-hub',
      created_at: '2026-02-24T01:01:00Z',
      metadata: { region: 'na-east' },
    });

    expect(site.site_id).toBe('SIT-northeast-hub');
    expect(site.status).toBe('under_construction');
    expect(site.metadata.region).toBe('na-east');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeSiteTransitionEvent({
      slug: 'northeast-hub',
      from: 'planned',
      to: 'under_construction',
      action: 'BeginConstruction',
      at: '2026-02-24T01:02:00Z',
      initiated_by: 'pm-12',
    });

    const decoded = decodeSiteTransitionEventSync(event);
    expect(decoded.to).toBe('under_construction');
    expect(decoded.action).toBe('BeginConstruction');
  });

  it('accepts valid agent-state payload shape', () => {
    const decoded = decodeSiteAgentStateSync(
      makeSite({
        slug: 'winter-port',
        name: 'Winter Port Site',
        status: 'seasonal_shutdown',
        timezone: 'America/Denver',
        enterprise_id: 'ENT-acme',
        hierarchy_path: '/ENT-acme/SIT-winter-port',
        created_at: '2026-02-24T01:03:00Z',
      })
    );

    expect(decoded.site_id).toBe('SIT-winter-port');
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('planned', 'under_construction')).toBe(true);
    expect(isLegalTransition('under_construction', 'operational')).toBe(true);
    expect(isLegalTransition('operational', 'closed')).toBe(true);
    expect(isLegalTransition('closed', 'decommissioned')).toBe(true);
    expect(isLegalTransition('planned', 'operational')).toBe(false);
    expect(isLegalTransition('seasonal_shutdown', 'closed')).toBe(false);
    expect(isLegalTransition('decommissioned', 'operational')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('planned --> under_construction');
    expect(mermaid).toContain('closed --> decommissioned');
  });

  it('rejects malformed site payloads', () => {
    expect(() =>
      decodeSiteSync({
        site_id: 'BAD-id',
        name: 'Broken Site',
        status: 'operational',
        timezone: 'America/Chicago',
        address: null,
        city: null,
        state: null,
        country: null,
        postal_code: null,
        description: null,
        location: null,
        metadata: {},
        hierarchy_path: '/x',
        enterprise_id: 'ENT-acme',
        created_at: '2026-02-24T01:04:00Z',
        updated_at: null,
      })
    ).toThrow();
  });

  it('schema exports are defined', () => {
    expect(SiteSchema).toBeDefined();
    expect(SiteTransitionEventSchema).toBeDefined();
  });
});
