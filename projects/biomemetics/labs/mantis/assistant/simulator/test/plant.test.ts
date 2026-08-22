import assert from 'node:assert/strict';
import test from 'node:test';

import { explain } from '../src/explain.ts';
import { loadCatalog, loadPlant } from '../src/fixtures.ts';
import { inject, injectFault, injectStale } from '../src/inject.ts';
import { assertLegal, deriveVideo, interlocksFor, TRANSITIONS } from '../src/rail.ts';
import { paints } from '../src/cli-format.ts';
import { FailClosedError, CHANNEL, EPOCH_MS } from '../src/types.ts';
import { view } from '../src/view.ts';

test('frozen epoch matches 2026-08-22T00:00:00.000Z', () => {
  assert.equal(EPOCH_MS, Date.parse('2026-08-22T00:00:00.000Z'));
});

test('catalog is simulated and lists the five honesty fixtures', () => {
  const catalog = loadCatalog();
  assert.equal(catalog.sourceClass, 'simulated');
  assert.deepEqual(
    catalog.entries.map((entry) => entry.id),
    ['known-fresh', 'stale-sample', 'simulated-model', 'fault-pinch', 'unavailable-channels'],
  );
});

test('known-fresh paints known sensor channels and simulated model illuminance', () => {
  const painted = view(loadPlant('known-fresh'));
  assert.equal(painted.sourceClass, 'simulated');
  assert.equal(painted.banner, 'SIMULATED PLANT');
  assert.equal(painted.phase, 'link-trained');
  assert.equal(painted.video.kind, 'available');
  assert.equal(painted.video.stream, 'none');
  assert.equal(paints(painted)[CHANNEL.dryBulb], 'known');
  assert.equal(paints(painted)[CHANNEL.humidity], 'known');
  assert.equal(paints(painted)[CHANNEL.illuminance], 'simulated');
  assert.equal(paints(painted)[CHANNEL.branchVoltage], 'known');
});

test('stale-sample paints dry-bulb stale without promoting it to known', () => {
  const painted = view(loadPlant('stale-sample'));
  assert.equal(paints(painted)[CHANNEL.dryBulb], 'stale');
  assert.equal(painted.sourceClass, 'simulated');
  assert.equal(painted.video.kind, 'available');
});

test('fault-pinch mutes video and paints branch voltage faulted', () => {
  const painted = view(loadPlant('fault-pinch'));
  assert.equal(painted.phase, 'pinch-safe');
  assert.equal(painted.video.kind, 'unavailable');
  if (painted.video.kind !== 'unavailable') throw new Error('expected mute');
  assert.equal(painted.video.reason, 'pinch');
  assert.equal(paints(painted)[CHANNEL.branchVoltage], 'faulted');
  assert.equal(painted.interlocks.s1.kind, 'open');
  assert.equal(painted.interlocks.q1.kind, 'discharging');
});

test('unavailable-channels paints missing humidity and illuminance', () => {
  const painted = view(loadPlant('unavailable-channels'));
  assert.equal(painted.phase, 'mechanically-seated');
  assert.equal(painted.video.kind, 'unavailable');
  assert.equal(paints(painted)[CHANNEL.humidity], 'unavailable');
  assert.equal(paints(painted)[CHANNEL.illuminance], 'unavailable');
});

test('inject stale ages a known channel', () => {
  const painted = view(injectStale(loadPlant('known-fresh'), CHANNEL.dryBulb));
  assert.equal(paints(painted)[CHANNEL.dryBulb], 'stale');
  assert.equal(paints(painted)[CHANNEL.humidity], 'known');
});

test('inject pinch from link-trained mutes video immediately', () => {
  const painted = view(injectFault(loadPlant('known-fresh'), 'pinch'));
  assert.equal(painted.phase, 'pinch-safe');
  assert.equal(painted.video.kind, 'unavailable');
  if (painted.video.kind !== 'unavailable') throw new Error('expected mute');
  assert.equal(painted.video.reason, 'pinch');
  assert.equal(paints(painted)[CHANNEL.branchVoltage], 'faulted');
});

test('S1 open, S2 open, Q1 off, contact loss, and link loss mute video', () => {
  const fromKnown = loadPlant('known-fresh');
  for (const fault of ['s1-open', 's2-open', 'q1-off', 'contact-ambiguous', 'link-loss'] as const) {
    const painted = view(injectFault(fromKnown, fault));
    assert.equal(painted.video.kind, 'unavailable', fault);
    assert.notEqual(painted.phase, 'link-trained', fault);
  }
});

test('explanations quote receipt numbers and do not invent GPS or taxon', () => {
  const text = explain(view(loadPlant('known-fresh'))).sentences.join('\n');
  assert.match(text, /24/);
  assert.match(text, /rec\.air\.dry-bulb\.known/);
  assert.match(text, /cal\.sim\.a4a-unverified/);
  assert.equal(/gps|taxon|specimen/i.test(text), false);
});

test('Q1 cannot energize with S1 open', () => {
  assert.throws(
    () =>
      assertLegal({
        phase: 'link-trained',
        interlocks: {
          s1: { kind: 'open' },
          s2: { kind: 'closed' },
          q1: { kind: 'on' },
        },
        contact: 'seated',
      }),
    /Q1 cannot energize/,
  );
});

test('deriveVideo admits availability only at link-trained with mates closed and Q1 on', () => {
  const video = deriveVideo({
    phase: 'link-trained',
    interlocks: interlocksFor('link-trained'),
    contact: 'seated',
  });
  assert.equal(video.kind, 'available');
  assert.equal(video.stream, 'none');
});

test('step refuses an illegal transition instead of actuating', () => {
  assert.throws(
    () => inject(loadPlant('known-fresh'), { type: 'step', transitionId: 't01-seat' as never }),
    FailClosedError,
  );
});

test('transition table covers the locked machine', () => {
  assert.equal(TRANSITIONS.length, 11);
});
