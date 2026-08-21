# `@tmnl/mantis-workflow-lab`

Local admission laboratory for Mastra dynamic-workflow JSON (gbg#53 / A3).
Composer output is a branded `DraftDefinition`. Assessor and adversarial
review evaluate read-only. Only a `HumanGovernor` can approve, sign, activate,
or revoke.

This package does not call live CopilotKit or a remote Mastra server. It does
not depend on `@mastra/core` or `@tmnl/mantis-assistant`. It records
`mastraCore: "1.61.0"` as a read of A0's pin.

## Install

```bash
npm install
npm test
npm run typecheck
npm run catalog
```

## Quickstart

```ts
import {
  openLaboratory,
  asComposer,
  asAssessor,
  asAdversarialReviewer,
  asHumanGovernor,
} from "@tmnl/mantis-workflow-lab";

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
const packet = lab.present(evaluation);
const signed = await lab.approve(governor, packet);
const active = await lab.activate(governor, signed);
const receipt = await lab.bindRun(active, { topic: "nymph feeding" });
```

## Lever

`npm run catalog` walks `fixture-catalog/catalog.json` and exits 0 only when
every case matches its `admit` / `reject` / `reject-identity` expectation.

## Layout

- `src/pipeline.ts` owns the private stage table. `reduce` is not exported.
- Envelope fields (budgets, requestContextSchema, sleepPolicy) sit beside the
  A0 definition because A0 `DynamicWorkflowDefinition` sets
  `additionalProperties: false`.
- A3 digest is sha256 of canonical JSON with `digest` omitted.
- Do not create or edit `definitions/research-summary.v1.json`.
