import { describe, expect, it } from 'vitest';

import {
  EnterpriseSchema,
  EnterpriseTransitionEventSchema,
  decodeEnterpriseSync,
  decodeEnterpriseTransitionEventSync,
  isLegalTransition,
  makeEnterprise,
  makeEnterpriseId,
  makeEnterpriseTransitionEvent,
  toMermaid,
} from './enterprise.contract';

describe('enterprise.contract', () => {
  it('builds enterprise ids with ENT- prefix', () => {
    expect(makeEnterpriseId('Acme Corp')).toBe('ENT-acme-corp');
  });

  it('decodes canonical enterprise payload', () => {
    const decoded = decodeEnterpriseSync({
      enterprise_id: makeEnterpriseId('acme-corp'),
      name: 'ACME Corporation',
      status: 'active',
      industry: 'manufacturing',
      legal_name: 'ACME Corporation LLC',
      tax_id: '99-9999999',
      headquarters: 'Pittsburgh, PA',
      description: null,
      metadata: {},
      hierarchy_path: '/ENT-acme-corp',
      created_at: '2026-02-24T00:00:00Z',
      updated_at: null,
    });

    expect(decoded.status).toBe('active');
  });

  it('constructs enterprise payloads through helper factory', () => {
    const enterprise = makeEnterprise({
      slug: 'nova-industries',
      name: 'Nova Industries',
      status: 'restructuring',
      industry: 'pharma',
      created_at: '2026-02-24T00:01:00Z',
    });

    expect(enterprise.enterprise_id).toBe('ENT-nova-industries');
    expect(enterprise.status).toBe('restructuring');
    expect(enterprise.hierarchy_path).toBe('/ENT-nova-industries');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeEnterpriseTransitionEvent({
      slug: 'acme-corp',
      from: 'active',
      to: 'restructuring',
      at: '2026-02-24T00:03:00Z',
      reason: 'portfolio-realignment',
    });

    const decoded = decodeEnterpriseTransitionEventSync(event);
    expect(decoded.to).toBe('restructuring');
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('active', 'restructuring')).toBe(true);
    expect(isLegalTransition('restructuring', 'active')).toBe(true);
    expect(isLegalTransition('active', 'merged')).toBe(true);
    expect(isLegalTransition('merged', 'active')).toBe(false);
    expect(isLegalTransition('dissolved', 'active')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('active --> restructuring');
    expect(mermaid).toContain('active --> merged');
  });

  it('schema exports are defined', () => {
    expect(EnterpriseSchema).toBeDefined();
    expect(EnterpriseTransitionEventSchema).toBeDefined();
  });
});
