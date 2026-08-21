import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  createEvidenceQueue,
  curator,
  governedReviewer,
  type EvidenceQueue,
  type PacketId,
} from '../../evidence/src/index.ts';
import {
  PUBLISHED_SPECIMEN_RPCS,
  isTargetRefusal,
  parseExistingTarget,
  planAttach,
  previewAccepted,
  probeAttachWell,
} from '../src/index.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

const loadJson = (relative: string): unknown =>
  JSON.parse(readFileSync(path.join(here, relative), 'utf8'));

const author = curator('curator@lab');
const reviewer = governedReviewer('reviewer@lab');
const clock = { now: () => '2026-08-21T00:00:00Z' };

const queue = (): EvidenceQueue =>
  createEvidenceQueue({ queueId: 'mantis-a5-preview', clock });

const acceptMeasured = (q: EvidenceQueue): PacketId => {
  const drafted = q.enqueueDraft(author, {
    origin: 'canonical-record',
    record: loadJson('../../evidence/fixtures/positive/accepted-measured.json'),
  });
  assert.equal(drafted.ok, true);
  if (drafted.ok !== true) throw new TypeError('expected draft');
  const closed = q.validate(drafted.packet.packetId);
  assert.equal(closed.ok, true);
  if (closed.ok !== true) throw new TypeError('expected validated');
  const submitted = q.submit(closed.packet.packetId, author);
  assert.equal(submitted.ok, true);
  if (submitted.ok !== true) throw new TypeError('expected pending');
  const accepted = q.accept(submitted.packet.packetId, reviewer);
  assert.equal(accepted.ok, true);
  if (accepted.ok !== true) throw new TypeError('expected accepted');
  return accepted.packet.packetId;
};

test('accepted measured record previews admission text, not the result summary', () => {
  const q = queue();
  const packetId = acceptMeasured(q);
  const well = probeAttachWell({ Attach: undefined, Get: () => {} });
  assert.equal(well.kind, 'empty-well');
  const target = parseExistingTarget('caller-supplied-existing-id');
  assert.equal(isTargetRefusal(target), false);
  if (isTargetRefusal(target)) return;
  const preview = previewAccepted(q, packetId, target, well);
  assert.equal(preview.ok, true);
  if (preview.ok !== true) return;
  const first = preview.payload.components[0];
  assert.equal(first?._tag, 'Structure');
  if (first?._tag === 'Structure') {
    assert.equal(first.text, 'Coupon exposes twelve contacts.');
    assert.notEqual(
      first.text,
      'Positive Draft 2020-12 fixture with digested path and URI artifacts.',
    );
  }
  assert.equal(preview.executable, false);
  assert.equal(preview.storeWrite, false);
  assert.equal(preview.localityMutated, false);
  assert.equal(preview.taxonMutated, false);
  assert.equal(preview.specimenMinted, false);
  assert.equal(preview.previewEntity.honestyClass, 'projected');
  assert.equal(preview.receiptEntity.honestyClass, 'projected');
  assert.match(
    preview.previewEntity.ref,
    /^gbg:preview:fixture-positive-measured:caller-supplied-existing-id@[a-f0-9]{64}$/,
  );
  assert.match(
    preview.receiptEntity.ref,
    /^gbg:receipt:fixture-positive-measured:caller-supplied-existing-id@[a-f0-9]{64}$/,
  );
  assert.equal(preview.well.kind, 'empty-well');
  assert.equal(preview.evidenceId, 'fixture-positive-measured');
});

test('retry of the same accepted packet and target mints identical refs', () => {
  const q = queue();
  const packetId = acceptMeasured(q);
  const target = parseExistingTarget('caller-supplied-existing-id');
  if (isTargetRefusal(target)) return;
  const well = probeAttachWell(undefined);
  const first = previewAccepted(q, packetId, target, well);
  const second = previewAccepted(q, packetId, target, well);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok !== true || second.ok !== true) return;
  assert.equal(first.previewEntity.ref, second.previewEntity.ref);
  assert.equal(first.receiptEntity.ref, second.receiptEntity.ref);
});

