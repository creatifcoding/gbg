# GBG TMNL harness tool-enablement map

Status: cleaned synthesis from the tools scout output. Scope: `packages/tmnl/src/lib/harness` plus direct Genifer/GEOINT/interactive-shell bridges in the GBG repo.

## Executive finding

The harness tool system is a server-side capability runtime, not a frontend feature. Pi only needs a **tool manifest + streamed tool results**. The sophisticated parts—builtin SDK tools, allowlisted Pi extension tools, prompt mutation, PTY sessions, panel spawning, Genifer surfaces, GEOINT actions, progressive details, and concurrency policy—live behind `PiAiToolRuntime` and Effect services.

## Evidence anchors

- `packages/tmnl/src/lib/harness/PiAiToolRuntime.ts`
- `packages/tmnl/src/lib/harness/PiAiToolRuntimeBuiltins.ts`
- `packages/tmnl/src/lib/harness/tools/registry.ts`
- `packages/tmnl/src/lib/harness/tools/*.ts`
- `packages/tmnl/src/lib/harness/prompt/tools/prompt-context-tool.ts`
- `packages/tmnl/src/lib/harness/interactive-shell/tool.ts`
- `packages/tmnl/src/lib/harness/interactive-shell/InteractiveShellService.ts`
- `packages/tmnl/src/lib/genifer/harness/bridge.ts`
- `packages/tmnl/src/lib/genifer/harness/spawn-panel-tool.ts`
- `packages/tmnl/src/lib/geoint/harness/bridge.ts`
- `packages/tmnl/src/lib/harness/PiAiHarnessEngine.ts`
- `packages/tmnl/src/lib/agents/AgentHarnessConfig.ts`

## Tool runtime port

`PiAiToolRuntime.ts` is intentionally tiny and stable:

- `tools`: active tool manifest for the model/session;
- `maxToolRounds`: hard stop for repeated model/tool loops;
- `concurrentFriendlyTools`: opt-in set for tools safe to run concurrently;
- `execute(toolCall, onStreamChunk?, signal?)`: Effectful bridge from pi-ai tool calls to actual handlers.

The default live runtime returns a “No harness tool handler registered” tool result. The real capability set is installed by `PiAiToolRuntimeWithBuiltins`.

## Live tool assembly

`PiAiToolRuntimeBuiltins.ts` builds the active tool surface in ordered layers:

1. **Pi SDK builtins** from `@mariozechner/pi-coding-agent`:
   - `read`
   - `bash`
   - `edit`
   - `write`
   - `grep`
   - `find`
   - `ls`
2. **Allowlisted extension tools** discovered through Pi extension loading.
3. **Genifer tools** when Genifer DB/service dependencies are available.
4. **`spawn_panel`** when Genifer service and `PanelEventBus` are available.
5. **GEOINT tools** when `GeointHarnessService` is available.
6. **`interactive_shell`** when shared `InteractiveShellService` is in context.

Collisions are explicit: built-ins win; shadowing extension/domain tools are skipped with warnings.

## Extension boundary

The harness can load Pi extension tools without running the Pi frontend:

- It calls `discoverAndLoadExtensions(...)` from `@mariozechner/pi-coding-agent`.
- Extension discovery is allowlist-based through:
  - `TMNL_HARNESS_PI_EXTENSIONS`
  - `TMNL_HARNESS_PI_EXTENSION_ALLOWLIST`
  - `TMNL_GLOBAL_PI_AGENT_DIR`
  - `TMNL_HARNESS_PI_AGENT_DIR`
- It creates a harness-local `.pi/harness-agent` discovery area.
- It wraps each `RegisteredTool` with a minimal headless `ExtensionContext`:
  - `hasUI: false`
  - `cwd` set
  - UI/session methods stubbed or graceful-failing
  - model registry/session manager unavailable unless a tool handles absence.

Implication: tools can hook directly into the model loop through Pi’s extension contract, while UI-specific extension behavior fails gracefully rather than coupling the harness to a frontend.

## Declarative tool registry path

`tools/registry.ts` provides a second, declarative pattern:

