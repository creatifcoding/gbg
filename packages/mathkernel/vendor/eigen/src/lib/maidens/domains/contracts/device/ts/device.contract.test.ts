import { describe, expect, it } from 'vitest';

import {
  DeviceSchema,
  DeviceTransitionEventSchema,
  decodeDeviceAgentStateSync,
  decodeDeviceSync,
  decodeDeviceTransitionEventSync,
  isLegalTransition,
  makeDevice,
  makeDeviceId,
  makeDeviceTransitionEvent,
  toMermaid,
} from './device.contract';

describe('device.contract', () => {
  it('builds device ids using canonical DEV-{slug} format', () => {
    const id = makeDeviceId('Main Spindle Motor');
    expect(id).toBe('DEV-main-spindle-motor');
  });

  it('decodes canonical device payload', () => {
    const decoded = decodeDeviceSync({
      device_id: makeDeviceId('motor-01'),
      name: 'Main Motor',
      status: 'online',
      device_type: 'motor',
      control_mode: 'auto',
      rated_power: 7500,
      power_unit: 'watts',
      last_command_at: '2026-02-24T04:00:00Z',
      opc_ua_node_id: 'ns=2;s=CNC.SpindleMotor',
      description: 'Primary spindle drive motor',
      location: {
        latitude: 41.5,
        longitude: -81.7,
        building: 'A',
        floor: '1',
        zone: 'Z-01',
        address: '100 Factory Way',
        timezone: 'America/Chicago',
      },
      metadata: { owner: 'controls', criticality: 'high' },
      hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-a/WCL-01/MCH-01/DEV-motor-01',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-cleveland',
      area_id: null,
      plant_id: 'PLT-main',
      line_id: 'LIN-a',
      work_cell_id: 'WCL-01',
      machine_id: 'MCH-01',
      created_at: '2026-02-24T03:59:59Z',
      updated_at: null,
    });

    expect(decoded.status).toBe('online');
    expect(decoded.device_id).toBe('DEV-motor-01');
    expect(decoded.device_type).toBe('motor');
    expect(decoded.machine_id).toBe('MCH-01');
  });

  it('constructs device payloads through helper factory', () => {
    const device = makeDevice({
      slug: 'servo-axis-2',
      name: 'Servo Axis 2',
      status: 'provisioned',
      device_type: 'servo',
      hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-a/MCH-07/DEV-servo-axis-2',
      machine_id: 'MCH-07',
      control_mode: 'remote',
      metadata: { source: 'commissioning' },
      created_at: '2026-02-24T04:05:00Z',
    });

    expect(device.device_id).toBe('DEV-servo-axis-2');
    expect(device.control_mode).toBe('remote');
    expect(device.metadata.source).toBe('commissioning');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeDeviceTransitionEvent({
      slug: 'servo-axis-2',
      from: 'provisioned',
      to: 'online',
      at: '2026-02-24T04:06:00Z',
      action: 'GoOnline',
      initiated_by: 'operator-8',
    });

    const decoded = decodeDeviceTransitionEventSync(event);
    expect(decoded.to).toBe('online');
    expect(decoded.action).toBe('GoOnline');
  });

  it('accepts valid agent-state payload shape', () => {
    const decoded = decodeDeviceAgentStateSync(
      makeDevice({
        slug: 'valve-a',
        name: 'Valve A',
        status: 'offline',
        device_type: 'valve',
        hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/MCH-08/DEV-valve-a',
        machine_id: 'MCH-08',
        created_at: '2026-02-24T04:07:00Z',
      })
    );

    expect(decoded.device_id).toBe('DEV-valve-a');
  });

  it('enforces legal transitions', () => {
    expect(isLegalTransition('provisioned', 'online')).toBe(true);
    expect(isLegalTransition('online', 'offline')).toBe(true);
    expect(isLegalTransition('offline', 'decommissioned')).toBe(true);
    expect(isLegalTransition('firmware_update', 'online')).toBe(true);
    expect(isLegalTransition('online', 'decommissioned')).toBe(false);
    expect(isLegalTransition('decommissioned', 'online')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('provisioned --> online');
    expect(mermaid).toContain('firmware_update --> offline');
  });

  it('rejects malformed device payloads', () => {
    expect(() =>
      decodeDeviceSync({
        device_id: 'DEV-@bad-id',
        name: 'Broken Device',
        status: 'online',
        device_type: 'motor',
        control_mode: null,
        rated_power: null,
        power_unit: null,
        last_command_at: null,
        opc_ua_node_id: null,
        description: null,
        location: null,
        metadata: {},
        hierarchy_path: '/x',
        enterprise_id: null,
        site_id: null,
        area_id: null,
        plant_id: null,
        line_id: null,
        work_cell_id: null,
        machine_id: null,
        created_at: '2026-02-24T04:07:00Z',
        updated_at: null,
      })
    ).toThrow();
  });

  it('schema exports are defined', () => {
    expect(DeviceSchema).toBeDefined();
    expect(DeviceTransitionEventSchema).toBeDefined();
  });
});
