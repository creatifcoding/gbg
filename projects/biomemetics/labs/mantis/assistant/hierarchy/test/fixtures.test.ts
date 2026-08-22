import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { openHierarchy } from '../src/hierarchy.ts';
import { parseManifest } from '../src/specialist.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '../fixtures');

test('negative forked fixture fails parse', () => {
  const raw = JSON.parse(readFileSync(path.join(fixtures, 'negative/forked-true.json'), 'utf8'));
  const parsed = parseManifest(raw);
  assert.equal(parsed.ok, false);
});

test('negative om-as-observed fixture fails remember', () => {
  const hierarchy = openHierarchy();
  const raw = JSON.parse(readFileSync(path.join(fixtures, 'negative/om-as-observed.json'), 'utf8'));
  const result = hierarchy.remember(raw);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.includes('om-record-class'));
});

test('positive care-source fixture dry-runs', () => {
  const hierarchy = openHierarchy();
  const raw = JSON.parse(
    readFileSync(path.join(fixtures, 'positive/care-source-delegate.json'), 'utf8'),
  );
  const attempt = hierarchy.delegate(raw);
  assert.equal(attempt.state, 'completed');
});
