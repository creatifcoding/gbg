# Agent Calling Module — Architecture

## Overview

`src/lib/agents/` provides a thin Effect.Service bridge between Pi's OAuth
infrastructure and `@effect/ai` LanguageModel layers.

## Authentication Paths

### Path 1: OAuth → Codex (Primary) ✅ WORKING

Pi's OAuth JWT → Codex endpoint (`chatgpt.com/backend-api/codex/responses`).

Uses HttpClient middleware that:
1. Injects Codex headers (chatgpt-account-id, OpenAI-Beta, originator)
2. Transforms request body (developer message → instructions, stream: true)
3. Normalizes response SSE (Codex field values → @effect/ai-openai schema)

```ts
import { makeOpenAiCodexLayer, PiAuthBridgeLive } from '@/lib/agents'

const layer = makeOpenAiCodexLayer('gpt-5.2')
  .pipe(Layer.provide(PiAuthBridgeLive))
```

**Supported models**: gpt-5.1, gpt-5.1-codex-max, gpt-5.1-codex-mini,
gpt-5.2, gpt-5.2-codex, gpt-5.3-codex, gpt-5.3-codex-spark

**Requires**: ChatGPT Plus/Pro subscription, active OAuth login via Pi.

**Limitation**: Codex endpoint requires `stream: true`. Only `streamText()`
is supported (not `generateText()`).

### Path 2: OAuth → Anthropic (Bearer Auth) ✅ WORKING

Pi's OAuth token → `api.anthropic.com` with Bearer auth + Claude Code identity.

`@effect/ai-anthropic` uses `x-api-key` by default. The middleware:
1. Removes `x-api-key` header
2. Adds `Authorization: Bearer <token>`
3. Adds beta headers: `claude-code-20250219`, `oauth-2025-04-20`
4. Adds Claude Code identity: `user-agent: claude-cli/2.1.2`, `x-app: cli`

```ts
import { makeAnthropicLayer, PiAuthBridgeLive } from '@/lib/agents'

const layer = makeAnthropicLayer('claude-sonnet-4-20250514')
  .pipe(Layer.provide(PiAuthBridgeLive))
```

**Requirement**: System prompt MUST include "You are Claude Code, Anthropic's
official CLI for Claude." — the API validates this for OAuth tokens.

**Both `generateText` and `streamText` work** (unlike Codex which is stream-only).

### Path 3: Environment Variables ✅ WORKING

Standard API keys set via environment variables:

- `OPENAI_API_KEY` → `api.openai.com/v1/responses` ✅ Works
- `ANTHROPIC_API_KEY` → `api.anthropic.com/v1/messages` ✅ Works

```ts
import { makeOpenAiLayerFromEnv } from '@/lib/agents'

const layer = makeOpenAiLayerFromEnv('gpt-4o-mini')
```

### Path 4: OAuth → Standard API (no middleware) ⚠️ LIMITED

Raw OAuth tokens sent as `x-api-key` / standard auth without middleware.

| Provider       | Token Type         | Standard API     | Status |
|----------------|--------------------|------------------|--------|
| `openai-codex` | JWT (ChatGPT Plus) | `api.openai.com` | ❌ 401 "Missing scopes" |
| `anthropic`    | `sk-ant-oat01-*`   | `api.anthropic.com` (x-api-key) | ❌ 401 "invalid x-api-key" |

Without middleware, the tokens are rejected. Use the OAuth paths above instead.

## Codex Middleware Architecture

```
@effect/ai LanguageModel.streamText({ system, prompt })
  │
  ▼ OpenAiLanguageModel prepares Responses API request
  │ { model, input: [{ role: "developer", content }], ... }
  │
  ▼ OpenAiClient sends to Codex endpoint
  │
  ▼ Codex HttpClient Middleware (request transform)
  │ ├─ Extract developer message → top-level "instructions"
  │ ├─ Set store: false, stream: true
  │ ├─ Inject headers: chatgpt-account-id, OpenAI-Beta, originator
  │ └─ Execute fetch → chatgpt.com/backend-api/codex/responses
  │
  ▼ Codex HttpClient Middleware (response transform)
  │ ├─ Inject Content-Type: text/event-stream (Codex omits it)
  │ ├─ Normalize reasoning.effort: "none" → "low"
  │ ├─ Normalize text.verbosity: "medium" → null
  │ └─ Pass through standard SSE events unchanged
  │
  ▼ @effect/ai-openai parses SSE → Stream<TextPart>
  │ { type: "text-delta", delta: "4" }
  │
  ▼ Your Effect program consumes the stream
```

