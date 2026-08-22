import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { openHierarchy } from '../src/hierarchy.ts';
import { interpretationYield } from '../src/types.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const datasets = path.resolve(here, '../evals/datasets');

test('delegation reject dataset', () => {
  const hierarchy = openHierarchy({ clock: { now: () => '2026-08-21T00:00:00.000Z' } });
  const dataset = JSON.parse(
    readFileSync(path.join(datasets, 'delegation-reject.json'), 'utf8'),
  ) as {
    cases: Array<{ id: string; input: unknown; reason: string }>;
  };
  for (const row of dataset.cases) {
    const attempt = hierarchy.delegate(row.input);
    assert.equal(attempt.state, 'rejected', row.id);
    if (attempt.state !== 'rejected') continue;
    assert.ok(attempt.reasons.includes(row.reason as never), row.id);
  }
});

test('om supersession dataset', () => {
  const hierarchy = openHierarchy({ clock: { now: () => '2026-08-21T00:00:00.000Z' } });
  const dataset = JSON.parse(
    readFileSync(path.join(datasets, 'om-supersession.json'), 'utf8'),
  ) as {
    threadId: string;
    first: { kind: 'conversation-observation'; text: string };
    correction: {
      kind: 'canonical-correction';
      text: string;
      canonicalRef: { kind: 'CareEvent'; id: string };
    };
  };
  const first = hierarchy.remember({ threadId: dataset.threadId, ...dataset.first });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const correction = hierarchy.remember({
    threadId: dataset.threadId,
    ...dataset.correction,
    supersedes: [first.record.recordId],
  });
  assert.equal(correction.ok, true);
  const view = hierarchy.recall({ threadId: dataset.threadId, preferCanonical: true });
  assert.equal(view.records.find((row) => row.recordId === first.record.recordId)?.state, 'superseded');
});

test('yield separation dataset', () => {
  const dataset = JSON.parse(
    readFileSync(path.join(datasets, 'yield-separation.json'), 'utf8'),
  ) as { taxon: { confirmed: boolean } };
  const yielded = interpretationYield({
    status: 'hypothetical',
    claims: [{ kind: 'taxon-rank', text: 'Mantodea', confidence: 0.2 }],
  });
  assert.equal(yielded.claims[0]?.confirmed, dataset.taxon.confirmed);
  assert.equal(yielded.kind, 'interpretation');
});
