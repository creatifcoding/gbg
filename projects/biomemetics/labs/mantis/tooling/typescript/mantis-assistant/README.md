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

The requested live lane is `QUARANTINED_UPSTREAM`. The pinned
`@mastra/core@1.61.0` model router does not expose the ChatGPT or Codex OAuth
provider used by Mastra Code. The official `openai-codex` provider lives
outside this package's pinned A0 dependency set, so this harness does not
start OAuth, read a pasted key, or call a Cursor endpoint.

Run `MASTRA_LIVE=1 npm run test:live` to inspect the quarantine assertion. The
test skips without the opt-in. It reports
`LIVE_LUNA_QUARANTINED_UPSTREAM` with the exact provider gap. `LOGIN_NEEDED`
applies only after a pinned provider can consume the user's existing
Codex or ChatGPT subscription session.
