import assert from 'node:assert/strict';
import test from 'node:test';

import { openLaboratory } from '../src/laboratory.ts';
import { pins } from '../src/pins.ts';

test('catalog cases match expect', async () => {
  const lab = await openLaboratory();
  assert.equal(lab.pins.mastraCore, pins.mastraCore);
  const report = await lab.runCatalog();
  assert.ok(report.cases.length >= 10, JSON.stringify(report, null, 2));
  assert.equal(report.ok, true, JSON.stringify(report.cases.filter((row) => !row.ok), null, 2));
  const admitted = report.cases.filter((row) => row.expect === 'admit' && row.ok);
  assert.equal(admitted.length, 5);
});
