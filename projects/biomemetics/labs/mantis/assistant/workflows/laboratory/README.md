# Dynamic workflow laboratory (A3)

Governed admission for Mastra JSON workflow definitions. CopilotKit/AG-UI is
the later keeper surface. This directory is the JSON laboratory, not that
surface.

This slice does not call a live CopilotKit URL or a remote Mastra server. A0
already pinned Mastra 1.61.0 and proved `addDynamicWorkflow` on
`wf.research-summary`. This slice consumes those contracts by read. It does
not rewrite them.

## Pipeline

`draft` → schema/graph validation → primitive resolution → tool-assay closure →
static policy lint → simulator → adversarial eval → human approval → signed
immutable version → `active`. Revocation and expiry follow. Running jobs keep
the content digest they started with.

P0–P2 only. Device command, SpecimenDB writes, browser mutation, secrets, and
direct canonical mutation fail closed with path diagnostics.

The workflow composer cannot register, approve, or activate its own output.
The assessor cannot admit. The adversarial reviewer is read-only.

## Layout

`imported-a0/` holds read-only copies of A0 schemas and the two admitted
read-tool assays so this PR verifies before A0 merges. Prefer live
`assistant/contracts/` and `assistant/tools/` when those files exist.

`envelopes/` holds budgets, request-context schema, and sleep policy. A0's
`DynamicWorkflowDefinition` schema sets `additionalProperties` to false, so
those fields cannot live on the definition document.

`../definitions/` holds A3 graphs. It does not own
`research-summary.v1.json`. That file belongs to A0 PR 100.

`../fixture-catalog/` is the positive and negative corpus.

`../linter/rules.json` and `../simulator/harness.json` are data for the
TypeScript package `@tmnl/mantis-workflow-lab`.

## Digest

A3 content-hashes the definition with the `digest` field omitted, using
sorted JSON and compact separators. A0's research-summary fixture uses
`sha256(definitionId + "@" + version)`. Do not rewrite that fixture to match.
