import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  asAdversarialReviewer,
  asAssessor,
  asComposer,
  asHumanGovernor,
  contentDigest,
  openLaboratory,
} from "../src/index.ts";

describe("pipeline", () => {
  it("content digest is stable and changes when definition changes without version bump", async () => {
    const lab = await openLaboratory();
    const composer = asComposer("workflow-composer-fixture");
    const draft = await lab.loadDraft(
      composer,
      "assistant/workflows/definitions/care-source-comparison.v1.json",
      "assistant/workflows/laboratory/envelopes/care-source-comparison.v1.json",
    );
    const again = contentDigest(
      draft.definition as unknown as Record<string, unknown>,
    );
    assert.equal(again, draft.digest);
    assert.equal(again, draft.definition.digest);

    const mutated: Record<string, unknown> = {
      ...(draft.definition as unknown as Record<string, unknown>),
      description: "mutated without version bump",
    };
    delete mutated["digest"];
    const next = contentDigest(mutated);
    assert.notEqual(next, draft.digest);
  });

  it("bindRun on revoked fails; sleep reminder ok; negatives fail at expected paths", async () => {
    const lab = await openLaboratory();
    const composer = asComposer("workflow-composer-fixture");
    const assessor = asAssessor("tool-assessor-fixture");
    const adversary = asAdversarialReviewer("adversarial-reviewer-fixture");
    const governor = asHumanGovernor("human-governor-fixture");

    const reminder = await lab.loadDraft(
      composer,
      "assistant/workflows/definitions/feeding-removal-reminder.v1.json",
      "assistant/workflows/laboratory/envelopes/feeding-removal-reminder.v1.json",
    );
    const reminderEval = await lab.evaluate(assessor, reminder, { adversary });
    assert.equal(reminderEval.kind, "closed");
    assert.equal(
      reminder.definition.graph.some(
        (n) => n.mapping === "sleep" && n.signal === "reminder",
      ),
      true,
    );
    const signed = await lab.approve(governor, lab.present(reminderEval));
    const active = await lab.activate(governor, signed);
    const receipt = await lab.bindRun(active, { topic: "remove prey" });
    assert.equal(receipt.digest, active.digest);
    assert.equal(receipt.replaySafe, true);

    const revoked = await lab.revoke(governor, active, "superseded-by-1.1.0");
    assert.equal(revoked.state, "revoked");
    await assert.rejects(() => lab.bindRun(active, { topic: "again" }));

    const negatives: { path: string; def: string; env: string }[] = [
      {
        path: "/graph/0/toolId",
        def: "assistant/workflows/definitions/device-command-graph.v1.json",
        env: "assistant/workflows/laboratory/envelopes/device-command-graph.v1.json",
      },
      {
        path: "/graph/0/toolId",
        def: "assistant/workflows/definitions/hidden-unassayed-mcp.v1.json",
        env: "assistant/workflows/laboratory/envelopes/hidden-unassayed-mcp.v1.json",
      },
      {
        path: "/graph/1",
        def: "assistant/workflows/definitions/unbounded-loop.v1.json",
        env: "assistant/workflows/laboratory/envelopes/unbounded-loop.v1.json",
      },
      {
        path: "/graph/0/toolId",
        def: "assistant/workflows/definitions/replay-nominal-write.v1.json",
        env: "assistant/workflows/laboratory/envelopes/replay-nominal-write.v1.json",
      },
    ];

    for (const neg of negatives) {
      const draft = await lab.loadDraft(composer, neg.def, neg.env);
      const evaluation = await lab.evaluate(assessor, draft, { adversary });
      assert.equal(evaluation.kind, "failed", neg.def);
      assert.ok(
        evaluation.diagnostics.some((d) => d.path === neg.path),
        `${neg.def} expected ${neg.path}, got ${evaluation.diagnostics.map((d) => d.path).join(",")}`,
      );
    }
  });
});
