# component-breakdown (pi extension scaffold)

Extensionifies a repeatable process for breaking down UI components into deterministic artifacts.

## What this scaffold includes

1. Compact + expanded ASCII state diagram templates
2. Indexed pet-name lexicon template
3. Interaction precedence matrix template
4. Per-phase smoke-test template
5. Atom-facade + Effect-oriented generation pipeline

## Tools

- `component_breakdown_templates`
  - Input: component metadata
  - Output: full markdown template pack + generation diagnostics (total + section timings)
- `component_breakdown_state`
  - Input: optional `view` (`summary` default, `full`)
  - Output: atom-facade run state snapshot

## Command

- `/component-breakdown [component-name]`
  - With arg: runs directly
  - Without arg: launches questionnaire intake flow (via questionnaire extension, loaded lazily)

## Architecture

- `schema.ts` — Effect Schema contracts
- `state/atoms.ts` — Atom-as-state source of truth
- `state/facade.ts` — mutation facade (no Ref→Atom bridge)
- `engine.ts` — Effect program (`Effect.gen`) + span instrumentation
- `templates.ts` — deterministic template text builders
- `questionnaire.ts` — questionnaire spec shape + answer mapping
- `questionnaire-adapter.ts` — lazy bridge to questionnaire extension runtime
- `index.ts` — extension wiring (tools + command)

## Install (project-local)

```bash
cd .pi/extensions/component-breakdown
bun install
```

## Test runbook

```bash
cd .pi/extensions/component-breakdown
bun test
```

Manual in pi:
1. Start pi from project root.
2. `/reload`
3. Ask pi to call `component_breakdown_templates` with `componentName`.
4. Ask pi to call `component_breakdown_state` and verify `status: done`.

## Troubleshooting

- If `/component-breakdown` (without arg) fails with questionnaire message:
  - ensure `.pi/extensions/questionnaire` exists
  - run `cd .pi/extensions/questionnaire && bun install`
- Tool-only usage does **not** require questionnaire dependencies.
- If extension changes are not visible, run `/reload`.
