import assert from 'node:assert/strict';
import test from 'node:test';

import { buildViewCassette, measureCassetteBox } from '../src/cassette.ts';
import { buildCornerBlock, buildCornerInstances, measureCornerBox } from '../src/corner.ts';
import { buildFrontDoor, measureDoorBox } from '../src/door.ts';
import { ENCLOSURE_PARAMS } from '../src/params.ts';

test('B01 corner is a 24 mm REF cube from frame.band', () => {
  const corner = buildCornerBlock();
  assert.equal(corner.kind, 'B01-corner-block');
  assert.equal(corner.bomId, 'B01');
  assert.equal(corner.printed, true);
  assert.equal(corner.metal, false);
  assert.deepEqual(corner.sizeMm, [24, 24, 24]);
  assert.deepEqual(measureCornerBox(corner.solid), [
    [0, 0, 0],
    [24, 24, 24],
  ]);
  assert.ok(corner.paramsRows.includes('frame.band'));
});

test('B01 has eight instances at exterior corners', () => {
  const instances = buildCornerInstances();
  assert.equal(instances.length, 8);
  assert.equal(instances[0]?.solidId, 'B01-corner-01');
  assert.deepEqual(instances[0]?.origin, [0, 0, 0]);
  assert.deepEqual(instances[7]?.origin, [226, 226, 476]);
  for (const instance of instances) {
    const [min, max] = measureCornerBox(instance.solid);
    assert.ok(min[0] >= 0 && min[1] >= 0 && min[2] >= 0);
    assert.ok(max[0] <= 250 && max[1] <= 250 && max[2] <= 500);
  }
  assert.equal(ENCLOSURE_PARAMS.pitch.value, ENCLOSURE_PARAMS.exterior.width.value);
  assert.equal(ENCLOSURE_PARAMS.firstSpan.value, ENCLOSURE_PARAMS.exterior.height.value);
});

test('B05 cassette is a 3.00 mm acrylic plate on calculated clear W x H', () => {
  const cassette = buildViewCassette();
  assert.equal(cassette.kind, 'B05-view-cassette');
  assert.equal(cassette.printed, false);
  assert.equal(cassette.metal, false);
  assert.equal(cassette.worldPlacement, 'unverified');
  assert.deepEqual(cassette.sizeMm, [202, 3, 427]);
  assert.deepEqual(measureCassetteBox(cassette.solid), [
    [0, 0, 0],
    [202, 3, 427],
  ]);
  assert.equal(ENCLOSURE_PARAMS.cassetteSeat.value, 3.2);
});

test('B06 door is a 3.00 mm acrylic plate on calculated clear W x H', () => {
  const door = buildFrontDoor();
  assert.equal(door.kind, 'B06-front-door');
  assert.equal(door.printed, false);
  assert.equal(door.metal, false);
  assert.equal(door.worldPlacement, 'unverified');
  assert.deepEqual(door.sizeMm, [202, 3, 427]);
  assert.deepEqual(measureDoorBox(door.solid), [
    [0, 0, 0],
    [202, 3, 427],
  ]);
});
