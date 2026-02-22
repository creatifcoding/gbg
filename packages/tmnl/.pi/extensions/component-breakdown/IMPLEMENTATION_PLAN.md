# Implementation Plan — `component-breakdown` pi extension

## Goal

Turn UI component decomposition into a reusable extension flow that emits stable artifacts for architecture, implementation, and review.

## Constraints

- Keep **Atom-as-State** (effect-atom) + **facade mutations**
- Keep **Effect-oriented orchestration** (`Effect.gen`, spans, typed failure paths)
- Keep schemas in **Effect Schema** (no raw boundary types)
- Keep install/run local to this project (`.pi/extensions/component-breakdown`)

## Phase Plan (EDIN-shaped)

### Phase E — Experiment (intake + assumptions)

- Use questionnaire intake for component name/context/mode/interactions.
- Verify defaults produce useful output with only component name.

Smoke check:
- Run `/component-breakdown` and cancel once.
- Expected: graceful cancel + no crash + state remains coherent.

### Phase D — Design (schema + template architecture)

- Lock request/output schemas in `schema.ts`.
- Keep template rendering deterministic in `templates.ts`.
- Ensure each artifact has a clear heading and stable section order.

Smoke check:
- Decode minimal request `{ componentName }`.
- Expected: defaults applied, no undefined template sections.

### Phase I — Implement (tooling + state)

- Register `component_breakdown_templates` tool.
- Wire `state/atoms.ts` + `state/facade.ts` transitions: idle → running → done/error.
- Add `component_breakdown_state` tool for observability.

Smoke check:
- Call tool twice with different names.
- Expected: `runs` increments, `lastRequest` / `lastBundle` update deterministically.

### Phase N — Negotiate (adoption + iteration)

- Validate output with real component tickets.
- Track ambiguities in precedence matrix and lexicon naming.
- Add domain presets (grid, modal, panel, timeline) as follow-on.

Smoke check:
- Edit one precedence row, regenerate, compare diffs.
- Expected: local changes only; no cross-section drift.

## Minimal File Scaffold

```text
.pi/extensions/component-breakdown/
├── package.json
├── README.md
├── IMPLEMENTATION_PLAN.md
├── index.ts
├── schema.ts
├── engine.ts
├── templates.ts
├── questionnaire.ts
└── state/
    ├── atoms.ts
    └── facade.ts
```

## Next Increment (after scaffold)

1. Add `@effect/vitest` tests for schema decode + deterministic rendering.
2. Add optional `renderResult` UI formatter for compact tool cards.
3. Add persistence hook if teams want historical template snapshots.
