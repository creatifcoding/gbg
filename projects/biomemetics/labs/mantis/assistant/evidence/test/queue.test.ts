import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  adversarialReviewer,
  createEvidenceQueue,
  curator,
  governedReviewer,
  type EvidenceQueue,
  type GovernedReviewer,
  type PacketId,
} from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

const loadJson = (relative: string): unknown =>
  JSON.parse(readFileSync(path.join(here, relative), 'utf8'));

const author = curator('curator@lab');
const reviewer = governedReviewer('reviewer@lab');
const attacker = adversarialReviewer('red-team@lab');
const clock = { now: () => '2026-08-21T00:00:00Z' };

const measuredRecord = (): unknown =>
  loadJson('../fixtures/positive/accepted-measured.json');

const intake = (origin: string, record: unknown): unknown => ({ origin, record });

const queue = (): EvidenceQueue =>
  createEvidenceQueue({ queueId: 'mantis-a5', clock });

const advanceToPending = (
  q: EvidenceQueue,
  record: unknown = measuredRecord(),
  origin = 'canonical-record',
): PacketId => {
  const drafted = q.enqueueDraft(author, intake(origin, record));
  assert.equal(drafted.ok, true);
  if (drafted.ok !== true) throw new TypeError('expected draft');
  const closed = q.validate(drafted.packet.packetId);
  assert.equal(closed.ok, true);
  if (closed.ok !== true) throw new TypeError('expected validated');
  const submitted = q.submit(closed.packet.packetId, author);
  assert.equal(submitted.ok, true);
  if (submitted.ok !== true) throw new TypeError('expected pending-review');
  return submitted.packet.packetId;
};

test('curator drafts a measured record; independent reviewer accepts it', () => {
  const q = queue();
  const packetId = advanceToPending(q);
  const flagged = q.flagDefect(packetId, attacker, 'measurement sampleCount is 1');
  assert.equal(flagged.ok, true);
  if (flagged.ok === true) {
    assert.equal(flagged.packet.state, 'pending-review');
    assert.equal(flagged.packet.defects.length, 1);
  }
  const accepted = q.accept(packetId, reviewer);
  assert.equal(accepted.ok, true);
  if (accepted.ok !== true) return;
  assert.equal(accepted.packet.state, 'accepted');
  assert.equal(accepted.packet.reviewer.actorId, 'reviewer@lab');
  assert.equal(accepted.packet.record.review.status, 'accepted');
  assert.equal(accepted.packet.record.review.reviewer, 'reviewer@lab');
  const admission = accepted.packet.record.admissions?.[0];
  assert.equal(admission?.text, 'Coupon exposes twelve contacts.');
  assert.equal(admission?.projectionBinding?.admissionText, admission?.text);
  const again = q.accept(packetId, reviewer);
  assert.equal(again.ok, true);
  if (again.ok === true) {
    assert.equal(again.packet.record.review.reviewedAt, '2026-08-21T00:00:00Z');
  }
});

test('incoming accepted review is discarded so fixtures cannot self-admit', () => {
  const q = queue();
  const drafted = q.enqueueDraft(author, intake('canonical-record', measuredRecord()));
  assert.equal(drafted.ok, true);
  if (drafted.ok !== true) return;
  assert.equal(drafted.packet.state, 'draft');
  const record = drafted.packet.record as { review: { status: string } };
  assert.equal(record.review.status, 'pending');
  const closed = q.validate(drafted.packet.packetId);
  assert.equal(closed.ok, true);
});

test('curator cannot accept; same actorId as author is reviewer-is-author', () => {
  const q = queue();
  const packetId = advanceToPending(q);
  const asReviewer = author as unknown as GovernedReviewer;
  const attempt = q.accept(packetId, asReviewer);
  assert.equal(attempt.ok, false);
  if (attempt.ok === false) {
    assert.ok(
      attempt.reasons.includes('curator-cannot-accept') ||
        attempt.reasons.includes('reviewer-is-author'),
    );
  }
  assert.equal(q.get(packetId)?.state, 'pending-review');
});

test('governed reviewer whose actorId equals the author is refused', () => {
  const q = queue();
  const same = governedReviewer('curator@lab');
  const packetId = advanceToPending(q);
  const attempt = q.accept(packetId, same);
  assert.equal(attempt.ok, false);
  if (attempt.ok === false) {
    assert.ok(attempt.reasons.includes('reviewer-is-author'));
  }
});

test('adversarial reviewer cannot accept and flagDefect does not admit', () => {
  const q = queue();
  const packetId = advanceToPending(q);
  const asReviewer = attacker as unknown as GovernedReviewer;
  const attempt = q.accept(packetId, asReviewer);
  assert.equal(attempt.ok, false);
  if (attempt.ok === false) {
    assert.ok(attempt.reasons.includes('adversarial-cannot-accept'));
  }
  const flagged = q.flagDefect(packetId, attacker, 'thin admission');
  assert.equal(flagged.ok, true);
  assert.equal(q.get(packetId)?.state, 'pending-review');
});

