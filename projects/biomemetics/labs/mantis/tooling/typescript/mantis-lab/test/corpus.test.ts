import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  EVIDENCE_SCHEMA_PATH,
  EVIDENCE_SCHEMA_SHA256,
  loadEvidenceRuntimeValidator,
} from '../src/evidence-validator.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, '../../../..');

const runPythonCorpus = () => {
  const result = spawnSync(
    'python3',
    ['-m', 'mantis_lab.cli', '--workspace', workspace, 'run-corpus'],
    {
      env: {
        ...process.env,
        PYTHONPATH: path.join(workspace, 'tooling/python/mantis-lab/src'),
      },
      encoding: 'utf8',
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as {
    ok: boolean;
    results: Array<{ id: string; expect: string; matched: boolean }>;
  };
};

test('Draft 2020-12 corpus matches Python outcomes', () => {
  const report = runPythonCorpus();
  assert.equal(report.ok, true);
  assert.ok(report.results.length >= 7);
  for (const entry of report.results) {
    assert.equal(entry.matched, true, entry.id);
  }
});

test('evidence schema digest pin matches contracts file', () => {
  const raw = readFileSync(path.join(workspace, EVIDENCE_SCHEMA_PATH));
  const digest = createHash('sha256').update(raw).digest('hex');
  assert.equal(digest, EVIDENCE_SCHEMA_SHA256);
});

test('runtime validator accepts digested URI artifacts and bound admissions', () => {
  const validator = loadEvidenceRuntimeValidator();
  const positive = JSON.parse(
    readFileSync(
      path.join(
        workspace,
        'evidence/fixtures/corpus/positive/evidence-measured.json',
      ),
      'utf8',
    ),
  );
  const ok = validator.validate(positive);
  assert.equal(ok.valid, true);

  const negative = JSON.parse(
    readFileSync(
      path.join(
        workspace,
        'evidence/fixtures/corpus/negative/evidence-uri-no-digest.json',
      ),
      'utf8',
    ),
  );
  const bad = validator.validate(negative);
  assert.equal(bad.valid, false);
  assert.ok(
    bad.valid === false &&
      bad.errors.some((error) => error.includes('sha256') || error.includes('claimRef')),
  );
});

test('caller prose cannot inherit projection provenance', () => {
  const validator = loadEvidenceRuntimeValidator();
  const positive = JSON.parse(
    readFileSync(
      path.join(
        workspace,
        'evidence/fixtures/corpus/positive/evidence-measured.json',
      ),
      'utf8',
    ),
  );
  positive.admissions[0].projectionBinding.admissionText = 'unrelated caller prose';
  const bad = validator.validate(positive);
  assert.equal(bad.valid, false);
});
