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

See `src/pins.ts` and this directory's `package-lock.json`. `@mastra/core`
stays `1.61.0`.

## Commands

```text
npm ci
npm test
npm run typecheck
```

`npm test` uses `createFakeModel`, fake tools, a fake clock, and in-memory
storage. It does not need live credentials or a network model provider.

## Model lanes

CI is the fake lane. It is the default harness.

The live lane is opt-in. Run `MASTRA_LIVE=1 npm run test:live` when
`OPENROUTER_API_KEY` is set. The live tests skip unless both are present.

The live lane uses Mastra's OpenAI-compatible model config against
`https://openrouter.ai/api/v1`. The model id is `openai/gpt-5.6-luna`.
Reasoning effort is `max`. The credential is `OPENROUTER_API_KEY` only.

A missing or empty `OPENROUTER_API_KEY` fails closed with
`OPENROUTER_CREDENTIAL_REQUIRED`. The lane does not read `OPENAI_API_KEY`,
does not use Codex or ChatGPT login, and does not consume Cursor plan tokens.

Do not commit, log, or print the key.

The in-process AG-UI bind remains `MastraAgent.getLocalAgents` into
`CopilotRuntime`. It has no `runtimeUrl`.
