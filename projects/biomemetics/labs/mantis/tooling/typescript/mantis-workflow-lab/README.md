# `@tmnl/mantis-workflow-lab`

A3 admission laboratory for Mastra dynamic-workflow JSON (gbg#53). CopilotKit
is the later keeper surface. This package does not start a CopilotKit URL or a
Mastra server. A0 already pinned Mastra 1.61.0 and proved
`addDynamicWorkflow`. This package records that pin and does not depend on
`@mastra/core`.

Composer output is a draft. Assessor and adversarial reviewer are read-only.
Only a human governor can approve, sign, activate, or revoke.

## Commands

```text
npm ci
npm test
npm run typecheck
npm run catalog
```

`npm run catalog` walks `assistant/workflows/fixture-catalog/catalog.json` and
exits 0 only when every case matches `admit`, `reject`, or `reject-identity`.
