# Constrained specialist hierarchy

Package `@tmnl/mantis-assistant-hierarchy` is the A2 inspectable registry, delegation policy, and thread-scoped assistant-memory ledger. It sits behind `MantisController`. This package does not edit the A0 harness.

A later controller imports `openHierarchy` and calls `delegate` / `remember`. This PR does not patch that controller.

## Use

```ts
import { openHierarchy, interpretationYield } from '@tmnl/mantis-assistant-hierarchy';

const hierarchy = openHierarchy({
  clock: { now: () => '2026-08-21T00:00:00.000Z' },
});

const attempt = hierarchy.delegate({
  specialist: 'care-source',
  mode: 'care',
  threadId: 'care:fixture-cup-01:conversation-01',
  careSubjectId: 'care.fixture-cup-01',
  goal: 'source feeding advice',
  transcriptExcerpt: 'small mantis in a cup',
});
```

`openHierarchy` fails closed if a specialist is missing, if `forked` is not `false`, if a tool list contains `device-command`, or if observational-memory policy enables resource-scoped OM.

Default `delegate` is a policy dry-run. It does not call a model. It does not bind CopilotKit. A missing `runtimeUrl` is not a gate.

## Registry

Nine specialists, one JSON manifest each under `manifests/`:

`care-source`, `observation-extractor`, `taxon-hypothesis`, `supply-transit`, `terrarium-diagnostician`, `evidence-curator`, `workflow-composer`, `tool-assessor`, `adversarial-reviewer`.

Loaded rows have `forked: false` as a literal. Taxon output is `interpretationYield`, which forces `confirmed: false`. Care subjects are not minted here.

## Memory

`remember` stamps `recordClass: assistant-memory`, redacts address/tokens, and appends. A canonical correction marks older rows `superseded` and leaves their text in place. `forget` exports a tombstone without text. Observer/reflector live cycles stay `QUARANTINED_UPSTREAM`.

## Check

```text
cd projects/biomemetics/labs/mantis/assistant/hierarchy
npm ci
npm run typecheck
npm test
```

`.github/workflows/mantis-assistant-a2.yml` runs those same commands.
