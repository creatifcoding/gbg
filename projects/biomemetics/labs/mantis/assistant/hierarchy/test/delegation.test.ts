import assert from 'node:assert/strict';
import test from 'node:test';

import { openHierarchy } from '../src/hierarchy.ts';

const clock = { now: () => '2026-08-21T00:00:00.000Z' };

const base = {
  threadId: 'care:fixture-cup-01:conversation-01',
  careSubjectId: 'care.fixture-cup-01',
  goal: 'source feeding advice for the cup',
  transcriptExcerpt: 'small mantis in a cup. User lives at 123 Maple Street.',
};

test('care-source dry-run builds a minimum packet and redacts address', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'care-source',
    mode: 'care',
    sourceStatus: 'reviewed-source',
    correlationIds: ['run.fixture-a2-01'],
  });
  assert.equal(attempt.state, 'completed');
  if (attempt.state !== 'completed') return;
  assert.equal(attempt.yield.kind, 'policy-dry-run');
  assert.equal(attempt.packet.context.notes.includes('123 Maple Street'), false);
  assert.ok(attempt.packet.context.notes.includes('[redacted-address]'));
  assert.equal('targetMode' in attempt.packet, false);
  assert.equal('forked' in attempt.packet, false);
  assert.deepEqual(attempt.packet.allowedTools, hierarchy.registry['care-source'].tools);
});

test('same request digest is idempotent', () => {
  const hierarchy = openHierarchy({ clock });
  const request = { ...base, specialist: 'care-source', mode: 'care' };
  const first = hierarchy.delegate(request);
  const second = hierarchy.delegate(request);
  assert.equal(first.attemptId, second.attemptId);
  assert.equal(first.state, second.state);
});

test('terrarium-diagnostician is unavailable in care', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'terrarium-diagnostician',
    mode: 'care',
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('specialist-unavailable-in-mode'));
});

test('forked true rejects', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'care-source',
    mode: 'care',
    forked: true,
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('forked-prohibited'));
});

test('targetMode is privilege escalation', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'care-source',
    mode: 'care',
    targetMode: 'review',
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('privilege-escalation'));
});

test('device-command on the request rejects', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'care-source',
    mode: 'care',
    tools: ['device-command'],
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('forbidden-tool'));
});

test('tool-assessor cannot admit', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'tool-assessor',
    mode: 'review',
    admit: true,
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('self-review'));
});

test('evidence-curator cannot accept', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'evidence-curator',
    mode: 'review',
    accept: true,
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('self-review'));
});

test('confirmed taxon rejects', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'taxon-hypothesis',
    mode: 'research',
    confirmed: true,
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('confirmed-taxon'));
});

test('specimen mint rejects', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'taxon-hypothesis',
    mode: 'research',
    specimenId: 'sp.invented-01',
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('specimen-mint'));
});

test('fake locality rejects', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'supply-transit',
    mode: 'care',
    locality: 'invented-place',
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('fake-locality'));
});

test('undeclared tool rejects', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({
    ...base,
    specialist: 'care-source',
    mode: 'care',
    tools: ['supply-transit-read'],
  });
  assert.equal(attempt.state, 'rejected');
  if (attempt.state !== 'rejected') return;
  assert.ok(attempt.reasons.includes('undeclared-tool'));
});

test('cancel of a completed attempt is idempotent', () => {
  const hierarchy = openHierarchy({ clock });
  const attempt = hierarchy.delegate({ ...base, specialist: 'care-source', mode: 'care' });
  const cancelled = hierarchy.cancel(attempt.attemptId);
  assert.equal(cancelled.state, 'completed');
  assert.equal(cancelled.attemptId, attempt.attemptId);
});
