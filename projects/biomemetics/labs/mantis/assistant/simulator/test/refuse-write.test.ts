import assert from 'node:assert/strict';
import test from 'node:test';

import { FailClosedError } from '../src/types.ts';
import { refuseWrite, WRITE_KEYS } from '../src/refuse-write.ts';

test('refuseWrite throws on command-shaped keys', () => {
  for (const key of ['command', 'actuate', 'setpoint', 'railMove', 'enable-q1', 'binder-release']) {
    assert.throws(() => refuseWrite({ [key]: true }), FailClosedError, key);
  }
});

test('refuseWrite allows a read fixture id', () => {
  refuseWrite({ fixtureId: 'known-fresh' });
});

test('write-key catalog is non-empty', () => {
  assert.ok(WRITE_KEYS.length > 5);
});
