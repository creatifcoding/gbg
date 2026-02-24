import { describe, expect, it } from 'vitest';

import {
  decodeWorkCellAgentStateSync,
  decodeWorkCellSync,
  decodeWorkCellTransitionEventSync,
  isLegalTransition,
  isOperational,
  makeWorkCell,
  makeWorkCellId,
  makeWorkCellTransitionEvent,
  toMermaid,
} from './workcell.contract';

describe('WorkCellSchema (Effect Schema)', () => {
  it('accepts a valid workcell payload', () => {
    const workcell = makeWorkCell({
      slug: 'welding-01',
      line_id: 'LIN-assembly-01',
      name: 'Welding Cell 01',
      status: 'running',
      cell_type: 'welding',
      cycle_time_seconds: 45,
      position: 3,
      hierarchy_path: '/ENT-acme/SIT-main/PLT-a/LIN-assembly-01/WCL-welding-01',
      created_at: '2026-02-22T06:00:00Z',
    });

    const decoded = decodeWorkCellSync(workcell);

    expect(decoded.workcell_id).toBe('WCL-welding-01');
    expect(decoded.status).toBe('running');
    expect(decoded.line_id).toBe('LIN-assembly-01');
  });

  it('rejects an invalid workcell payload', () => {
    expect(() =>
      decodeWorkCellSync({
        workcell_id: makeWorkCellId('welding-02'),
        line_id: 'LIN-assembly-01',
        name: 'Welding Cell 02',
        status: 'running',
        cell_type: 'welding',
        cycle_time_seconds: '45',
        position: 1,
        description: null,
        location: null,
        metadata: {},
        hierarchy_path: '/ENT-acme/SIT-main/PLT-a/LIN-assembly-01/WCL-welding-02',
        enterprise_id: null,
        site_id: null,
        area_id: null,
        plant_id: null,
        created_at: '2026-02-22T06:00:00Z',
        updated_at: null,
      })
    ).toThrow();
  });

  it('accepts valid Jido agent-state payload shape', () => {
    const decoded = decodeWorkCellAgentStateSync(
      makeWorkCell({
        slug: 'agent-cell-01',
        line_id: 'LIN-assembly-01',
        name: 'Agent Cell',
        hierarchy_path: '/ENT-acme/SIT-main/PLT-a/LIN-assembly-01/WCL-agent-cell-01',
        created_at: '2026-02-22T06:00:00Z',
      })
    );

    expect(decoded.workcell_id).toBe('WCL-agent-cell-01');
  });
});

describe('WorkCellTransitionEventSchema + FSM map', () => {
  it('accepts a valid transition event payload', () => {
    const decoded = decodeWorkCellTransitionEventSync(
      makeWorkCellTransitionEvent({
        slug: 'welding-01',
        from: 'setup',
        to: 'running',
        at: '2026-02-22T06:05:00Z',
      })
    );

    expect(decoded.from).toBe('setup');
    expect(decoded.to).toBe('running');
  });

  it('rejects illegal adjacency even if payload is shape-valid', () => {
    const event = decodeWorkCellTransitionEventSync(
      makeWorkCellTransitionEvent({
        slug: 'welding-01',
        from: 'setup',
        to: 'maintenance',
        at: '2026-02-22T06:06:00Z',
      })
    );

    expect(isLegalTransition(event.from, event.to)).toBe(false);
  });

  it('captures operational semantics and emits Mermaid state graph', () => {
    expect(isOperational('idle')).toBe(true);
    expect(isOperational('faulted')).toBe(false);

    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('idle --> setup');
    expect(mermaid).toContain('faulted --> maintenance');
  });
});
