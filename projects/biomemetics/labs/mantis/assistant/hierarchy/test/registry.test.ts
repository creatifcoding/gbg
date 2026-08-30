import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { openHierarchy } from '../src/hierarchy.ts';
import { parseManifest } from '../src/specialist.ts';
import {
  FORBIDDEN_TOOL_IDS,
  SPECIALIST_IDS,
  interpretationYield,
} from '../src/types.ts';
import { manifestsDir } from '../src/paths.ts';

test('nine manifests load with forked false and no forbidden tools', () => {
  const hierarchy = openHierarchy({ clock: { now: () => '2026-08-21T00:00:00.000Z' } });
  for (const id of SPECIALIST_IDS) {
    const row = hierarchy.registry[id];
    assert.equal(row.forked, false);
    assert.equal(row.id, id);
    for (const tool of row.tools) {
      assert.equal((FORBIDDEN_TOOL_IDS as readonly string[]).includes(tool), false);
    }
  }
  assert.equal(Object.keys(hierarchy.registry).length, 9);
});

test('forked true cannot load', () => {
  const raw = JSON.parse(
    readFileSync(path.join(manifestsDir, 'care-source.json'), 'utf8'),
  ) as Record<string, unknown>;
  raw.forked = true;
  const parsed = parseManifest(raw);
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.ok(parsed.reasons.includes('forked-prohibited'));
});

test('device-command cannot inhabit a loaded tool list', () => {
  const raw = JSON.parse(
    readFileSync(path.join(manifestsDir, 'care-source.json'), 'utf8'),
  ) as Record<string, unknown>;
  raw.tools = ['device-command'];
  const parsed = parseManifest(raw);
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.ok(parsed.reasons.includes('forbidden-tool'));
});

test('interpretation yield forces confirmed false', () => {
  const yielded = interpretationYield({
    status: 'hypothetical',
    claims: [{ kind: 'taxon-rank', text: 'Mantodea', confidence: 0.4 }],
  });
  assert.equal(yielded.kind, 'interpretation');
  assert.equal(yielded.recordClass, 'interpretation');
  assert.equal(yielded.claims[0]?.confirmed, false);
});
