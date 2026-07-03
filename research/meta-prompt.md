# Meta-prompt: TMNL harness/UI decoupling follow-up

## Goal
Produce a clear implementation-ready map of how GBG TMNL can run headlessly and how browser/frontend consumers attach through remote harness seams, without re-discovering the architecture.

## Evidence-backed facts
- Headless runtime: `HarnessRuntimeLive` -> `PiAiHarnessEngine` (session lifecycle, snapshots, list/fork/delete, events). `packages/tmnl/src/lib/harness/HarnessRuntimeLive.ts:1-145`; `packages/tmnl/src/lib/harness/PiAiHarnessEngine.ts:105-142,253-337,1639-2172`
- Browser seam: `HarnessRuntimeBrowser` maps `remote:*` commands to runtime methods and only forwards `remote:chat_v2_event`. `packages/tmnl/src/lib/harness/HarnessRuntimeBrowser.ts:203-425`
- WS bridge: `HarnessRemoteWsServer` relays runtime/shell/panel events and handles commands. `packages/tmnl/src/lib/harness/server/HarnessRemoteWsServer.ts:267-360,437-479,591-620`
- Frontend consumers: `PiProvider` and `harness-adapter` both consume runtime events and snapshots. `packages/tmnl/src/lib/ai-core/providers/pi/PiProvider.ts:209-727`; `packages/tmnl/src/lib/morphchat/adapters/harness-adapter.ts:584-730`
- Rendering decoupling: `OverlayReducerPipeline` is a consumer-side transform layer with batching and metrics. `packages/tmnl/src/lib/harness/rendering/OverlayReducerPipeline.ts:24-246`

## Success criteria
- Explain how the harness can run without a browser/UI client.
- Explain how browser clients open sessions, send prompts, replay snapshots, and consume events.
- Explain what events are currently forwarded vs dropped (chat vs shell/panel).
- Include a concise visual explainer (lanes/cards) that makes the seams obvious.

## Hard constraints
- Research only; no code edits.
- Do not inspect ignored/token-bearing files or perform credential/token actions.
- Do not launch subagents or contact pi_messenger.

## Suggested approach
- Keep the final note structured by seam: runtime, WS bridge, browser transport, frontend projection, rendering pipeline.
- Call out exact file evidence for every important claim.
- Separate observed facts from inferred architecture.

## Validation
- Cross-check the runtime API surface against browser command mapping.
- Cross-check event relays in WS server against browser runtime filtering.
- Cross-check frontend snapshot-sync and reducer metrics in `PiProvider`.

## Stop/escalation rules
- If a seam is only implied and not directly observed in the repo, say so explicitly instead of guessing.
- Escalate only if a decision depends on missing product intent (e.g. whether panel/shell events should reach browser consumers).

## Resolved assumptions
- The intended browser frontend today is `PiProvider`/MorphChat-style consumers, not a direct engine UI.
- `chat:v2/provider_marker` is the primary low-level stream for custom rendering.
