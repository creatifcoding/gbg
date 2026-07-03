# Context: TMNL harness/UI decoupling

## Core seam map
- `HarnessRuntime` is the stable contract: open/resume/send/getSnapshot/abort/list/update/delete/fork/respond/events. `packages/tmnl/src/lib/harness/HarnessRuntime.ts:66-107`
- `HarnessRuntimeLive` is server-only and binds that contract directly to `PiAiHarnessEngine`, plus `InteractiveShellServiceLive` and `PanelEventBusLive`. `packages/tmnl/src/lib/harness/HarnessRuntimeLive.ts:1-4,27-145`
- `HarnessRemoteWsServer` is the WS bridge; it relays `runtime.events`, shell events, and panel events, and handles remote commands for sessions/tools/snapshot. `packages/tmnl/src/lib/harness/server/HarnessRemoteWsServer.ts:34-35,267-360,437-479,591-620`
- `HarnessRuntimeBrowser` maps remote commands to runtime ops and only forwards `remote:chat_v2_event` into its `events` stream. `packages/tmnl/src/lib/harness/HarnessRuntimeBrowser.ts:203-425`

## Frontend consumers
- `PiProvider` converts `HarnessEvent` into `RenderReducerInput`, gates by session/seq, syncs snapshot after send, and emits reducer metrics. `packages/tmnl/src/lib/ai-core/providers/pi/PiProvider.ts:209-415,565-727,845-882`
- `harness-adapter` also consumes `runtime.events` and `runtime.getSnapshot()` for browser surfaces. `packages/tmnl/src/lib/morphchat/adapters/harness-adapter.ts:584-730`
- `harness-event-processor` handles structured chat parts for assistant/tool/marker events. `packages/tmnl/src/lib/morphchat/adapters/harness-event-processor.ts:611-1026`

## Rendering layer
- `OverlayReducerPipeline` is separate from runtime; it batches, bypasses immediate classes, and emits reducer emissions. `packages/tmnl/src/lib/harness/rendering/OverlayReducerPipeline.ts:24-246`
- Docs recommend hot ingest + frame flush, explicit metrics, and no silent drop of unknown markers. `packages/tmnl/src/lib/harness/docs/rendering/custom-rendering-pipeline-architecture.md:11-173`; `packages/tmnl/src/lib/harness/docs/rendering/custom-rendering-observability.md:9-160`

## Critical evidence
- Browser-safe barrel: `packages/tmnl/src/lib/harness/index.ts:1-9`
- Server-only barrel: `packages/tmnl/src/lib/harness/index.server.ts:1-18`
- Browser WS URL overrides: `packages/tmnl/src/lib/harness/HarnessBrowserTransport.ts:51-94`
- Browser remote event schema includes chat, shell, panel envelopes: `packages/tmnl/src/lib/harness/HarnessBrowserRemoteSchemas.ts:91-225`
- Provider marker spec: exhaustive marker union + `chat:v2/provider_marker` projection. `packages/tmnl/src/lib/harness/docs/specs/harness-provider-markers-spec.md:7-118`
- Headless operator guide: no-UI smoke run, session open/send/final/metrics flow. `packages/tmnl/src/lib/harness/docs/migration/conductor-piai-harness-operator-guide.md:8-82,84-117`

## Constraints / risks
- Browser runtime currently drops non-chat WS events; shell/panel need a separate projection if they must reach the frontend.
- `PiProvider` snapshot-sync-after-send is part of the race-avoidance path.
- Keep renderer and runtime decoupled; reducer belongs to consumer layer.
