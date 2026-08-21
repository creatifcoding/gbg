import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  asAdversarialReviewer,
  asAssessor,
  asComposer,
  asHumanGovernor,
  openLaboratory,
} from "../src/index.ts";

describe("fixture catalog", () => {
  it("matches every catalog.json expect through activate or fail-closed", async () => {
    const lab = await openLaboratory();
    const report = await lab.runCatalog();
    assert.equal(report.ok, true, JSON.stringify(report.cases, null, 2));
    assert.equal(report.cases.length, 10);
    const admits = report.cases.filter((c) => c.expect === "admit");
    assert.equal(admits.length, 5);
    for (const c of admits) {
      assert.equal(c.ok, true, c.id);
      assert.equal(c.stage, "active");
    }
    for (const c of report.cases.filter((c) => c.expect !== "admit")) {
      assert.equal(c.ok, true, `${c.id}: ${JSON.stringify(c.diagnostics)}`);
      assert.ok(
        c.diagnostics.some((d) => d.path.startsWith("/")),
        `${c.id} missing path diagnostic`,
      );
    }
  });

  it("validates WorkflowAdmission and WorkflowRunReceipt against imported-a0 schemas", async () => {
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
    const active = await lab.activate(governor, signed);
    const wire = lab.toAdmissionWire(active);
    assert.equal(wire.kind, "WorkflowAdmission");
    assert.equal(wire.state, "active");
    assert.match(wire.signature ?? "", /^[a-f0-9]{64}$/);
    const receipt = await lab.bindRun(active, { topic: "nymph" });
    assert.equal(receipt.kind, "WorkflowRunReceipt");
    assert.equal(receipt.digest, active.digest);
    assert.equal(receipt.replaySafe, true);
  });
});
