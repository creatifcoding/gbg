# `@tmnl/mantis-assistant`

A0 pin and compatibility harness for the mantis assistant. Mastra is the
agent runtime. CopilotKit/AG-UI is the protocol surface. This package is not
the keeper PWA, not a SpecimenDB bridge, and not a shop-release, EVA, or graph
claim. Mastra memory is not canonical care or evidence truth.

Beta Mastra APIs are imported only through `src/mastra-adapter.ts`. A surface
that cannot be pinned and proven is marked `QUARANTINED_UPSTREAM`. Live
observational-memory observer/reflector cycles on InMemoryStore are quarantined;
thread OM config and privacy typing are proven.

## Pins

See `src/pins.ts` and this directory's `package-lock.json`.

## Commands

```text
npm ci
npm test
npm run typecheck
```

Tests use the committed lock, a fake model, fake tools, a fake clock, and
in-memory storage. They do not use live credentials or network model providers.

## Model lanes

CI uses `createFakeModel`, fake tools, and no credentials. The existing
33-test proof remains offline.

The live lane is opt-in. With `OPENAI_API_KEY` already set in the environment,
run `MASTRA_LIVE=1 npm run test:live`.
Mastra's model router consumes `openai/gpt-5.6-luna` and requests
`reasoningEffort: "max"`.

The harness does not consume Cursor plan tokens directly and does not call a
Cursor endpoint. Mastra 1.61.0 documents `OPENAI_API_KEY` for the OpenAI
provider. The live lane never asks for, stores, or prints that value.

If `MASTRA_LIVE` is absent, the live test skips. If the gate is on and
`OPENAI_API_KEY` is absent, the lane fails closed with
`LIVE_LUNA_CREDENTIAL_REQUIRED`. The fake CI lane is unaffected.
