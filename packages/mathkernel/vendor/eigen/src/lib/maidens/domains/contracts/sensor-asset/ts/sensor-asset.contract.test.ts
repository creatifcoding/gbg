import { describe, expect, it } from 'vitest';

import {
  SensorAssetSchema,
  SensorAssetTransitionEventSchema,
  decodeSensorAssetAgentStateSync,
  decodeSensorAssetSync,
  decodeSensorAssetTransitionEventSync,
  isLegalTransition,
  makeSensorAsset,
  makeSensorAssetId,
  makeSensorAssetTransitionEvent,
  toMermaid,
} from './sensor-asset.contract';

describe('sensor-asset.contract', () => {
  it('builds sensor asset ids using canonical SNS-{slug} format', () => {
    const id = makeSensorAssetId('Main Spindle Temp Probe');
    expect(id).toBe('SNS-main-spindle-temp-probe');
  });

  it('decodes canonical sensor-asset payload', () => {
    const decoded = decodeSensorAssetSync({
      sensor_id: makeSensorAssetId('temp-01'),
      name: 'Main Spindle Temperature',
      status: 'active',
      sensor_type: 'temperature',
      unit: 'celsius',
      sample_rate_ms: 1000,
      threshold_high: 75,
      threshold_critical: 90,
      threshold_low: null,
      threshold_critical_low: null,
      last_calibration_date: '2026-02-01T00:00:00Z',
      next_calibration_date: '2026-03-01T00:00:00Z',
      opc_ua_node_id: 'ns=2;s=Machines.CNC01.Temp',
      description: 'Spindle housing temperature sensor',
      location: {
        latitude: 41.5,
        longitude: -81.7,
        building: 'A',
        floor: '1',
        zone: 'Z-02',
        address: '100 Factory Way',
        timezone: 'America/Chicago',
      },
      metadata: { owner: 'reliability', criticality: 'high' },
      hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-a/MCH-01/SNS-temp-01',
      enterprise_id: 'ENT-acme',
      site_id: 'SIT-cleveland',
      area_id: null,
      plant_id: 'PLT-main',
      line_id: 'LIN-a',
      work_cell_id: 'WCL-01',
      machine_id: 'MCH-01',
      created_at: '2026-02-24T05:00:00Z',
      updated_at: null,
    });

    expect(decoded.status).toBe('active');
    expect(decoded.sensor_id).toBe('SNS-temp-01');
    expect(decoded.sensor_type).toBe('temperature');
    expect(decoded.unit).toBe('celsius');
  });

  it('constructs sensor-asset payloads through helper factory', () => {
    const sensor = makeSensorAsset({
      slug: 'vib-motor-a',
      name: 'Motor A Vibration',
      status: 'needs_calibration',
      sensor_type: 'vibration',
      unit: 'mm_s',
      hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-a/MCH-07/SNS-vib-motor-a',
      machine_id: 'MCH-07',
      sample_rate_ms: 250,
      metadata: { source: 'commissioning' },
      created_at: '2026-02-24T05:05:00Z',
    });

    expect(sensor.sensor_id).toBe('SNS-vib-motor-a');
    expect(sensor.status).toBe('needs_calibration');
    expect(sensor.sample_rate_ms).toBe(250);
    expect(sensor.metadata.source).toBe('commissioning');
  });

  it('constructs transition events through helper factory', () => {
    const event = makeSensorAssetTransitionEvent({
      slug: 'vib-motor-a',
      from: 'needs_calibration',
      to: 'calibrating',
      at: '2026-02-24T05:06:00Z',
      action: 'StartCalibration',
      initiated_by: 'tech-2',
    });

    const decoded = decodeSensorAssetTransitionEventSync(event);
    expect(decoded.to).toBe('calibrating');
    expect(decoded.action).toBe('StartCalibration');
  });

  it('accepts valid agent-state payload shape', () => {
    const decoded = decodeSensorAssetAgentStateSync(
      makeSensorAsset({
        slug: 'flow-line-2',
        name: 'Line 2 Coolant Flow',
        status: 'offline',
        sensor_type: 'flow',
        unit: 'l_min',
        hierarchy_path: '/ENT-acme/SIT-cleveland/PLT-main/LIN-a/MCH-08/SNS-flow-line-2',
        machine_id: 'MCH-08',
        created_at: '2026-02-24T05:07:00Z',
      })
    );

    expect(decoded.sensor_id).toBe('SNS-flow-line-2');
  });

  it('enforces legal transitions from canonical sensor graph', () => {
    expect(isLegalTransition('active', 'calibrating')).toBe(true);
    expect(isLegalTransition('active', 'needs_calibration')).toBe(true);
    expect(isLegalTransition('faulted', 'offline')).toBe(true);
    expect(isLegalTransition('offline', 'decommissioned')).toBe(true);
    expect(isLegalTransition('calibrating', 'offline')).toBe(false);
    expect(isLegalTransition('decommissioned', 'active')).toBe(false);
  });

  it('emits Mermaid transition diagram', () => {
    const mermaid = toMermaid();
    expect(mermaid).toContain('stateDiagram-v2');
    expect(mermaid).toContain('active --> calibrating');
    expect(mermaid).toContain('offline --> decommissioned');
  });

  it('rejects malformed sensor-asset payloads', () => {
    expect(() =>
      decodeSensorAssetSync({
        sensor_id: 'SNS-@bad-id',
        name: 'Broken Sensor',
        status: 'active',
        sensor_type: 'temperature',
        unit: 'celsius',
        sample_rate_ms: null,
        threshold_high: null,
        threshold_critical: null,
        threshold_low: null,
        threshold_critical_low: null,
        last_calibration_date: null,
        next_calibration_date: null,
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
        created_at: '2026-02-24T05:07:00Z',
        updated_at: null,
      })
    ).toThrow();
  });

  it('schema exports are defined', () => {
    expect(SensorAssetSchema).toBeDefined();
    expect(SensorAssetTransitionEventSchema).toBeDefined();
  });
});