test('OM, chat, recommendation, telemetry, and taxon hypothesis never become packets', () => {
  const q = queue();
  const cases = [
    ['observational-memory', '../fixtures/negative/om.json'],
    ['chat', '../fixtures/negative/chat.json'],
    ['recommendation', '../fixtures/negative/recommendation.json'],
    ['raw-telemetry', '../fixtures/negative/raw-telemetry.json'],
    ['taxon-hypothesis', '../fixtures/negative/taxon-hypothesis.json'],
    ['photo-only-taxon', '../fixtures/negative/photo-only-taxon.json'],
    ['photo-only-location', '../fixtures/negative/photo-only-location.json'],
  ] as const;
  for (const [origin, file] of cases) {
    const loaded = loadJson(file);
    const input = origin === 'observational-memory' ? loaded : intake(origin, loaded);
    const result = q.enqueueDraft(author, input);
    assert.equal(result.ok, false, origin);
    if (result.ok === false && 'reasons' in result) {
      assert.ok(
        result.reasons.some((reason) =>
          String(reason).includes(`origin-inadmissible:${origin}`),
        ),
        origin,
      );
    }
  }
  assert.equal(q.list().length, 0);
});

test('canonical record that smuggles locality keys is refused at intake', () => {
  const q = queue();
  const result = q.enqueueDraft(author, loadJson('../fixtures/negative/invented-locality.json'));
  assert.equal(result.ok, false);
  if (result.ok === false) {
    const reasons: readonly string[] = result.reasons;
    assert.ok(reasons.includes('taxon-or-locality-keys-present'));
  }
});

test('claim-unbound is refused at validate', () => {
  const q = queue();
  const drafted = q.enqueueDraft(
    author,
    intake('canonical-record', loadJson('../fixtures/negative/claim-unbound.json')),
  );
  assert.equal(drafted.ok, true);
  if (drafted.ok !== true) return;
  const closed = q.validate(drafted.packet.packetId);
  assert.equal(closed.ok, false);
  if (closed.ok === false) {
    assert.ok(closed.reasons.includes('claim-unbound'));
  }
});

test('digest-missing is refused at validate', () => {
  const q = queue();
  const drafted = q.enqueueDraft(
    author,
    intake('canonical-record', loadJson('../fixtures/negative/digest-missing.json')),
  );
  assert.equal(drafted.ok, true);
  if (drafted.ok !== true) return;
  const closed = q.validate(drafted.packet.packetId);
  assert.equal(closed.ok, false);
  if (closed.ok === false) {
    assert.ok(closed.reasons.includes('digest-missing'));
  }
});

test('reject and retainInconclusive are terminal and stay in the queue', () => {
  const q = queue();
  const rejectedId = advanceToPending(
    q,
    loadJson('../fixtures/negative/rejected.json'),
  );
  const rejected = q.reject(rejectedId, reviewer);
  assert.equal(rejected.ok, true);
  if (rejected.ok === true) {
    assert.equal(rejected.packet.state, 'rejected');
  }
  assert.equal(q.get(rejectedId)?.state, 'rejected');
  assert.equal(q.accept(rejectedId, reviewer).ok, false);

  const inconclusiveId = advanceToPending(
    q,
    loadJson('../fixtures/negative/inconclusive.json'),
  );
  const accepted = q.accept(inconclusiveId, reviewer);
  assert.equal(accepted.ok, false);
  if (accepted.ok === false) {
    assert.ok(accepted.reasons.includes('disposition-not-supportable'));
  }
  const retained = q.retainInconclusive(inconclusiveId, reviewer);
  assert.equal(retained.ok, true);
  if (retained.ok === true) {
    assert.equal(retained.packet.state, 'retained-inconclusive');
    assert.equal(retained.packet.record.review.status, 'pending');
  }
});

test('simulated source class cannot be accepted for projection', () => {
  const measured = measuredRecord() as Record<string, unknown>;
  const simulated = {
    ...measured,
    evidenceId: 'fixture-simulated',
    sourceClass: 'simulated',
    inputs: [{ ref: 'model://sim', role: 'source' }],
  };
  const q = queue();
  const packetId = advanceToPending(q, simulated);
  const attempt = q.accept(packetId, reviewer);
  assert.equal(attempt.ok, false);
  if (attempt.ok === false) {
    assert.ok(attempt.reasons.includes('source-class-not-projectable'));
  }
});

test('failed accept does not delete the pending packet', () => {
  const q = queue();
  const packetId = advanceToPending(q);
  const refused = q.accept(packetId, author as unknown as GovernedReviewer);
  assert.equal(refused.ok, false);
  assert.equal(q.get(packetId)?.state, 'pending-review');
});
