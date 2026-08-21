/**
 * Provenance schema (#60): one LabEntity record, compact gbg: refs, W7 on
 * activities, honesty class on generated entities. Fixtures only — not live rows.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as Schema from 'effect/Schema';
import {
  decodeDoctorReportPayload,
  decodeLabEntity,
  DOCTOR_REPORT_SCHEMA_ID,
  LabEntity,
  LabEntityRecord,
} from '../src/schemas/provenance.js';
import {
  EntityRef,
  parseEntityRef,
  specimenIdFromRef,
  specimenRefFromId,
  trustSpecimenId,
} from '../src/schemas/identifiers.js';
import { LabEntityModel } from '../src/models/LabEntityModel.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'provenance');

const load = (name: string): unknown =>
  JSON.parse(readFileSync(join(fixturesDir, name), 'utf8')) as unknown;

const decodeFails = (input: unknown): boolean => {
  try {
    decodeLabEntity(input);
    return false;
  } catch {
    return true;
  }
};

describe('compact gbg: refs', () => {
  it('parses sheet / step / specimen / run / activity grammar', () => {
    expect(parseEntityRef('gbg:sheet:S01@pr58')).toEqual({
      kind: 'sheet',
      local: 'S01',
      rev: 'pr58',
    });
    expect(parseEntityRef('gbg:step:B01@fe8f875a')).toEqual({
      kind: 'step',
      local: 'B01',
      rev: 'fe8f875a',
    });
    expect(parseEntityRef('gbg:specimen:fixture-catalog-001')).toEqual({
      kind: 'specimen',
      local: 'fixture-catalog-001',
      rev: undefined,
    });
    expect(parseEntityRef('gbg:run:doctor:pr57-fixture')).toEqual({
      kind: 'run',
      local: 'doctor:pr57-fixture',
      rev: undefined,
    });
    expect(parseEntityRef('gbg:activity:export-carriage@pr58')).toEqual({
      kind: 'activity',
      local: 'export-carriage',
      rev: 'pr58',
    });
  });

  it('maps gbg:specimen:<id> onto the existing SpecimenId brand', () => {
    const id = trustSpecimenId('fixture-catalog-001');
    const ref = specimenRefFromId(id);
    expect(ref).toBe('gbg:specimen:fixture-catalog-001');
    expect(specimenIdFromRef(ref)).toBe(id);
  });

  it('rejects a missing or malformed ref', () => {
    expect(() => Schema.decodeUnknownSync(EntityRef)('')).toThrow();
    expect(() => Schema.decodeUnknownSync(EntityRef)('sheet:S01@pr58')).toThrow();
    expect(() => Schema.decodeUnknownSync(EntityRef)('gbg:SHEET:S01@pr58')).toThrow();
  });
});

describe('LabEntity fixtures', () => {
  it('parses sheet S01@pr58 as projected', () => {
    const entity = decodeLabEntity(load('sheet-s01-pr58.json'));
    expect(entity.ref).toBe('gbg:sheet:S01@pr58');
    expect(entity.kind).toBe('sheet');
    expect(entity.class).toBe('projected');
  });

  it('parses solid B01@fe8f875a as draft-measured (PR 34)', () => {
    const entity = decodeLabEntity(load('solid-b01-fe8f875a.json'));
    expect(entity.ref).toBe('gbg:step:B01@fe8f875a');
    expect(entity.kind).toBe('solid');
    expect(entity.class).toBe('draft-measured');
    expect(entity.wasGeneratedBy).toBe('gbg:activity:freecad-part-occt@fe8f875a');
  });

  it('parses the STEP export activity that generated B01', () => {
    const entity = decodeLabEntity(load('activity-freecad-part-occt.json'));
    expect(entity.kind).toBe('activity');
    expect(entity.how).toBe('freecad-part-occt');
    expect(entity.what?.generated).toContain('gbg:step:B01@fe8f875a');
    expect(entity.generated).toContain('gbg:step:B01@fe8f875a');
    expect(entity.where).toBe('unknown');
  });

  it('wraps PR 57 doctor-report.v1.json without forking it', () => {
    const entity = decodeLabEntity(load('run-doctor-pr57.json'));
    expect(entity.ref).toBe('gbg:run:doctor:pr57-fixture');
    expect(entity.kind).toBe('run');
    expect(entity.class).toBe('unverified');
    expect(entity.payloadSchemaId).toBe(DOCTOR_REPORT_SCHEMA_ID);
    const report = decodeDoctorReportPayload(entity.payload);
    expect(report.kind).toBe('MantisEnvironmentDoctorReport');
    expect(report.schemaVersion).toBe('1.0.0');
    expect(report.ok).toBe(false);
  });

  it('parses one Specimen on the existing brand', () => {
    const entity = decodeLabEntity(load('specimen-fixture-catalog-001.json'));
    expect(entity.kind).toBe('specimen');
    expect(entity.specimenId).toBe('fixture-catalog-001');
    expect(specimenIdFromRef(entity.ref)).toBe(entity.specimenId);
  });

  it('rejects a missing ref', () => {
    const sheet = load('sheet-s01-pr58.json') as { ref?: string };
    const { ref: _ref, ...rest } = sheet;
    expect(decodeFails(rest)).toBe(true);
  });

  it('rejects a missing class', () => {
    const sheet = load('sheet-s01-pr58.json') as { class?: string };
    const { class: _class, ...rest } = sheet;
    expect(decodeFails(rest)).toBe(true);
  });

  it('rejects an activity missing W7', () => {
    expect(
      decodeFails({
        _tag: 'LabEntity',
        ref: 'gbg:activity:export-carriage@pr58',
        kind: 'activity',
        label: 'export_carriage_step.py',
        class: 'theoretical',
      }),
    ).toBe(true);
  });
});

describe('LabEntityModel (no table)', () => {
  it('exposes json / insert variants without a lab_entities table', () => {
    expect(LabEntityModel.json).toBeDefined();
    expect(LabEntityModel.insert).toBeDefined();
    const decoded = Schema.decodeUnknownSync(LabEntity)(load('sheet-s01-pr58.json'));
    expect(decoded._tag).toBe('LabEntity');
    expect(LabEntityRecord).toBeDefined();
  });
});
