# Agent Calling Module — Architecture

## Overview

`src/lib/agents/` provides a thin Effect.Service bridge between Pi's OAuth
infrastructure and `@effect/ai` LanguageModel layers.

## Authentication Paths

### Path 1: Environment Variables (Recommended for API access)

Standard API keys set via environment variables:

- `OPENAI_API_KEY` → `api.openai.com/v1/responses` ✅ Works
- `ANTHROPIC_API_KEY` → `api.anthropic.com/v1/messages` ✅ Works

```ts
import { makeOpenAiLayerFromEnv, makeAnthropicLayerFromEnv } from '@/lib/agents'

const layer = makeOpenAiLayerFromEnv('gpt-4o-mini')
```

### Path 2: Pi OAuth (PiAuthBridge)

Reads tokens from `~/.pi/agent/auth.json` via `AuthStorage.getApiKey()`.

⚠️ **Important limitation**: Pi's OAuth tokens are **subscription tokens**,
not standard API keys:

| Provider       | Token Type         | Works With                          | Does NOT Work With         |
|----------------|--------------------|-------------------------------------|----------------------------|
| `openai-codex` | JWT (ChatGPT Plus) | `chatgpt.com/backend-api`           | `api.openai.com` ❌        |
| `anthropic`    | `sk-ant-oat01-*`   | Anthropic Console (Pi's provider)   | `api.anthropic.com` ❌     |

The OAuth tokens authenticate you as a **consumer subscription user**
(ChatGPT Plus/Pro, Claude Pro/Max), not as an **API developer**. The standard
API endpoints (`api.openai.com`, `api.anthropic.com`) reject these tokens.

Pi's own providers handle this by hitting the consumer endpoints:
- OpenAI Codex: `chatgpt.com/backend-api/codex/responses` (with special headers)
- Anthropic: Uses its own OAuth→API bridge internally

### Path 3: PiAuthBridge + Env Var Fallback (Best of Both)

`PiAuthBridge.getApiKey()` follows this priority chain:
1. Runtime override (if set)
2. `api_key` field in auth.json (standard API key, if stored)
3. OAuth auto-refresh (subscription token)
4. Environment variable (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`)
5. Fallback resolver

If the user has set `OPENAI_API_KEY`, PiAuthBridge will use it even when
OAuth tokens exist. This is the recommended approach.

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Your Effect Program               │
│  yield* LanguageModel.LanguageModel              │
│  yield* model.generateText({ prompt: '...' })    │
└────────────────────┬────────────────────────────┘
                     │
            ╔════════╧════════╗
            ║  LanguageModel  ║  @effect/ai unified interface
            ╚════════╤════════╝
                     │
         ┌───────────┴───────────┐
         │                       │
  ╔══════╧══════╗       ╔═══════╧═══════╗
  ║ OpenAiClient║       ║AnthropicClient║
  ╚══════╤══════╝       ╚═══════╤═══════╝
         │                       │
  ┌──────┴──────┐       ┌───────┴───────┐
  │ apiKey:     │       │ apiKey:       │
  │ OPENAI_API  │       │ ANTHROPIC_API │
  │ _KEY (env)  │       │ _KEY (env)    │
  │    OR       │       │    OR         │
  │ PiAuthBridge│       │ PiAuthBridge  │
  └─────────────┘       └───────────────┘
```

## File Structure

```
src/lib/agents/
├── index.ts                 # Barrel exports
├── auth/
│   ├── PiAuthBridge.ts      # Effect.Service wrapping AuthStorage
│   └── index.ts
├── providers/
│   ├── openai.ts            # OpenAI layer factories
│   ├── anthropic.ts         # Anthropic layer factories
│   └── index.ts             # Provider registry
├── atoms/
│   ├── auth.ts              # Auth status atoms (effect-atom)
│   └── index.ts
└── docs/
    └── ARCHITECTURE.md      # This file
```

## Key Decisions

### D1: `OpenAiClient.layer()` not `layerConfig()`

`layerConfig()` uses Effect Config resolution which causes "Not a valid effect:
undefined" errors due to internal Effect module quirks. `layer()` takes
static values and works reliably.

### D2: `Layer.unwrapEffect` for dynamic token injection

Since `layer()` accepts static `Redacted<string>` (not effectful), we use
`Layer.unwrapEffect` to read the token from PiAuthBridge first, then
construct the client layer with the token.

### D3: Single `effect` version required

The monorepo must have exactly ONE `effect` version. Multiple versions cause
"Not a valid effect: undefined" because Tags created by one version are
invisible to another. Fixed via `overrides` in root `package.json`.

### D4: Env var is the reliable path

OAuth subscription tokens don't work with standard API endpoints. The env var
path (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) is the recommended approach for
`@effect/ai` integration. PiAuthBridge still provides value for auth status
checks and provider listing.

## Usage Examples

### Simple (env var)

```ts
import { LanguageModel } from '@effect/ai'
import { Effect } from 'effect'
import { makeOpenAiLayerFromEnv } from '@/lib/agents'

const program = Effect.gen(function* () {
  const model = yield* LanguageModel.LanguageModel
  const response = yield* model.generateText({ prompt: 'Hello!' })
  return response.text
})

const layer = makeOpenAiLayerFromEnv('gpt-4o-mini')
const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
```

### With PiAuthBridge (for auth status + fallback to env var)

```ts
import { LanguageModel } from '@effect/ai'
import { Effect, Layer } from 'effect'
import { PiAuthBridge, PiAuthBridgeLive, makeOpenAiLayer } from '@/lib/agents'

const program = Effect.gen(function* () {
  const bridge = yield* PiAuthBridge
  const hasAuth = yield* bridge.hasAuth('openai-codex')
  console.log('Authenticated:', hasAuth)

  const model = yield* LanguageModel.LanguageModel
  return yield* model.generateText({ prompt: 'Hello!' })
})

const openAiLayer = makeOpenAiLayer('gpt-4o-mini')
const fullLayer = Layer.mergeAll(
  PiAuthBridgeLive,
  openAiLayer.pipe(Layer.provide(PiAuthBridgeLive)),
)
const result = await Effect.runPromise(program.pipe(Effect.provide(fullLayer)))
```