## File Structure

```
src/lib/agents/
├── index.ts                 # Barrel exports
├── auth/
│   ├── PiAuthBridge.ts      # Effect.Service wrapping AuthStorage
│   └── index.ts
├── providers/
│   ├── openai.ts            # OpenAI layer factories (Codex + standard + env)
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
undefined" errors. `layer()` takes static values and works reliably.

### D2: `Layer.unwrapEffect` for dynamic token injection

Since `layer()` accepts static `Redacted<string>`, we use `Layer.unwrapEffect`
to read the token from PiAuthBridge first, then construct the client layer.

### D3: Single `effect` version required

The monorepo must have exactly ONE `effect` version. Multiple versions cause
Tag invisibility. Fixed via `overrides` in root `package.json`.

### D4: HttpClient.make for body-level middleware

`transformClient` (in `OpenAiClient.layer()`) only transforms headers/URL via
`HttpClient.mapRequest`. Codex requires **body-level** transformation (moving
developer messages to top-level instructions). We use `HttpClient.make` to
create a custom client that intercepts at the fetch level.

### D5: SSE normalization for schema compatibility

Codex returns non-standard field values that break `@effect/ai-openai`'s
strict Schema.Class validation:
- `reasoning.effort: "none"` (schema expects: "minimal"|"low"|"medium"|"high")
- `text.verbosity: "medium"` (schema expects: "auto"|"concise"|"detailed"|null)

The middleware normalizes these in the SSE response stream before parsing.

### D6: Anthropic OAuth = Bearer + Claude Code identity

`@effect/ai-anthropic` sends `x-api-key` header. Pi's OAuth tokens use
`Authorization: Bearer`. The middleware swaps auth and injects beta headers
(`claude-code-20250219`, `oauth-2025-04-20`). System prompts MUST include
"You are Claude Code" — the API validates this for OAuth tokens.

### D7: Codex requires streaming

The Codex endpoint returns 400 if `stream` is not `true`. This means only
`LanguageModel.streamText()` works — `generateText()` will fail since
@effect/ai sends a non-streaming request.

## Usage Examples

### OAuth → Codex (gpt-5.2)

```ts
import { LanguageModel } from '@effect/ai'
import { Effect, Layer, Stream } from 'effect'
import { PiAuthBridgeLive, makeOpenAiCodexLayer } from '@/lib/agents'

const program = Effect.gen(function* () {
  const model = yield* LanguageModel.LanguageModel
  const stream = model.streamText({
    system: 'Be concise.',
    prompt: 'What is the capital of France?',
  })

  let text = ''
  yield* Stream.runForEach(stream, (chunk) =>
    Effect.sync(() => {
      const part = chunk as any
      if (part.type === 'text-delta') text += part.delta
    })
  )
  return text // "Paris"
})

const layer = makeOpenAiCodexLayer('gpt-5.2')
  .pipe(Layer.provide(PiAuthBridgeLive))
const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
```

### OAuth → Anthropic (claude-sonnet-4)

```ts
import { LanguageModel } from '@effect/ai'
import { Effect, Layer } from 'effect'
import { PiAuthBridgeLive, makeAnthropicLayer } from '@/lib/agents'

const program = Effect.gen(function* () {
  const model = yield* LanguageModel.LanguageModel
  const response = yield* model.generateText({
    system: "You are Claude Code, Anthropic's official CLI for Claude. Be concise.",
    prompt: 'What is the capital of France?',
  })
  return response.text // "Paris"
})

const layer = makeAnthropicLayer('claude-sonnet-4-20250514')
  .pipe(Layer.provide(PiAuthBridgeLive))
const result = await Effect.runPromise(program.pipe(Effect.provide(layer)))
```

### Env var (gpt-4o-mini)

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