test('empty well when Attach is missing, including default undefined', () => {
  const missing = probeAttachWell(undefined);
  assert.equal(missing.kind, 'empty-well');
  assert.equal(missing.reason, 'specimendb-attach-unavailable');
  assert.deepEqual(missing.observedRpcNames, []);
  const getOnly = probeAttachWell({ Get: () => {} });
  assert.equal(getOnly.kind, 'empty-well');
  assert.deepEqual(getOnly.observedRpcNames, ['Get']);
  assert.ok(!getOnly.observedRpcNames.includes('Attach'));
  assert.equal(probeAttachWell({ Attach: undefined }).kind, 'empty-well');
  assert.deepEqual(PUBLISHED_SPECIMEN_RPCS, ['Intake', 'Get', 'List', 'Promote']);
});

test('injecting a callable attach still does not invoke it', () => {
  const q = queue();
  const packetId = acceptMeasured(q);
  const target = parseExistingTarget('caller-supplied-existing-id');
  if (isTargetRefusal(target)) return;
  let attachCalls = 0;
  let getCalls = 0;
  let intakeCalls = 0;
  let listCalls = 0;
  let promoteCalls = 0;
  const port = {
    Attach: () => {
      attachCalls += 1;
    },
    Get: () => {
      getCalls += 1;
    },
    Intake: () => {
      intakeCalls += 1;
    },
    List: () => {
      listCalls += 1;
    },
    Promote: () => {
      promoteCalls += 1;
    },
  };
  const preview = planAttach(q, packetId, target, port);
  assert.equal(preview.ok, true);
  if (preview.ok === true) {
    assert.equal(preview.executable, false);
    assert.equal(preview.well.kind, 'gated-well');
    assert.equal(preview.blocker, 'attach-not-live-in-a5');
  }
  assert.equal(attachCalls, 0);
  assert.equal(getCalls, 0);
  assert.equal(intakeCalls, 0);
  assert.equal(listCalls, 0);
  assert.equal(promoteCalls, 0);
});

test('blank and lab-as-specimen ids are refused; no fabricated specimen id', () => {
  const blank = parseExistingTarget('');
  assert.equal(isTargetRefusal(blank), true);
  if (isTargetRefusal(blank)) {
    assert.ok(blank.reasons.includes('invented-target'));
  }
  for (const specimenId of [
    'biomemetics.mantis',
    'mantis-lab',
    'projects/biomemetics/labs/mantis',
  ]) {
    const parsed = parseExistingTarget(specimenId);
    assert.equal(isTargetRefusal(parsed), true, specimenId);
    if (isTargetRefusal(parsed)) {
      assert.ok(parsed.reasons.includes('lab-as-specimen'));
    }
  }
});

test('caller component prose on the target is refused', () => {
  const q = queue();
  const packetId = acceptMeasured(q);
  const target = parseExistingTarget('caller-supplied-existing-id');
  if (isTargetRefusal(target)) return;
  const smuggled = {
    ...target,
    component: { _tag: 'Structure', text: 'Caller-invented prose.' },
  };
  const preview = previewAccepted(q, packetId, smuggled, probeAttachWell(undefined));
  assert.equal(preview.ok, false);
  if (preview.ok === false) {
    assert.ok(preview.reasons.includes('caller-component-prose'));
  }
});

