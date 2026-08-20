import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  ArtifactStatus,
  EvidenceBasis,
  LabArtifact,
  ValidatedEvidenceRecord,
} from '../src/domain.ts';
import * as specimenDbBridge from '../src/specimendb.ts';
import {
  EVIDENCE_SCHEMA_PATH,
  loadEvidenceRuntimeValidator,
  planAttachment,
  projectComponents,
  type EvidenceRuntimeValidator,
} from '../src/specimendb.ts';

interface RecordChanges {
  readonly evidenceId?: string;
  readonly sourceClass?: ValidatedEvidenceRecord['sourceClass'];
  readonly claimRefs?: readonly string[];
  readonly disposition?: ValidatedEvidenceRecord['result']['disposition'];
  readonly review?: ValidatedEvidenceRecord['review'];
  readonly admissions?: ValidatedEvidenceRecord['admissions'];
}

const evidenceRecord = (changes: RecordChanges = {}): ValidatedEvidenceRecord => ({
  schemaVersion: '1.0.0',
  kind: 'EvidenceRecord',
  evidenceId: changes.evidenceId ?? 'coupon-contact-count',
  workspaceRef: 'biomemetics.mantis',
  claimRefs: changes.claimRefs ?? ['claim:rail:contact-count'],
  sourceClass: changes.sourceClass ?? 'measured',
  recordedAt: '2026-08-20T12:00:00Z',
  producer: { kind: 'instrument', name: 'caliper' },
  environment: { description: 'bench' },
  method: { protocol: 'count exposed pads', acceptance: 'two agreeing counts' },
  inputs: [
    {
      ref: 'terrarium/cad/contact-coupon.step',
      role: 'test article',
      sha256: 'a'.repeat(64),
    },
  ],
  observations: [
    {
      statement: 'Twelve contacts are exposed.',
      status: 'observed',
      sourceRef: 'evidence/coupon-photo-01.png',
    },
  ],
  measurements: [
    {
      parameterRef: 'rail.contact_count',
      value: 12,
      unit: 'count',
      uncertainty: 0,
      sampleCount: 1,
    },
  ],
  artifacts: [
    {
      path: 'evidence/coupon-measurement.json',
      sha256: 'b'.repeat(64),
      mediaType: 'application/json',
    },
  ],
  admissions: changes.admissions ?? [
    {
      claimRef: 'claim:rail:contact-count',
      kind: 'structure',
      text: 'Coupon exposes twelve contacts.',
    },
  ],
  result: {
    disposition: changes.disposition ?? 'supports',
    summary: 'The coupon exposes twelve contacts.',
    limitations: ['Single fabricated coupon.'],
  },
  review: changes.review ?? {
    status: 'accepted',
    reviewer: 'reviewer@example.test',
    reviewedAt: '2026-08-20T13:00:00Z',
  },
});

const validator = loadEvidenceRuntimeValidator();

const artifact = (
  record: unknown = evidenceRecord(),
  options: {
    readonly status?: ArtifactStatus;
    readonly basis?: EvidenceBasis;
    readonly claimRef?: string;
    readonly recordRef?: string;
  } = {},
): LabArtifact => ({
  id: 'terrarium:rail-contact-coupon:rA',
  project: 'terrarium',
  kind: 'test-evidence',
  status: options.status ?? 'accepted',
  files: [],
  evidence: [
    {
      id: 'coupon-contact-count',
      basis: options.basis ?? 'measured',
      recordRef: options.recordRef ?? 'evidence/coupon-measurement.json',
      claimRef: options.claimRef ?? 'claim:rail:contact-count',
      record,
    },
  ],
});

test('projects only accepted, schema-validated, supporting evidence', () => {
  const projection = projectComponents(artifact(), validator);
  assert.equal(projection.projections.length, 1);
  assert.deepEqual(projection.omissions, []);
  const planned = projection.projections[0];
  assert.deepEqual(planned?.component, {
    _tag: 'Structure',
    text: 'Coupon exposes twelve contacts.',
  });
  assert.equal(planned?.provenance.evidenceId, 'coupon-contact-count');
  assert.equal(
    planned?.provenance.evidenceRef,
    'evidence/coupon-measurement.json',
  );
  assert.deepEqual(planned?.provenance.claimRefs, [
    'claim:rail:contact-count',
  ]);
  assert.deepEqual(planned?.provenance.inputRefs, [
    {
      ref: 'terrarium/cad/contact-coupon.step',
      role: 'test article',
      sha256: 'a'.repeat(64),
    },
  ]);
  assert.deepEqual(planned?.provenance.observationSourceRefs, [
    'evidence/coupon-photo-01.png',
  ]);
  assert.equal(planned?.provenance.review.reviewer, 'reviewer@example.test');
});

test('verified artifacts are also eligible', () => {
  assert.equal(
    projectComponents(artifact(evidenceRecord(), { status: 'verified' }), validator)
      .projections.length,
    1,
  );
});

test('artifact review state gates projection before record validation', () => {
  const projection = projectComponents(
    artifact({ malformed: true }, { status: 'draft' }),
    validator,
  );
  assert.deepEqual(projection.omissions[0]?.reasons, [
    'artifact-status-not-admitted',
  ]);
});

