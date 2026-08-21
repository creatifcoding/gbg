import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  asAdversarialReviewer,
  asAssessor,
  asComposer,
  asHumanGovernor,
  openLaboratory,
} from "../src/index.ts";
import { smuggleActivate, smuggleApprove } from "../src/laboratory.ts";

describe("identities", () => {
  it("rejects composer-self-admit when governor id equals composer id", async () => {
    const lab = await openLaboratory();
    const composer = asComposer("workflow-composer-fixture");
    const assessor = asAssessor("tool-assessor-fixture");
    const adversary = asAdversarialReviewer("adversarial-reviewer-fixture");
    const governor = asHumanGovernor("workflow-composer-fixture");
    const draft = await lab.loadDraft(
      composer,
      "assistant/workflows/definitions/composer-self-admit.v1.json",
      "assistant/workflows/laboratory/envelopes/composer-self-admit.v1.json",
    );
    const evaluation = await lab.evaluate(assessor, draft, { adversary });
    assert.equal(evaluation.kind, "closed");
    await assert.rejects(
      () => lab.approve(governor, lab.present(evaluation)),
      (err: unknown) => {
        const e = err as { path?: string; code?: string };
        assert.equal(e.path, "/reviewer");
        assert.equal(e.code, "composer-self-admit");
        return true;
      },
    );
  });

  it("rejects assessor/adversary activate at runtime when brands are smuggled", async () => {
    const lab = await openLaboratory();
    const composer = asComposer("workflow-composer-fixture");
    const assessor = asAssessor("tool-assessor-fixture");
    const adversary = asAdversarialReviewer("adversarial-reviewer-fixture");
    const governor = asHumanGovernor("human-governor-fixture");
    const draft = await lab.loadDraft(
      composer,
      "assistant/workflows/definitions/care-source-comparison.v1.json",
      "assistant/workflows/laboratory/envelopes/care-source-comparison.v1.json",
    );
    const evaluation = await lab.evaluate(assessor, draft, { adversary });
    assert.equal(evaluation.kind, "closed");
    const signed = await lab.approve(governor, lab.present(evaluation));

    await assert.rejects(() => smuggleActivate(lab, assessor, signed));
    await assert.rejects(() => smuggleActivate(lab, adversary, signed));
    await assert.rejects(() =>
      smuggleApprove(lab, assessor, lab.present(evaluation)),
    );
  });
});