test('draft, pending, rejected, and retained-inconclusive packets cannot preview', () => {
  const q = queue();
  const well = probeAttachWell(undefined);
  const target = parseExistingTarget('caller-supplied-existing-id');
  if (isTargetRefusal(target)) return;
  const drafted = q.enqueueDraft(author, {
    origin: 'canonical-record',
    record: loadJson('../../evidence/fixtures/positive/accepted-measured.json'),
  });
  assert.equal(drafted.ok, true);
  if (drafted.ok !== true) return;
  const draftPreview = previewAccepted(q, drafted.packet.packetId, target, well);
  assert.equal(draftPreview.ok, false);
  if (draftPreview.ok === false) {
    assert.ok(draftPreview.reasons.includes('packet-draft'));
  }

  const closed = q.validate(drafted.packet.packetId);
  assert.equal(closed.ok, true);
  if (closed.ok !== true) return;
  const submitted = q.submit(closed.packet.packetId, author);
  assert.equal(submitted.ok, true);
  if (submitted.ok !== true) return;
  const pendingPreview = previewAccepted(q, submitted.packet.packetId, target, well);
  assert.equal(pendingPreview.ok, false);
  if (pendingPreview.ok === false) {
    assert.ok(pendingPreview.reasons.includes('packet-pending-review'));
  }

  const rejectedDraft = q.enqueueDraft(author, {
    origin: 'canonical-record',
    record: loadJson('../../evidence/fixtures/negative/rejected.json'),
  });
  assert.equal(rejectedDraft.ok, true);
  if (rejectedDraft.ok !== true) return;
  const rejectedClosed = q.validate(rejectedDraft.packet.packetId);
  assert.equal(rejectedClosed.ok, true);
  if (rejectedClosed.ok !== true) return;
  const rejectedSubmitted = q.submit(rejectedClosed.packet.packetId, author);
  assert.equal(rejectedSubmitted.ok, true);
  if (rejectedSubmitted.ok !== true) return;
  const rejected = q.reject(rejectedSubmitted.packet.packetId, reviewer);
  assert.equal(rejected.ok, true);
  const rejectedPreview = previewAccepted(
    q,
    rejectedSubmitted.packet.packetId,
    target,
    well,
  );
  assert.equal(rejectedPreview.ok, false);
  if (rejectedPreview.ok === false) {
    assert.ok(rejectedPreview.reasons.includes('packet-rejected'));
  }
  assert.equal(q.get(rejectedSubmitted.packet.packetId)?.state, 'rejected');

  const inconclusiveDraft = q.enqueueDraft(author, {
    origin: 'canonical-record',
    record: loadJson('../../evidence/fixtures/negative/inconclusive.json'),
  });
  assert.equal(inconclusiveDraft.ok, true);
  if (inconclusiveDraft.ok !== true) return;
  const inconclusiveClosed = q.validate(inconclusiveDraft.packet.packetId);
  assert.equal(inconclusiveClosed.ok, true);
  if (inconclusiveClosed.ok !== true) return;
  const inconclusiveSubmitted = q.submit(inconclusiveClosed.packet.packetId, author);
  assert.equal(inconclusiveSubmitted.ok, true);
  if (inconclusiveSubmitted.ok !== true) return;
  const retained = q.retainInconclusive(inconclusiveSubmitted.packet.packetId, reviewer);
  assert.equal(retained.ok, true);
  const inconclusivePreview = previewAccepted(
    q,
    inconclusiveSubmitted.packet.packetId,
    target,
    well,
  );
  assert.equal(inconclusivePreview.ok, false);
  if (inconclusivePreview.ok === false) {
    assert.ok(inconclusivePreview.reasons.includes('packet-retained-inconclusive'));
  }
});

test('failed preview does not delete the accepted packet', () => {
  const q = queue();
  const packetId = acceptMeasured(q);
  const lab = parseExistingTarget('biomemetics.mantis');
  assert.equal(isTargetRefusal(lab), true);
  assert.equal(q.get(packetId)?.state, 'accepted');
});

test('observed supporting accepted records are preview-eligible', () => {
  const measured = loadJson(
    '../../evidence/fixtures/positive/accepted-measured.json',
  ) as Record<string, unknown>;
  const { measurements: _measurements, ...rest } = measured;
  const observed = {
    ...rest,
    evidenceId: 'fixture-positive-observed',
    sourceClass: 'observed',
    observations: [
      {
        statement: 'Twelve contacts are exposed.',
        status: 'observed',
      },
    ],
    admissions: [
      {
        claimRef: 'claim:rail:contact-count',
        kind: 'structure',
        text: 'Coupon exposes twelve contacts.',
      },
    ],
  };
  const q = queue();
  const drafted = q.enqueueDraft(author, { origin: 'canonical-record', record: observed });
  assert.equal(drafted.ok, true);
  if (drafted.ok !== true) return;
  const closed = q.validate(drafted.packet.packetId);
  assert.equal(closed.ok, true);
  if (closed.ok !== true) return;
  const submitted = q.submit(closed.packet.packetId, author);
  assert.equal(submitted.ok, true);
  if (submitted.ok !== true) return;
  const accepted = q.accept(submitted.packet.packetId, reviewer);
  assert.equal(accepted.ok, true);
  const target = parseExistingTarget('caller-supplied-existing-id');
  if (isTargetRefusal(target)) return;
  const preview = previewAccepted(q, submitted.packet.packetId, target, probeAttachWell({}));
  assert.equal(preview.ok, true);
  if (preview.ok === true) {
    const first = preview.payload.components[0];
    assert.equal(first?._tag, 'Structure');
    if (first?._tag === 'Structure') {
      assert.equal(first.text, 'Coupon exposes twelve contacts.');
    }
  }
});