test('rejects forged validators and validates against the pinned contract', () => {
  const forgedValidator = {
    schemaPath: EVIDENCE_SCHEMA_PATH,
    schemaSha256: validator.schemaSha256,
    validate: () => ({ valid: true, value: evidenceRecord() }),
  } as unknown as EvidenceRuntimeValidator;
  assert.throws(
    () => projectComponents(artifact(), forgedValidator),
    /loadEvidenceRuntimeValidator/,
  );

  const projection = projectComponents(artifact({ malformed: true }), validator);
  assert.equal(projection.omissions[0]?.evidenceId, 'coupon-contact-count');
  assert.deepEqual(projection.omissions[0]?.reasons, ['contract-invalid']);
  assert.ok((projection.omissions[0]?.validationErrors?.length ?? 0) > 0);
});

test('measured evidence requires at least one measurement', () => {
  const { measurements: _measurements, ...withoutMeasurements } = evidenceRecord();
  const projection = projectComponents(artifact(withoutMeasurements), validator);
  assert.deepEqual(projection.omissions[0]?.reasons, ['contract-invalid']);
  assert.ok(
    projection.omissions[0]?.validationErrors?.includes(
      '/measurements is required for measured',
    ),
  );
});

test('runtime gate rejects optional fields that the JSON Schema rejects', () => {
  const record = evidenceRecord();
  const badUriDigest = {
    ...record,
    artifacts: [
      {
        uri: 'https://example.test/evidence.json',
        sha256: 'bad',
        mediaType: 'application/json',
      },
    ],
  };
  const uriResult = validator.validate(badUriDigest);
  assert.equal(uriResult.valid, false);

  const schemaTypeResult = validator.validate({ ...record, $schema: 42 });
  assert.equal(schemaTypeResult.valid, false);

  const dateResult = validator.validate({
    ...record,
    recordedAt: '2026-08-20T12:00:00',
  });
  assert.equal(dateResult.valid, false);
});

test('rejects non-observed/non-measured source classes', () => {
  const projection = projectComponents(
    artifact(evidenceRecord({ sourceClass: 'calculated' }), {
      basis: 'calculated',
    }),
    validator,
  );
  assert.ok(
    projection.omissions[0]?.reasons.includes('source-class-not-admitted'),
  );
});

test('rejects non-supporting results, unaccepted review, and missing metadata', () => {
  const projection = projectComponents(
    artifact(
      evidenceRecord({
        disposition: 'inconclusive',
        review: { status: 'pending' },
      }),
    ),
    validator,
  );
  assert.deepEqual(projection.omissions[0]?.reasons, [
    'result-does-not-support',
    'review-not-accepted',
    'review-metadata-missing',
  ]);
});

test('requires an explicit claim link into the validated evidence record', () => {
  const projection = projectComponents(
    artifact(evidenceRecord(), { claimRef: 'claim:not-in-record' }),
    validator,
  );
  assert.deepEqual(projection.omissions[0]?.reasons, [
    'claim-link-missing',
    'admission-missing',
  ]);
});

test('projection payload comes only from one reviewed claim admission', () => {
  const reviewedText = 'Reviewed claim-bound structure text.';
  const record = evidenceRecord({
    admissions: [
      {
        claimRef: 'claim:rail:contact-count',
        kind: 'structure',
        text: reviewedText,
      },
    ],
  });
  const projected = projectComponents(artifact(record), validator);
  assert.deepEqual(projected.projections[0]?.component, {
    _tag: 'Structure',
    text: reviewedText,
  });

  const ambiguous = evidenceRecord({
    admissions: [
      {
        claimRef: 'claim:rail:contact-count',
        kind: 'structure',
        text: 'First reviewed payload.',
      },
      {
        claimRef: 'claim:rail:contact-count',
        kind: 'function',
        text: 'Second reviewed payload.',
      },
    ],
  });
  assert.deepEqual(
    projectComponents(artifact(ambiguous), validator).omissions[0]?.reasons,
    ['admission-ambiguous'],
  );
});

test('reports current SpecimenDB attachment blocker', async () => {
  const port = { get: async (id: string) => ({ id }) };
  const plan = await planAttachment(
    port,
    'real-caller-supplied-id',
    artifact(),
    validator,
  );
  assert.equal(plan.executable, false);
  assert.equal(plan.blocker, 'specimendb-attach-unavailable');
  assert.deepEqual(plan.blockers, ['specimendb-attach-unavailable']);
  assert.equal(plan.evidenceSchemaPath, EVIDENCE_SCHEMA_PATH);
});

test('an injected arbitrary write method cannot make a plan executable', async () => {
  let writes = 0;
  const port = {
    get: async (id: string) => ({ id }),
    attach: async () => {
      writes += 1;
    },
  };
  const plan = await planAttachment(
    port,
    'real-caller-supplied-id',
    artifact(),
    validator,
  );
  assert.equal(plan.executable, false);
  assert.deepEqual(plan.blockers, ['specimendb-attach-unavailable']);
  assert.equal(writes, 0);
  assert.equal('attachEvidence' in specimenDbBridge, false);
});

test('reports admission and API blockers when no projections survive', async () => {
  const port = { get: async (id: string) => ({ id }) };
  const plan = await planAttachment(
    port,
    'real-caller-supplied-id',
    artifact(evidenceRecord(), { status: 'draft' }),
    validator,
  );
  assert.deepEqual(plan.blockers, [
    'specimendb-attach-unavailable',
    'no-admissible-evidence',
  ]);
});

test('never accepts an absent specimen id', async () => {
  const port = { get: async (id: string) => ({ id }) };
  await assert.rejects(
    () => planAttachment(port, ' ', artifact(), validator),
    TypeError,
  );
});
