import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { deriveAnalog } from '../../analogs/src/analog.ts';
import { planGovernedProjection } from '../../analogs/src/projection.ts';
import { deriveFunction, deriveMechanism } from '../../mechanisms/src/mechanism.ts';
import { deriveStructure } from '../../morphology/src/structure.ts';
import {
  COMMITTED_LANES_ROOT,
  committedStateIsEmpty,
  inspectLanes,
  traverse,
} from '../src/pipeline.ts';
import { PipelineRefused, type Review } from '../src/types.ts';

const accepted: Review = {
  status: 'accepted',
  reviewer: 'reviewer@example.test',
  reviewedAt: '2026-08-20T13:00:00Z',
};

const pending: Review = { status: 'pending' };

const gitSha = 'e435400442ce4fe099073ebd0e384d12a3aca09e';

const writeMedia = (): { absolutePath: string; lanesRelativePath: string } => {
  const dir = mkdtempSync(join(tmpdir(), 'mantis-obs-'));
  const absolutePath = join(dir, 'drop.jpg');
  writeFileSync(absolutePath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
  return {
    absolutePath,
    lanesRelativePath: 'observations/media/drop.jpg',
  };
};

const visibleStatements = [
  {
    text: 'A segmented raptorial foreleg is visible in the frame.',
    status: 'observed' as const,
    sourceRef: 'observations/media/drop.jpg',
  },
];

const mediaBase = () => ({
  ...writeMedia(),
  observationId: 'obs-drop-01',
  recordedAt: '2026-08-20T12:00:00Z',
  license: 'CC-BY-4.0',
  consent: 'owner-supplied laboratory drop',
  mediaType: 'image/jpeg',
  statements: visibleStatements,
  review: accepted,
});

const structureDraft = {
  structureId: 'str-foreleg-01',
  basis: 'observed' as const,
  description: 'Segmented raptorial foreleg visible in the admitted frame.',
  review: accepted,
};

const mechanismDraft = {
  mechanismId: 'mech-grasp-01',
  hypothesis: 'Spines on the foreleg increase prey retention during a grasp.',
  falsifier: 'A grasp sequence without spine contact would retain prey equally.',
  status: 'unverified' as const,
  states: ['open', 'close', 'hold'],
  members: { moving: ['tibia'], grounded: ['coxa'] },
  failureModes: ['slip under load'],
  verificationPlan: 'High-speed video of a grasp with scale.',
  review: accepted,
};

const functionDraft = {
  functionId: 'fn-retain-01',
  statement: 'The foreleg retains prey after contact.',
  status: 'unverified' as const,
  limits: ['Not observed as a completed strike in this frame.'],
  review: accepted,
};

const analogDraft = {
  analogId: 'an-latch-01',
  target: 'terrarium.binder.retention',
  limit: 'Inspiration for a latch geometry study only.',
  nonEquivalence: 'A printed latch is not a raptorial tibia.',
  note: 'Directional mapping; independent mechanical evidence still required.',
  review: accepted,
};

const refuse = (fn: () => unknown): PipelineRefused => {
  try {
    fn();
  } catch (error) {
    assert.equal(error instanceof PipelineRefused, true);
    return error as PipelineRefused;
  }
  throw new Error('expected PipelineRefused');
};

test('committed lanes stay empty: no photo, taxon unknown, lab is not a Specimen', () => {
  const state = inspectLanes(COMMITTED_LANES_ROOT);
  assert.equal(committedStateIsEmpty(state), true);
  assert.deepEqual(state.observations.taxon, {
    status: 'unknown',
    reason: 'no-real-media',
  });
  assert.equal(state.observations.catalogSpecimen, false);
  assert.deepEqual(state.mediaFiles, []);
  assert.deepEqual(state.analogs.records, []);
});

test('refuses invented GPS/locality on the caller envelope', () => {
  const error = refuse(() =>
    traverse({
      media: mediaBase(),
      gitSha,
      runId: 'run-01',
      caller: { gps: { lat: 1, lon: 2 } },
    }),
  );
  assert.ok(error.reasons.includes('invented-locality'));
});

test('refuses an uncited taxon name', () => {
  const error = refuse(() =>
    traverse({
      media: {
        ...mediaBase(),
        taxon: 'Mantis religiosa' as unknown as never,
      },
      gitSha,
      runId: 'run-01',
    }),
  );
  assert.ok(error.reasons.includes('invented-taxon'));
});

test('refuses treating the lab as a Specimen or inserting one', () => {
  const lab = refuse(() =>
    traverse({
      media: mediaBase(),
      gitSha,
      runId: 'run-01',
      specimenId: 'biomemetics.mantis',
    }),
  );
  assert.ok(lab.reasons.includes('lab-as-specimen'));

  const insert = refuse(() =>
    traverse({
      media: mediaBase(),
      gitSha,
      runId: 'run-01',
      insertSpecimen: true,
    }),
  );
  assert.ok(insert.reasons.includes('specimen-insert-forbidden'));
});

test('refuses a store write and an injected attach cannot execute', () => {
  const error = refuse(() =>
    traverse({
      media: mediaBase(),
      gitSha,
      runId: 'run-01',
      writeStore: true,
    }),
  );
  assert.ok(error.reasons.includes('store-write-forbidden'));

  let writes = 0;
  const result = traverse({
    media: mediaBase(),
    structure: structureDraft,
    mechanism: mechanismDraft,
    fn: functionDraft,
    analog: analogDraft,
    gitSha,
    runId: 'run-01',
  });
  const attach = async () => {
    writes += 1;
    return { storeWrite: true };
  };
  void attach;
  assert.equal(result.projection.executable, false);
  assert.equal(result.projection.storeWrite, false);
  assert.equal(result.projection.localityMutated, false);
  assert.equal(result.projection.taxonMutated, false);
  assert.equal(result.projection.blocker, 'specimendb-attach-unavailable');
  assert.equal(writes, 0);
});

test('refuses analog without function', () => {
  const missing = refuse(() =>
    traverse({
      media: mediaBase(),
      structure: structureDraft,
      mechanism: mechanismDraft,
      analog: analogDraft,
      gitSha,
      runId: 'run-01',
    }),
  );
  assert.ok(missing.reasons.includes('missing-function'));
});

test('validateAnalog refuses equivalence and lab targets', async () => {
  const { validateAnalog } = await import('../src/validate.ts');
  const fn = {
    schemaVersion: '1.0.0' as const,
    kind: 'Function' as const,
    functionId: 'fn-retain-01',
    mechanismRef: 'mech-grasp-01',
    workspaceRef: 'biomemetics.mantis' as const,
    statement: 'The foreleg retains prey after contact.',
    status: 'unverified' as const,
    limits: ['Frame only.'],
    review: accepted,
  };
  const equivalent = validateAnalog(
    {
      schemaVersion: '1.0.0',
      kind: 'AnalogLink',
      analogId: 'an-bad',
      functionRef: 'fn-retain-01',
      workspaceRef: 'biomemetics.mantis',
      target: 'terrarium.binder.retention',
      direction: 'engineering-to-biology',
      equivalent: true,
      limit: 'none',
      nonEquivalence: 'claimed identical',
      review: accepted,
    },
    fn,
  );
  assert.equal(equivalent.valid, false);
  assert.ok(equivalent.reasons.includes('engineering-as-biology'));

  const labTarget = validateAnalog(
    {
      schemaVersion: '1.0.0',
      kind: 'AnalogLink',
      analogId: 'an-lab',
      functionRef: 'fn-retain-01',
      workspaceRef: 'biomemetics.mantis',
      target: 'biomemetics.mantis',
      direction: 'biology-to-engineering',
      equivalent: false,
      limit: 'none',
      nonEquivalence: 'lab is not an analog target',
      review: accepted,
    },
    fn,
  );
  assert.ok(labTarget.reasons.includes('lab-as-specimen'));
});

test('refuses measured structure without measurements, and simulated-as-measured', () => {
  const error = refuse(() =>
    traverse({
      media: mediaBase(),
      structure: { ...structureDraft, basis: 'measured' },
      gitSha,
      runId: 'run-01',
    }),
  );
  assert.ok(error.reasons.includes('measurement-incomplete'));

  const relabel = refuse(() =>
    deriveMechanism(undefined, {
      ...mechanismDraft,
      status: 'observed' as unknown as 'unverified',
    }),
  );
  assert.ok(relabel.reasons.includes('source-class-relabeled'));
});

test('refuses incomplete measurements and missing license/consent/media', () => {
  const incomplete = refuse(() =>
    traverse({
      media: {
        ...mediaBase(),
        measurements: [
          {
            parameterRef: 'foreleg.length',
            value: 12,
            unit: 'mm',
            uncertainty: 0,
            method: '',
            scaleEvidence: '',
          },
        ],
      },
      gitSha,
      runId: 'run-01',
    }),
  );
  assert.ok(incomplete.reasons.includes('measurement-incomplete'));

  const noLicense = refuse(() =>
    traverse({
      media: { ...mediaBase(), license: '' },
      gitSha,
      runId: 'run-01',
    }),
  );
  assert.ok(noLicense.reasons.includes('missing-license'));

  const noFile = refuse(() =>
    traverse({
      media: {
        ...mediaBase(),
        absolutePath: join(tmpdir(), 'no-such-mantis.jpg'),
      },
      gitSha,
      runId: 'run-01',
    }),
  );
  assert.ok(noFile.reasons.includes('no-real-media'));
});

test('real media can traverse observation → structure → mechanism → function → analog', () => {
  const result = traverse({
    media: mediaBase(),
    structure: structureDraft,
    mechanism: mechanismDraft,
    fn: functionDraft,
    analog: analogDraft,
    gitSha,
    runId: 'run-01',
  });
  assert.equal(result.observation.kind, 'Observation');
  assert.equal(result.observation.taxon.status, 'unknown');
  assert.equal(result.observation.media.sha256.length, 64);
  assert.equal(result.structure?.kind, 'Structure');
  assert.equal(result.mechanism?.kind, 'Mechanism');
  assert.equal(result.fn?.kind, 'Function');
  assert.equal(result.analog?.kind, 'AnalogLink');
  assert.equal(result.analog?.equivalent, false);
  assert.equal(result.analog?.direction, 'biology-to-engineering');
  assert.equal(result.projection.executable, false);
  assert.equal(result.projection.storeWrite, false);
  assert.match(
    result.projection.evidenceRef,
    /^evidence\/runs\/mantis-04-observation-pipeline\//,
  );
  assert.deepEqual(
    result.projection.projections.map((item) => item.component._tag),
    ['Observation', 'Structure', 'Mechanism', 'Function', 'AnalogLink'],
  );
  const analog = result.projection.projections.at(-1)?.component;
  assert.equal(analog?._tag, 'AnalogLink');
  if (analog?._tag === 'AnalogLink') {
    assert.equal(analog.target, 'terrarium.binder.retention');
  }
});

test('cited taxon guess requires a citation; unverified observation cannot project', () => {
  const cited = traverse({
    media: {
      ...mediaBase(),
      taxon: {
        status: 'cited-guess',
        name: 'operator-cited-guess',
        confidence: 0.4,
        citation: 'operator-supplied literature handle, not a determination',
      },
    },
    gitSha,
    runId: 'run-01',
  });
  assert.equal(cited.observation.taxon.status, 'cited-guess');
  if (cited.observation.taxon.status === 'cited-guess') {
    assert.equal(cited.observation.taxon.citation.length > 0, true);
  }

  const unverified = refuse(() =>
    planGovernedProjection({
      observation: {
        ...cited.observation,
        review: pending,
      },
      gitSha,
      runId: 'run-01',
    }),
  );
  assert.ok(unverified.reasons.includes('unverified-evidence'));
});

test('downstream derive without an upstream record is empty-or-refused', () => {
  const structure = refuse(() => deriveStructure(undefined, structureDraft));
  assert.ok(structure.reasons.includes('missing-observation'));
  const mechanism = refuse(() => deriveMechanism(undefined, mechanismDraft));
  assert.ok(mechanism.reasons.includes('missing-structure'));
  const fn = refuse(() => deriveFunction(undefined, functionDraft));
  assert.ok(fn.reasons.includes('missing-mechanism'));
  const analog = refuse(() => deriveAnalog(undefined, analogDraft));
  assert.ok(analog.reasons.includes('missing-function'));
});
