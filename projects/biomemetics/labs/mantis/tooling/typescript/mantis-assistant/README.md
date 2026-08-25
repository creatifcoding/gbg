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

`npm test` is the proof. It calls `agent.generate` and the in-process
CopilotRuntime bind against the Mastra OpenRouter gateway string
`openrouter/deepseek/deepseek-v4-flash-0731`. `createFakeModel` is not the
passing path.

## Live OpenRouter lane

The coordinator and eval agents use the documented Mastra model-router string.
Mastra reads `OPENROUTER_API_KEY` from the environment. There is no custom
OpenAI-compatible url object and no extra OpenRouter package.

A missing or empty `OPENROUTER_API_KEY` fails closed with
`OPENROUTER_CREDENTIAL_REQUIRED`. The lane does not skip, does not read
`OPENAI_API_KEY`, does not use Codex or ChatGPT login, and does not consume
Cursor plan tokens.

Do not commit, log, or print the key.

`.github/workflows/mantis-assistant-ci.yml` runs unit tests without a key, then
runs the live prove on `feat/mantis-biomemetics-lab`. The prove job passes
`secrets.OPENROUTER_API_KEY` into `npm run test:live`. A missing secret leaves
the env empty, so the live job fails closed. The job does not skip and does not
use `createFakeModel` as the passing path. `MantisController.create()` still
defaults to the live OpenRouter lane.

The in-process AG-UI bind remains `MastraAgent.getLocalAgents` into
`CopilotRuntime`. It has no `runtimeUrl`.
