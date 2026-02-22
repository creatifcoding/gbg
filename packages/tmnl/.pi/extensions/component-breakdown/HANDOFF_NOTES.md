# Handoff Notes — component-breakdown

## Implemented in this iteration

- Fixed state visibility bug by stabilizing atom-facade state backing in `state/atoms.ts`.
- Unified lifecycle mutations through `runTemplateGeneration()`.
- Added lazy questionnaire bridge in `questionnaire-adapter.ts` with graceful error messaging.
- Removed hard compile-time dependency from `questionnaire.ts` to questionnaire extension schemas.
- Added tests:
  - schema defaults/rejection
  - deterministic engine outputs
  - facade transitions
  - extension registration + tool execution path
- Added runbook doc (`TEST_RUNBOOK.md`) and README troubleshooting updates.

## Known open items

- Manual interactive gate remains: validate `/component-breakdown` no-arg path in live pi TUI session.

## Completed polish pass

- `component_breakdown_state` now supports `view: "summary" | "full"`.
- Added per-section generation timings + total duration diagnostics in tool details.
- Added command-side preview notification (first compact transition line) and timing note.

## Operational note

Tool-only path no longer requires questionnaire runtime. Questionnaire runtime is loaded only for `/component-breakdown` without args.
