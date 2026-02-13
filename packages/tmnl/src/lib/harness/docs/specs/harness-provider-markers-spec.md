# Harness Provider Marker Exhaustive Spec

Date: 2026-02-11

## Goal

Expose **every low-level provider stream marker** from `@mariozechner/pi-ai` as a typed, tagged union event in harness so downstream renderers can partition by tag (`_tag`) and provider marker type (`marker._tag`) without ad-hoc parsing.

## Canonical Marker Set (pi-ai)

From `@mariozechner/pi-ai/dist/types.d.ts` (`AssistantMessageEvent`), the low-level marker set is:

1. `start`
2. `text_start`
3. `text_delta`
4. `text_end`
5. `thinking_start`
6. `thinking_delta`
7. `thinking_end`
8. `toolcall_start`
9. `toolcall_delta`
10. `toolcall_end`
11. `done`
12. `error`

## Provider Emission Research (dist/providers)

Evidence query:

```bash
rg -n "stream\.push\(\{\s*type:\s*\"" \
  ../../node_modules/.bun/@mariozechner+pi-ai@*/node_modules/@mariozechner/pi-ai/dist/providers/*.js
```

Observed emission coverage:

- `openai-responses.js`: `start`, `done`, `error`
- `openai-completions.js`: full marker set
- `openai-codex-responses.js`: `start`, `done`, `error`
- `azure-openai-responses.js`: `start`, `done`, `error`
- `anthropic.js`: full marker set
- `google.js`: full marker set
- `google-vertex.js`: full marker set
- `google-gemini-cli.js`: full marker set
- `amazon-bedrock.js`: full marker set
- `openai-responses-shared.js`: internal shared emission for granular markers

## Harness Marker Schema Contract

Implemented as **TaggedStruct + Union** in `src/lib/harness/schemas.ts`:

- `provider:marker/start`
- `provider:marker/text_start`
- `provider:marker/text_delta`
- `provider:marker/text_end`
- `provider:marker/thinking_start`
- `provider:marker/thinking_delta`
- `provider:marker/thinking_end`
- `provider:marker/toolcall_start`
- `provider:marker/toolcall_delta`
- `provider:marker/toolcall_end`
- `provider:marker/done`
- `provider:marker/error`
- `provider:marker/unknown` (forward-compat fallback)

Union:
- `HarnessProviderMarkerKnown`
- `HarnessProviderMarker`

Event projection:
- `chat:v2/provider_marker` with payload `{ marker: HarnessProviderMarker }`

## Adapter & Engine Behavior

### Adapter (`PiAiEventAdapter`)

- `toProviderMarker(event)` maps raw provider stream events to tagged marker union.
- Invalid/incomplete marker payloads become `provider:marker/unknown` (not dropped).
- Existing `adapt(event)` path remains for semantic events used by current UI (`assistant_delta`, `thinking_delta`, `tool_event` mapping).

### Engine (`PiAiHarnessEngine`)

For every raw stream event from pi-ai:

1. emit `chat:v2/provider_marker`
2. run semantic adapter mapping and emit existing higher-level events

This preserves backward compatibility while enabling full-fidelity custom pipelines.

## Why TaggedStruct + Union

- Deterministic partitioning by `marker._tag`
- Exhaustive pattern matching in Effect/TS codepaths
- Safer forward evolution via explicit `provider:marker/unknown`

## Test Coverage

Added/updated:

- `src/lib/harness/__tests__/PiAiEventAdapter.test.ts`
  - known marker mapping assertions
  - unknown marker fallback assertion
- `src/lib/harness/__tests__/PiAiHarnessEngine.integration.test.ts`
  - asserts `chat:v2/provider_marker` presence in live runs

## Consumer Guidance

- Existing consumers can ignore `chat:v2/provider_marker` safely.
- New render pipelines should consume `runtime.events` and match:
  - `event._tag === 'chat:v2/provider_marker'`
  - then branch on `event.marker._tag` for granular rendering/telemetry.

## Non-goals (this phase)

- Replacing current higher-level message aggregation logic in `PiProvider`.
- Removing `assistant_delta` / `tool_event` projections.

Those remain by design to avoid breaking existing chat-v2 consumers.
