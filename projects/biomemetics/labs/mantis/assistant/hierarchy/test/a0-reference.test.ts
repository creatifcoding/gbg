import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { loadPinSnapshot } from '../src/a0-pin.ts';
import { openHierarchy } from '../src/hierarchy.ts';
import { importedA0Dir } from '../src/paths.ts';
import { SPECIALIST_IDS } from '../src/types.ts';

test('imported-a0 specialist list matches the registry', () => {
  const constraints = JSON.parse(
    readFileSync(path.join(importedA0Dir, 'subagent-constraints.json'), 'utf8'),
  ) as { specialists: string[] };
  assert.deepEqual(constraints.specialists, [...SPECIALIST_IDS]);
  const hierarchy = openHierarchy();
  assert.deepEqual(Object.keys(hierarchy.registry), [...SPECIALIST_IDS]);
});

test('pin snapshot records quarantined observer/reflector', () => {
  const pin = loadPinSnapshot();
  const source = readFileSync(path.join(importedA0Dir, 'SOURCE.txt'), 'utf8');
  assert.equal(pin.sha, 'a02d73e8f340b672a3ca057945cdbea01f90cac5');
  assert.ok(source.includes(pin.sha));
  assert.equal(pin.omLiveObserverReflector, 'QUARANTINED_UPSTREAM');
  const hierarchy = openHierarchy();
  const om = hierarchy.capabilities.find((row) => row.id === 'thread-om-live-observer-reflector');
  assert.equal(om?.status, 'QUARANTINED_UPSTREAM');
});

test('this package does not require a CopilotKit runtimeUrl', () => {
  const hierarchy = openHierarchy();
  assert.equal('runtimeUrl' in hierarchy, false);
});
