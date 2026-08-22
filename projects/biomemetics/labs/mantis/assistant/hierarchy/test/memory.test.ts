import assert from 'node:assert/strict';
import test from 'node:test';

import { openHierarchy } from '../src/hierarchy.ts';

const clock = { now: () => '2026-08-21T00:00:00.000Z' };
const threadId = 'care:fixture-cup-01:conversation-01';

test('remember stamps assistant-memory and redacts secrets', () => {
  const hierarchy = openHierarchy({ clock });
  const result = hierarchy.remember({
    threadId,
    kind: 'conversation-observation',
    text: 'Keeper asked about feeding. Token sk-live-fixture-not-a-secret',
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.record.recordClass, 'assistant-memory');
  assert.equal(result.record.text.includes('sk-live-fixture-not-a-secret'), false);
  assert.ok(result.record.text.includes('[redacted-token]'));
});

test('observed record class is refused', () => {
  const hierarchy = openHierarchy({ clock });
  const result = hierarchy.remember({
    threadId,
    kind: 'conversation-observation',
    text: 'visible green insect',
    recordClass: 'observed',
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.includes('om-record-class'));
});

test('canonical correction supersedes without rewriting the old sentence', () => {
  const hierarchy = openHierarchy({ clock });
  const first = hierarchy.remember({
    threadId,
    kind: 'conversation-observation',
    text: 'Feeding was logged.',
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const original = first.record.text;
  const correction = hierarchy.remember({
    threadId,
    kind: 'canonical-correction',
    text: 'Feeding was not logged. Offer remains unconfirmed.',
    canonicalRef: { kind: 'CareEvent', id: 'event.fixture-offer-01' },
    supersedes: [first.record.recordId],
  });
  assert.equal(correction.ok, true);
  if (!correction.ok) return;
  const view = hierarchy.recall({ threadId, preferCanonical: true });
  const prior = view.records.find((row) => row.recordId === first.record.recordId);
  assert.equal(prior?.state, 'superseded');
  assert.equal(prior?.text, original);
  assert.equal(view.records[0]?.kind, 'canonical-correction');
});

test('rewrite flag is refused', () => {
  const hierarchy = openHierarchy({ clock });
  const result = hierarchy.remember({
    threadId,
    kind: 'canonical-correction',
    text: 'overwrite the old row',
    rewrite: true,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.reasons.includes('canonical-rewrite'));
});

test('forget tombstones text on export', () => {
  const hierarchy = openHierarchy({ clock });
  const stored = hierarchy.remember({
    threadId,
    kind: 'conversation-observation',
    text: 'temporary note',
  });
  assert.equal(stored.ok, true);
  if (!stored.ok) return;
  hierarchy.forget({ threadId, recordId: stored.record.recordId });
  const exported = hierarchy.exportThread(threadId);
  const row = exported.records.find((item) => item.recordId === stored.record.recordId);
  assert.equal(row?.state, 'deleted');
  assert.equal('text' in (row ?? {}), false);
});

test('working memory is only the three fields', () => {
  const hierarchy = openHierarchy({ clock });
  const result = hierarchy.remember({
    threadId,
    kind: 'working-memory',
    text: 'slot update',
    working: {
      preferences: ['metric units'],
      activeGoal: 'establish temporary housing',
      unresolvedQuestions: ['life stage unknown'],
    },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.working, {
    preferences: ['metric units'],
    activeGoal: 'establish temporary housing',
    unresolvedQuestions: ['life stage unknown'],
  });
});
