import assert from 'node:assert/strict';
import test from 'node:test';

import { ADMITTED_BALLOON_IDS, BALLOONS } from '../src/balloons.ts';
import { compileIndexedCoupon } from '../src/board.ts';
import { BRANCH_ENABLE, RAIL_CONTACTS, tscircuitTokenFor } from '../src/nets.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const elementType = (element: unknown): string => {
  if (!isRecord(element) || typeof element.type !== 'string') {
    return '';
  }
  return element.type;
};

const elementName = (element: unknown): string => {
  if (!isRecord(element)) {
    return '';
  }
  if (typeof element.name === 'string') {
    return element.name;
  }
  return '';
};

const manufacturerPartNumber = (element: unknown): string | undefined => {
  if (!isRecord(element)) {
    return undefined;
  }
  if (typeof element.manufacturer_part_number === 'string') {
    return element.manufacturer_part_number;
  }
  if (typeof element.manufacturerPartNumber === 'string') {
    return element.manufacturerPartNumber;
  }
  return undefined;
};

const collectedText = (element: unknown): string => {
  if (!isRecord(element)) {
    return '';
  }
  return JSON.stringify(element);
};

test('compiles indexed coupon through @tscircuit/core', () => {
  const coupon = compileIndexedCoupon();
  assert.equal(coupon.kind, 'indexed-coupon');
  assert.equal(coupon.maturity, 'draft');
  assert.ok(Array.isArray(coupon.circuitJson));
  assert.ok(coupon.circuitJson.length > 0);
  assert.ok(
    coupon.circuitJson.some((element) => elementType(element).includes('board')),
    'circuit JSON must contain a board',
  );
});

test('admitted balloon IDs are present and no others', () => {
  const coupon = compileIndexedCoupon();
  const balloonIds = coupon.balloons.map((balloon) => balloon.id);
  assert.deepEqual(balloonIds, [...ADMITTED_BALLOON_IDS]);
  const admitted = new Set<string>(ADMITTED_BALLOON_IDS);
  for (const balloon of BALLOONS) {
    assert.ok(admitted.has(balloon.id), balloon.id);
    assert.equal(balloon.manufacturerPartNumber, '');
  }
  const jsonText = JSON.stringify(coupon.circuitJson);
  for (const id of ['B27', 'B44', 'B48', 'B50']) {
    assert.ok(jsonText.includes(id), id);
  }
  assert.ok(coupon.balloons.some((balloon) => balloon.id === 'B19'));
  assert.equal(coupon.b19.pads, 'omitted');
  assert.equal(coupon.outline.status, 'unverified');
  const forbidden = ['B36', 'B42', 'B43', 'B45', 'B46', 'B47', 'B49'];
  for (const id of forbidden) {
    assert.equal(
      coupon.balloons.some((balloon) => balloon.id === id),
      false,
      id,
    );
  }
});

test('every component manufacturerPartNumber is blank or missing', () => {
  const coupon = compileIndexedCoupon();
  for (const element of coupon.circuitJson) {
    const mpn = manufacturerPartNumber(element);
    if (mpn !== undefined) {
      assert.equal(mpn, '', `${elementName(element)} manufacturerPartNumber`);
    }
  }
});

test('P01-P12 net names exist', () => {
  const coupon = compileIndexedCoupon();
  assert.equal(coupon.railContacts.length, 12);
  const jsonText = coupon.circuitJson.map(collectedText).join('\n');
  for (const contact of RAIL_CONTACTS) {
    assert.equal(coupon.railContacts[RAIL_CONTACTS.indexOf(contact)]?.pin, contact.pin);
    assert.equal(coupon.railContacts[RAIL_CONTACTS.indexOf(contact)]?.net, contact.net);
    assert.ok(jsonText.includes(contact.pin), contact.pin);
    assert.ok(jsonText.includes(tscircuitTokenFor(contact.net)), tscircuitTokenFor(contact.net));
    const alias = coupon.netAliases.find((entry) => entry.net === contact.net);
    assert.ok(alias, contact.net);
    assert.equal(alias.tscircuitToken, tscircuitTokenFor(contact.net));
  }
});

test('branch enable is S1 AND S2 and P08 is not safety', () => {
  const coupon = compileIndexedCoupon();
  assert.equal(coupon.branchEnable.expression, 'S1 AND S2');
  assert.equal(coupon.branchEnable.kind, 's1-and-s2');
  assert.equal(coupon.branchEnable.p08SafetyAuthority, false);
  assert.equal(BRANCH_ENABLE.expression, 'S1 AND S2');
  const jsonText = JSON.stringify(coupon.circuitJson);
  assert.ok(jsonText.includes('S1'));
  assert.ok(jsonText.includes('S2'));
  assert.ok(jsonText.includes('Q1'));
});
