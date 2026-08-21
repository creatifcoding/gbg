import assert from 'node:assert/strict';
import test from 'node:test';

import {
  asAdversarialReviewer,
  asAssessor,
  asComposer,
  asHumanGovernor,
} from '../src/identities.ts';
import { openLaboratory, smuggleApprove } from '../src/laboratory.ts';

test('composer cannot admit its own output', async () => {
  const lab = await openLaboratory();
  const composer = asComposer('workflow-composer-fixture');
  const assessor = asAssessor('tool-assessor-fixture');
  const draft = await lab.loadDraft(
    composer,
    'assistant/workflows/definitions/composer-self-admit.v1.json',
    'assistant/workflows/laboratory/envelopes/composer-self-admit.v1.json',
  );
  const evaluation = await lab.evaluate(assessor, draft);
  assert.equal(evaluation.kind, 'closed');
  if (evaluation.kind !== 'closed') return;
  const packet = lab.present(evaluation);
  await assert.rejects(
    () => lab.approve(asHumanGovernor(composer.id), packet),
    (err: unknown) => {
      const e = err as { path?: string };
      return e.path === '/reviewer';
    },
  );
});

test('smuggled assessor cannot approve', async () => {
  const lab = await openLaboratory();
  const composer = asComposer('workflow-composer-fixture');
  const assessor = asAssessor('tool-assessor-fixture');
  const governor = asHumanGovernor('human-governor-fixture');
  const draft = await lab.loadDraft(
    composer,
    'assistant/workflows/definitions/observation-packet.v1.json',
    'assistant/workflows/laboratory/envelopes/observation-packet.v1.json',
  );
  const evaluation = await lab.evaluate(assessor, draft);
  assert.equal(evaluation.kind, 'closed');
  if (evaluation.kind !== 'closed') return;
  const packet = lab.present(evaluation);
  await assert.rejects(() => smuggleApprove(lab, assessor, packet));
  await assert.rejects(() =>
    smuggleApprove(lab, asAdversarialReviewer('adversarial-reviewer-fixture'), packet),
  );
  const signed = await lab.approve(governor, packet);
  assert.equal(signed.state, 'signed-immutable');
});
