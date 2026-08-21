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

The live lane is opt-in. Run `MASTRA_LIVE=1 npm run test:live` after the user
has authenticated through Mastra Code's Codex or ChatGPT subscription flow.
The test skips without `MASTRA_LIVE=1`.

The lane uses the pinned `@mastra/code-sdk@1.4.0` `openai-codex` provider with
model `gpt-5.6-luna` and reasoning level `max`. The provider reads the
subscription OAuth record from Mastra Code `auth.json` and owns token refresh.
The lane never starts login, prints credentials, or accepts an API-key
credential.

The package's fake CI lane supports Node `>=22.14.0`. The live provider package
declares Node `>=22.19.0`. A missing subscription session fails closed with
`CODEX_SUBSCRIPTION_AUTH_REQUIRED`. The in-process AG-UI bind remains
`MastraAgent.getLocalAgents` into `CopilotRuntime`; it has no `runtimeUrl`.