- `defineTool(...)` registers typed descriptors.
- Tool descriptors specify `requires` dependencies, optional vs required.
- `collectTools()` resolves dependencies in parallel and skips unavailable tools.
- Prompt sections can be contributed by tools.
- `concurrentFriendly` is attached at definition time.

This is not the primary live assembly path in the current harness layer, but it is strong evidence of the intended SDK direction: service-gated tool catalogs instead of a static array.

## Prompt/context tools

The harness injects codemode-like prompt self-modification into the tool loop:

- `prompt_context` is added when the session has a `PromptRegistry`.
- `PiAiHarnessEngine` intercepts this tool before normal runtime dispatch.
- The tool evaluates a restricted code surface over `PromptRegistry`.
- Registry safeguards include reserved keys, prompt budgets, and section priorities.

`panel_eval` is also injected when a `PanelQueryService` exists; current implementation is scaffolded/stub-like compared with `prompt_context`.

## Streaming bridge

The tool runtime bridges Promise-style SDK tool updates to Effect/harness events:

- Pi SDK tools can call `onUpdate` with a rolling content buffer.
- `PiAiToolRuntimeBuiltins.ts` diffs the rolling buffer against prior length to emit only new `ToolStreamChunk`s.
- Chunk events are sent through `onStreamChunk` without blocking the SDK execution loop.
- Chunks with `details` also feed harness `phase:'update'` tool events in `PiAiHarnessEngine`.
- Final results become `phase:'end'` tool events and are appended back to the model conversation context.

## Rounds, timeouts, and concurrency

The tool loop in `PiAiHarnessEngine.ts` enforces:

- `maxToolRounds` from `AgentHarnessConfig` / runtime config;
- per-tool timeout via `PiAiPolicyConfig.toolTimeoutMs`;
- exemption patterns through `unboundedToolPatterns`;
- sequential execution by default;
- parallel execution only for tools listed in `concurrentFriendlyTools`;
- deterministic merge of parallel/sequential results back into original tool-call order.

Current explicit concurrent-friendly behavior is deliberately narrow: `spawn_panel` is the canonical fire-and-forget concurrent tool.

## Interactive shell proof point

`interactive_shell` is the strongest “this can get sophisticated” proof:

- supports interactive, hands-free, dispatch/background, attach, list, dismiss, query, input, resize/control modes;
- has query throttling and output caps;
- has a PTY worker runner and replay/session atoms;
- exposes a single model tool while internally managing long-running terminal state.

This demonstrates the harness can present complex interactive workflows to a model without entangling those workflows with the frontend.

## Genifer / GEOINT domain tools

Genifer and GEOINT tools show domain-specific capability injection:

- Genifer bridge exposes generate/refine/query style tools and can allocate streaming surfaces.
- `spawn_panel` allocates a Genifer surface, runs background generation, updates atoms directly, and emits `PanelEventBus` events for remote observers.
- GEOINT bridge exposes entity/search/plan/map operations through `GeointHarnessService`.

These are optional: service absence causes graceful “tool unavailable” behavior instead of crashing the harness.

## Security / safety posture

Observed safety controls:

- extension allowlist instead of loading arbitrary extensions;
- minimal headless extension context with UI/session unavailable;
- built-ins shadow extension names;
- service-gated optional tools;
- reserved prompt registry keys and prompt budget enforcement;
- shell rate limits and output caps;
- per-tool timeout policy with explicit unbounded exemptions;
- sequential-by-default execution.

This is capability gating, not UI gating. The harness can run headlessly and still enforce the tool boundary.

## Bottom line

Tool enablement is a manifest-driven, service-composed, headless-capable runtime. The model sees tools and tool results. The frontend, if attached, sees events. The true capability boundary is the Effect tool runtime and extension/service policy layer.

## Validation evidence noted by scout

- `prompt-context-tool.test.ts`
- `tools/__tests__/registry.test.ts`
- `interactive-shell/__tests__/tool-executor.test.ts`
- `genifer/harness/__tests__/spawn-panel-tool.test.ts`
- `geoint/harness/__tests__/tools.test.ts`
