# RFC: TMNL React Native Migration

**Status:** Draft 0  
**Owner:** VAL  
**Date:** 2026-06-08  
**Scope:** TMNL `src/lib/*` consolidation, Effect v4 upgrade, React Native application architecture, native platform adaptation, and harness/API redesign.

> Prime, the point is not to squeeze the Tauri app into a phone-shaped box. The point is to extract TMNL's logic, upgrade the runtime spine, and rebuild the surfaces as native, touch-first HMI primitives. No WebView taxidermy.

---

## 1. Decision Summary

TMNL will gain a **new React Native application path** while preserving the current Tauri app.

The React Native path will:

1. Use **Expo + Expo Router** as the primary application shell for immediate iPhone/iPad/Android/Web preview iteration.
2. Support the Zenbook through a staged native adaptation path:
   - immediate: Expo Web touch preview on Zenbook;
   - near-term: React Native Windows native target;
   - later: macOS target and Linux-native spike;
   - fallback coexistence: current Tauri app remains valid and is not deleted.
3. Extract and consolidate `src/lib/*` into **three-letter domain/runtime packages** plus **2–3 letter UI internals**.
4. Upgrade the shared logic to **Effect v4 / effect-smol**.
5. Use **effect-atom / STX as primary React state**.
6. Treat the **harness** as a central API/codemode substrate, not merely a UI feature.
7. Rewrite web-only surfaces as native adapters using Skia, Reanimated, Gesture Handler, native lists, native maps, and native charting.

---

## 2. Explicit Non-Decision: Tauri Is Not Being Removed

The existing Tauri app remains.

This migration does **not** require deleting, replacing, or freezing the current desktop implementation. Tauri continues to be useful for:

- full desktop shell experiments;
- local process/PTY integration;
- browser/DOM-heavy legacy surfaces;
- parity validation while RN-native surfaces mature;
- native shell operations that are not available on mobile.

The React Native app is a sibling path and shared-core consumer, not a hostile takeover.

---

## 3. Platform Strategy

### 3.1 First-class requested targets

| Target | Strategy | RFC confidence |
| --- | --- | --- |
| iPhone / iPad | Expo app, physical device via Expo Go first, dev build when native modules demand it | High |
| Android phone/tablet | Expo app, physical device via Expo Go first, dev build when native modules demand it | High |
| Zenbook touch / dual-screen | Expo Web preview immediately; React Native Windows native path for real desktop-native work | Medium |
| Windows desktop | React Native Windows adapter around shared core | Medium |
| macOS desktop | React Native macOS adapter around shared core | Medium |
| Linux desktop | R&D spike; do not block v1 shell on Linux-native parity | Low/medium |
| Web preview | Expo Web for fast touch/layout testing, not the canonical production runtime | High |

### 3.2 Native adaptation rule

Do not branch UI by crude platform checks alone.

Use a **capability-driven adapter model**:

```ts
PlatformCapability = {
  os: "ios" | "android" | "windows" | "macos" | "linux" | "web"
  formFactor: "phone" | "tablet" | "desktop" | "foldable" | "dual-screen" | "console"
  input: readonly ("touch" | "mouse" | "keyboard" | "pen" | "gamepad")[]
  screenTopology: "single" | "external" | "dual" | "folding" | "unknown"
  pointerPrecision: "coarse" | "fine" | "mixed"
  haptics: boolean
  localProcess: boolean
  localFilesystem: "none" | "sandboxed" | "user-visible" | "full"
  nativeWindows: boolean
}
```

The Zenbook and iPhone then become different capability profiles, not different codebases:

- **iPhone:** single screen, touch, haptics, safe-area constrained, sandboxed filesystem, no local process execution.
- **Zenbook:** mixed pointer/touch/keyboard, potential dual-screen topology, desktop windowing, larger panel density, possible local harness sidecars depending on runtime.

This is the native way to adapt. Not “mobile layout” vs “desktop layout”; **capability-shaped HMI surfaces**.

---

## 4. Effect v4 Doctrine

Primary sources:

- `../../submodules/effect-smol/MIGRATION.md`
- `../../submodules/effect-smol/migration/services.md`
- `../../submodules/effect-smol/migration/schema.md`
- `/home/getbygenius/.pi/agent/skills/effect-v4-atom/SKILL.md`
- `/home/getbygenius/.pi/agent/skills/effect-v4-services/SKILL.md`
- `/home/getbygenius/.pi/agent/skills/effect-v4-schema/SKILL.md`

### 4.1 Imports

Use v4 imports:

```ts
import { Context, Effect, Layer, Schema } from "effect"
import { Atom, AtomRegistry, Reactivity } from "effect/unstable/reactivity"
```

React hooks remain in the React binding package:

```ts
import { RegistryProvider, useAtomValue, useAtomSet } from "@effect/atom-react"
```

### 4.2 Services

Effect v3 patterns such as `Effect.Service` / auto `.Default` layers must migrate to explicit v4 services:

```ts
class HarnessApi extends Context.Service<HarnessApi, {
  readonly call: (request: HarnessRequest) => Effect.Effect<HarnessResponse, HarnessError>
}>()("tmnl/hrn/HarnessApi") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      return HarnessApi.of({
        call: (request) => Effect.gen(function* () {
          // implementation
        })
      })
    })
  )
}
```

Rules:

- `Context.Service` replaces v3-style service tags for new code.
- No assumed `.Default` layer; define `static readonly layer` explicitly.
- Dependencies are wired via `Layer.provide`, not `dependencies: [...]`.
- Prefer `yield* Service` inside `Effect.gen` over static accessor tricks.

### 4.3 Schema

Effect v4 Schema changes matter here. The current project instructions mention `Schema.TaggedStruct`, but v4 removes that API.

Use one of:

```ts
class ToolCall extends Schema.TaggedClass<ToolCall>()("ToolCall", {
  id: Schema.String,
  tool: Schema.String,
  input: Schema.Unknown
}) {}
```

or:

```ts
const ToolCall = Schema.Struct({
  _tag: Schema.tag("ToolCall"),
  id: Schema.String,
  tool: Schema.String,
  input: Schema.Unknown
})
```

Rules:

- `Schema.Literal("a", "b")` becomes `Schema.Literals(["a", "b"])`.
- `Schema.Union(A, B)` becomes `Schema.Union([A, B])`.
- `Schema.Tuple(A, B)` becomes `Schema.Tuple([A, B])`.
- filters move to `.check(...)` / v4 filter helpers.
- payloads crossing API/harness boundaries must be Schema-backed.

### 4.4 Atom-as-State / STX

For React-consumed state:

```ts
const sessionsAtom = Atom.make<readonly HarnessSession[]>([])

const startSession = harnessRuntime.fn<StartSessionInput>()((input, ctx) =>
  Effect.gen(function* () {
    const api = yield* HarnessApi
    const session = yield* api.start(input)
    ctx.set(sessionsAtom, [...ctx.get(sessionsAtom), session])
  })
)
```

Rules:

- State lives in atoms when React consumes it.
- Services and runtime functions mutate atoms directly via atom contexts.
- Avoid `Effect.Ref -> Atom` bridges for UI state.
- STX becomes the shared declarative state-transition substrate.
- `Effect.Ref` remains acceptable for internal non-React runtime mechanics, but not as the canonical UI state store.

### 4.5 Effect runtime primitive baseline

TMNL RN is not “React with a sprinkle of Effect.” Effect is the operational calculus.

The shared core must assume first-class use of:

- `Stream` for session events, progressive rendering, log tails, tool output, and sensor/HMI feeds;
- `Queue` for UI/action mailboxes, tool-event buffers, command dispatch, and backpressure boundaries;
- `Deferred` for request/response joins, modal decisions, confirmation gates, and in-flight command completion;
- `Schedule` for retry, polling where explicitly justified, exponential backoff, heartbeat, debouncing, and watchdogs;
- `Duration` for every timeout, delay, TTL, animation budget, and quiet-window contract;
- spans via `Effect.withSpan` / annotations for harness observability and replay diagnostics;
- `Effect.fn` for named operational units with traceable labels;
- `Exit` for preserving success/failure/cause outcomes across API boundaries;
- `Match` for exhaustive branching over commands, events, platform capabilities, and schema tags;
- `pipe()` / data-last combinators for readable transformation chains;
- `tap`, `tapError`, `tapBoth`, and related combinators for observability without corrupting values.

Canonical import shape:

```ts
import {
  Deferred,
  Duration,
  Effect,
  Exit,
  Match,
  Queue,
  Schedule,
  Stream
} from "effect"
import { pipe } from "effect/Function"
```

Design rule:

```txt
If a workflow crosses time, concurrency, cancellation, retry, streaming, or observability,
it is an Effect program — not a loose async function with vibes.
```

This includes animation sequences, codemode transactions, pi-session streams, release lanes, command dispatch, and touch/HMI control loops.

---

## 5. Package and Namespace Topology

### 5.1 Naming rule

- Domain/runtime modules: **three-letter package/module names**.
- UI internals: **two or three letters** are acceptable.
- Existing four-letter `tmnl` can remain the legacy app/package identity; new internals should use the tighter convention.

### 5.2 Proposed package groups

| Proposed package | Meaning | Source candidates |
| --- | --- | --- |
| `stx` | State transition substrate, atom doctrine, transition algebra | `src/lib/stx`, `selection-stx`, `drag-stx`, `transfer-stx`, `theia-stx` |
| `hrn` | Harness runtime native/API substrate | `src/lib/harness`, `src/lib/agents`, `src/lib/session` |
| `ava` | Assistant/session/client domain | `src/lib/ava`, parts of `ai-core`, `chat`, `morphchat` |
| `nex` | NATS/execution/transport messaging | `src/lib/nex`, `src/lib/nats`, `src/lib/holonet` |
| `rvn` | React Visual Native shell / tactical UI system | `src/lib/rvn`, `layout`, `shell`, `drawer`, `panels`, `overlays` |
| `hmi` | Touch-first HMI controls and interaction surfaces | `slider`, `animation`, `motion`, `drag`, `selection`, `transfer` |
| `dat` | Dataplane, data-manager, search/table models | `data-manager`, `dataplane`, `table-service`, `search` |
| `geo` | GEOINT/map/workspace domain | `geoint`, map adapters, MapLibre/Mapbox integration |
| `ecs` | Entity/component/state modeling | `src/lib/ecs`, entity systems in `iiot`, `geoint`, `prospects` |
| `ams` | Asset management schemas and constrained assets | `src/lib/ams` |
| `rag` | Retrieval and indexed context | `src/lib/rag`, `file-index`, parts of `indices` |
| `mcp` | MCP configs/transports/API bridge | `src/lib/mcp` |
| `pty` | PTY/terminal process boundary | `src/lib/pty`, `terminal` |

### 5.3 UI internal namespaces

| Namespace | Meaning | Collapse candidates |
| --- | --- | --- |
| `ui` | Primitive native components and token bridge | `tmnl-ui`, `fui`, `rvn/baseui` |
| `ly` | Layout grammar | `layout`, `shell`, panel layout primitives |
| `pn` | Panels | `panels`, `foldable-panel`, `sidebar` |
| `drw` | Drawers | `drawer` |
| `ov` | Overlays | `overlays`, floating overlays |
| `dg` | Data-grid native surface | `data-grid`, `table-service` renderers |
| `ch` | Chat visual primitives | `chat`, `chat-shell`, `morphchat/components` |
| `mp` | Map visual primitives | `geoint/map`, native map adapters |
| `ed` | Editor/code surfaces | `editor`, `code-editor`, `editor-ai` |

---

## 6. Consolidation Plan for `src/lib/*`

### 6.1 One RN design system

Collapse:

- `src/lib/tmnl-ui`
- `src/lib/fui`
- `src/lib/rvn/baseui`
- token fragments in `chat`, `geoint`, `file-browser`, `capabilities`, `scale`

Into native `ui` primitives:

- tokens;
- typography with 12px minimum rule preserved;
- color/elevation/scanline styles;
- safe-area and density adapters;
- pressable/touch semantics;
- accessibility defaults.

### 6.2 One shell/chrome system

Collapse:

- `src/lib/layout`
- `src/lib/shell`
- `src/lib/drawer`
- `src/lib/panels`
- `src/lib/sidebar`
- `src/lib/foldable-panel`
- `src/lib/overlays`
- `src/lib/windows`
- `src/lib/bar`

Into `rvn` + UI namespaces:

- workspace shell;
- panel stack;
- adaptive drawer;
- overlay registry;
- window/pane abstraction;
- dual-screen layout policy.

### 6.3 One interaction engine

Collapse:

- `src/lib/animation`
- `src/lib/motion`
- `src/lib/drag`
- `src/lib/scroll`
- `src/lib/selection`
- `src/lib/transfer`

Into `hmi`:

- Gesture Handler/Reanimated event substrate;
- Skia reticles and selection visuals;
- touch-first sliders;
- scroll-follow and kinetic gestures;
- transfer/drop interactions;
- Effect spans for sequence observability and cancellation.

### 6.4 One harness/API substrate

Promote `src/lib/harness` into `hrn`.

The harness becomes the central API/codemode system:

- typed API registry;
- tool schemas;
- codemode API execution;
- local/remote transport adapters;
- session event log;
- streaming protocol;
- mobile-safe remote execution;
- desktop local sidecar execution;
- NEX/NATS bridge where appropriate.

Mobile cannot assume local process execution. Desktop can. The harness API must express that capability honestly.

### 6.5 Adapter-backed visualization layer

Do not port these as raw DOM components:

- `src/lib/data-grid/adapters/tldraw`
- `src/lib/charting/v2/adapters/echarts`
- `src/lib/charting/v2/adapters/scichart`
- `src/lib/editor`
- `src/lib/code-editor`
- `src/lib/floating`

Instead preserve their models and reimplement renderers:

- data grid: FlashList/LegendList + headless table model;
- canvas/tldraw-like workspace: Skia + Gesture Handler + command stack;
- charts: Victory Native / Skia charts first, bespoke Skia instruments second;
- maps: MapLibre RN first, Mapbox only if proprietary Mapbox features are required;
- GL: Expo GL / native GL only for specialized simulation or 3D surfaces.

---

## 7. HMI / Touch Vertical Slice

The first implementation slice should prove the substrate, not the whole empire.

### 7.1 Slice scope

Build a native HMI shell with:

- Expo Router app shell;
- Effect v4 runtime layer;
- AtomRegistry provider;
- token bridge;
- adaptive panel layout;
- drawer;
- touch slider;
- animated reticle/overlay;
- basic harness API call surface;
- platform capability probe;
- iPhone + Zenbook Web preview smoke path.

### 7.2 Success criteria

- Runs on iPhone through Expo Go or a dev build.
- Runs on Zenbook immediately through Expo Web touch preview.
- Uses STX/effect-atom for visible state.
- Uses Reanimated/Gesture Handler for touch interactions.
- Uses Skia for at least one non-trivial visual overlay/reticle.
- Does not import DOM-specific APIs in shared native code.
- Does not require deleting or destabilizing the Tauri app.

### 7.3 Capability-aware first slice plan

The first slice is not “build the app.” It is a tight proof that platform capability, remote session authority, STX lifecycle, and native HMI rendering are one coherent spine.

| Milestone | Build profile | Capability posture | Delivered proof |
| --- | --- | --- | --- |
| M0 — Expo Go cockpit | Expo Go + Expo Router | bundled native modules only; remote/proxy execution | phone opens a remote pi session, renders session status, opens mobile command deck, and shows access decisions before commands |
| M1 — Skia/reticle surface | Expo Go if bundled Skia works; otherwise dev build | `surface.reticle.overlay` / `surface.lottie.preview` resolve to local Skia or fallback | touch reticle and/or Skottie preview runs under a `SurfaceActor` lifecycle |
| M2 — Approval/proxy flow | Expo Go or dev build | `shell.run` on phone resolves to `proxy` or `requires-approval` | user sees host picker / approval sheet; command executes remotely; EventLog records decision + lifecycle |
| M3 — Dev build promotion | development build | custom native modules/config plugins allowed | same contracts run with expanded native capability pack; no public API changes |

First slice route sketch:

```txt
app/_layout.tsx
  Registry/runtime providers

app/(sessions)/index.tsx
  known remote PiSessionRuntime hosts

app/(sessions)/[sessionId].tsx
  session event stream + status + command deck entry

app/surfaces/[surfaceId].tsx
  UiSurfaceDefinition lookup + SurfaceActor mount

app/approvals/[requestId].tsx
  scoped approval sheet for proxy/destructive actions
```

First slice command flow:

```txt
user taps command
→ build AccessRequest
→ CapabilityAccessRuntime.resolveAccess(request)
→ AccessDecision(result = allow | proxy | requires-approval | degrade | deny | unavailable)
→ send SurfaceActor event
→ render platform variant
→ execute through PiSessionRuntime provider if authorized
→ append EventLog event
→ update @tmnl/stx atom projection
```

Non-goals for the first slice:

- no local mobile shell execution;
- no AG Grid or tldraw parity work;
- no generated UI promotion beyond one controlled built-in surface;
- no deep native module authoring before the Expo Go cockpit proves the contract.

---

## 8. Research Matrix

| Subsystem | Native candidate | Decision |
| --- | --- | --- |
| App shell | Expo + Expo Router | Adopt for mobile/web preview |
| Native graphics | `@shopify/react-native-skia` | Adopt for custom HMI/canvas/reticles |
| Gestures | `react-native-gesture-handler` | Adopt |
| Animation | `react-native-reanimated` | Adopt |
| Lists/grids | FlashList, LegendList | Evaluate in grid prototype; FlashList default |
| Charts | Victory Native, Skia custom charts | Evaluate; prefer Skia-aligned stack |
| Maps | MapLibre RN, Mapbox RN optional | MapLibre default |
| GL | Expo GL | Optional specialized surface |
| Web grid | AG Grid | Legacy/web adapter only |
| Web canvas | tldraw | Preserve model ideas; do not native-port DOM renderer |
| Desktop Windows | React Native Windows | Spike after HMI slice |
| Desktop macOS | React Native macOS | Spike after Windows path |
| Desktop Linux | RN Skia renderer / RN Web shell / R&D | Do not block v1 |

---

## 9. Web-only Hazard Inventory

Known high-risk paths from reconnaissance:

- `src/lib/selection/SelectionOverlay.tsx`
- `src/lib/selection/selection-stx.ts`
- `src/lib/scroll/use-tail-follow.tsx`
- `src/lib/transfer/v2/overlay/TransferOverlay.tsx`
- `src/lib/floating/layout/ChromeButton.tsx`
- `src/lib/charting/v2/adapters/echarts/lifecycle.ts`
- `src/lib/charting/v2/adapters/scichart/lifecycle.ts`
- `src/lib/charting/v1/Chart.ts`
- `src/lib/data-grid/adapters/tldraw/index.ts`
- `src/lib/dataplane/components/DataplaneVisualizer.tsx`
- `src/lib/animation/drivers/animejs.ts`
- `src/lib/cursor/components/DynamicIsland.tsx`

Audit rule:

```txt
If a shared module imports window/document/HTMLElement/CSS layout/browser observers,
it is not shared-native code. Move it behind a platform adapter.
```

---

## 10. Harness Redesign Direction

The harness is not merely a chat runner. It becomes the **API operating layer**.

### 10.1 Harness responsibilities

- Own typed API/codemode contracts.
- Normalize local and remote tool execution.
- Expose transport-agnostic session events.
- Provide mobile-safe execution paths.
- Support desktop sidecars for local tools/processes.
- Preserve replayability and event logs.
- Integrate with NEX/NATS where distributed execution is useful.

### 10.2 Harness API shape

All harness APIs should be Schema-backed:

```ts
class ApiCall extends Schema.TaggedClass<ApiCall>()("ApiCall", {
  id: Schema.String,
  namespace: Schema.String,
  method: Schema.String,
  input: Schema.Unknown,
  requestedAt: Schema.Date
}) {}

class ApiResult extends Schema.TaggedClass<ApiResult>()("ApiResult", {
  id: Schema.String,
  ok: Schema.Boolean,
  output: Schema.Unknown,
  completedAt: Schema.Date
}) {}
```

Potential namespaces:

- `fs.*` — file APIs, adapter-backed;
- `codemode.*` — codemode APIs and mutation engines;
- `agent.*` — session/agent APIs;
- `search.*` — code/docs/search APIs;
- `device.*` — platform capabilities, haptics, sensors;
- `hmi.*` — UI/HMI runtime controls;
- `nex.*` — messaging and distributed execution.

### 10.3 Mobile vs desktop execution

Phone-local pi sessions are **table stakes**, not a philosophical debate. The architecture must support them through capability-specific runtimes instead of pretending every platform exposes the same process model.

| Capability | iPhone | Android | Zenbook RN Windows | Existing Tauri |
| --- | --- | --- | --- | --- |
| Pi session UI | Native RN client | Native RN client | Native RN client | Existing/web UI |
| Remote pi session | WebSocket/API transport | WebSocket/API transport | WebSocket/API transport | WebSocket/API transport |
| Embedded JS sidecar | Node/Bun-compatible embedded runtime candidate | Node/Bun/Termux sidecar candidate | Bun/Node sidecar process | Bun/Node sidecar process |
| Rust native core | Static lib / Expo Module / TurboModule | Static lib / Expo Module / TurboModule | Native module / sidecar | Native module / sidecar |
| Local shell command | Capability-gated sidecar only | Termux or embedded sidecar path | Bun/native sidecar | Yes |
| Filesystem | Sandbox + document APIs | Sandbox + document APIs / Termux storage | User-granted desktop APIs | Yes |
| Local codemode API | Embedded/sidecar provider | Embedded/Termux/sidecar provider | Bun sidecar provider | Yes |
| NATS/NEX client | Network client | Network client | Network client | Network client |
| PTY | Embedded/remote adapter | Termux/native/remote adapter | Local sidecar | Local |

The user-facing invariant: **a phone can open, continue, and drive pi sessions**. The implementation may be remote, embedded, or sidecar-backed depending on platform capability.

### 10.4 Pi session runtime modes

The harness should expose one `PiSessionRuntime` interface with multiple providers:

1. **Remote provider** — phone/Zenbook RN app connects to an existing pi session host over WebSocket/HTTP/NEX. This is the first shippable path.
2. **Android Termux provider** — Android can run pi through Termux; Bun-on-Termux is an additional target. RN talks to it as a local sidecar.
3. **Embedded mobile provider** — package a JS/runtime sidecar into the app. Research targets include `nodejs-mobile-react-native`, Hermes Node-API work, and Bun mobile ports where practical.
4. **Rust provider** — native Rust core for hot-path harness primitives, filesystem adapters, crypto, event logs, and platform bridges via Expo Module/TurboModule/JSI.
5. **Desktop Bun provider** — Zenbook/Tauri/RN Windows runs Bun as the canonical local sidecar for codemode APIs, local tools, and pi session orchestration.

The phone does not need to pretend to be a Unix workstation. It needs a valid `PiSessionRuntime` provider. Different beast. Same contract.

### 10.5 Bun-first runtime rule

Bun is the default host runtime for TMNL-side tooling:

- Bun scripts in package manifests;
- Bun sidecars for desktop/CI/local harness APIs;
- Bun for Fastlane/FluentCI orchestration wrappers where the host permits it;
- Bun-compiled binaries where platform targets support them;
- JS bundles produced by Bun for embedded runtimes when the embedded runtime is not Bun itself.

If a mobile platform cannot run Bun directly yet, the adapter still remains Bun-shaped at the API/build boundary. We can swap the underlying engine without corrupting the harness contract. That is the whole point of having a contract, darling.

### 10.6 Codemode as UI control plane

Codemode exists so pi-session agents can **control the application**, not merely comment on it.

The rule: agents do not poke pixels. Agents emit typed, audited UI/API actions. The app interprets those actions through STX, capability checks, and command permissions.

Canonical action families:

```txt
ui.focusSurface
ui.openPanel
ui.closePanel
ui.setLayoutMode
ui.showOverlay
ui.dismissOverlay
ui.invokeCommand
ui.previewTransaction
ui.commitTransaction
editor.insertText
editor.replaceRange
editor.applyPatch
keyboard.showCommandDeck
keyboard.lockCustomInput
script.run
script.stop
release.fastlane.runLane
```

Every action is:

- Schema-backed;
- actor-attributed (`user`, `agent`, `script`, `system`);
- capability-checked;
- reversible where possible;
- logged into the session/event ledger;
- optionally gated by user confirmation for destructive operations.

This gives pi agents real hands without handing them a chainsaw in a dark room.

### 10.7 Live reprogrammability / Emacs rule

TMNL RN should be reprogrammable while running. The implementation has four strata:

1. **Stable native kernel** — RN shell, Skia surfaces, gesture adapters, storage, networking, native modules. Requires app rebuild when changed.
2. **Hot JS command layer** — commands, menus, which-key maps, panel schemas, STX transitions, and agent tools. Reloadable through Metro/Fast Refresh in dev and signed update bundles in deployed builds.
3. **Script layer** — Bun-authored scripts on desktop/CI; embedded/sidecar JS runtime on phone; Rust commands where performance or platform access demands it.
4. **Data layer** — command registry, keymaps, panel layouts, themes, prompt templates, agent manifests. Mutable at runtime with rollback.

A live patch flow should look like:

```txt
agent drafts command/plugin
→ codemode compiles/checks schema
→ runs in sandbox generation
→ user previews effect
→ promote generation
→ ledger records activation
→ rollback remains one command away
```

This is the Emacs inheritance worth stealing: not Lisp specifically, but **a live command graph that can rewrite itself under discipline**.

### 10.8 Input grammar: keyboard, touch keyboard, and which-key

The command system must work on laptop and phone, but it should not pretend those are the same instrument.

Input sources:

- hardware keyboard chords;
- touch gestures;
- custom soft keyboard / command deck;
- command palette / minibuffer;
- pen/touch HMI controls;
- agent-authored command suggestions;
- voice later, if useful.

Native strategy:

- **Hardware keyboard:** register global/scene key commands and chord sequences; show a which-key overlay after prefix keys.
- **iOS soft input:** use `InputAccessoryView` for toolbars and a custom input module when replacing the keyboard is required.
- **Android soft input:** use `showSoftInputOnFocus={false}` and a custom rendered command deck where appropriate; native module if deeper replacement is needed.
- **Touch command mode:** double-tap / two-finger tap / long-press opens a mobile which-key surface.
- **Mobile which-key:** not a tiny keyboard clone. Use radial groups, thumb zones, command cards, and progressive disclosure.
- **Zenbook which-key:** keyboard-first overlay plus touchable command panels for dual-screen workflows.

The shared abstraction is a `CommandIntent`, not a keypress:

```ts
class CommandIntent extends Schema.TaggedClass<CommandIntent>()("CommandIntent", {
  id: Schema.String,
  source: Schema.Literals(["hardware-keyboard", "soft-keyboard", "gesture", "palette", "agent", "script"]),
  commandId: Schema.String,
  args: Schema.Unknown,
  timestamp: Schema.Date
}) {}
```

Laptop and phone can invoke the same command through different rituals. Very civilized.

### 10.9 Pi client/host split

Preferred operational model:

```txt
TMNL RN = cockpit / HMI / command deck / session renderer
Real pi host = actual machine with files, shell, tools, sidecars, GPUs, CI, release credentials
```

That means the iPhone does not need to be the workstation. It can be the **control surface** for one or more real pi hosts.

Required capabilities:

- discover available pi hosts/sessions;
- attach/detach from sessions;
- drive prompts, steering, follow-ups, interrupts, tool approvals, and UI codemode actions;
- render session event streams;
- show host capability matrix before invoking commands;
- transfer artifacts/screenshots/files through explicit APIs;
- allow multiple host profiles: laptop, Zenbook, Tauri desktop, CI runner, Termux Android, remote server.

This is the practical path: run real pi where real machine access exists; let the phone become the sleek little command blade.

### 10.10 Design reference: tactical scrubber compound

Local reference inspected:

```txt
~/Downloads/tactical-scrubber-compound.zip
```

Useful design language to preserve/adapt:

- compressed idle state that expands under intent;
- orange optical reticle as the focus/commit line;
- ghost/phantom cursor for preview before action;
- vignettes at edges to imply an instrument viewport;
- precise mono readout with tabular timing;
- springy zoom between compressed and engaged states;
- haptic ticks on threshold crossing;
- section bands as semantic timeline regions;
- dark tactical substrate with sparse luminous accents;
- compound component API shape (`Root`, `Viewport`, `Header`, `Track`, `Footer`, `Reticle`).

RN translation:

- replace DOM pointer events with Gesture Handler gestures;
- replace SVG reticle/ticks with Skia paths/text;
- replace CSS transitions with Reanimated shared values;
- replace local `useState` with STX/effect-atom;
- preserve compound component composition;
- enforce TMNL typography floor: current sample has `7px`, `9px`, `10px`; RN port must use 12px minimum or optical scale transforms, not actual unreadable text.

This component is a strong model for mobile which-key and command decks: idle compression, touch expansion, preview cursor, committed reticle, and haptic feedback.

### 10.11 Maidens control plane: Kubernetes-spawned pi harnesses

Near-term hosting model: pi sessions run on real machines, then graduate into a Kubernetes-backed **Maidens control plane** that can spawn and supervise pi-agent harness servers.

Research findings:

- **Pepr** can build TypeScript Kubernetes operators. Its operator tutorial creates a CRD, watches custom resources, reconciles owned `Deployment` / `Service` / `ConfigMap` resources, uses `ownerReferences`, writes status, and processes reconcile callbacks through a queue for ordered handling.
- **Pepr CRD tooling** can generate Kubernetes Custom Resource Definitions and TypeScript types from CRDs, useful for strongly typed harness server specs.
- **cdk8s** is suitable for synthesizing Kubernetes manifests and typed constructs in TypeScript; `cdk8s-operator` exists for CRD operators backed by cdk8s constructs.
- **Alchemy** frames infrastructure as Effects: resources are yielded in an Effect stack, providers implement lifecycle operations (`read`, `diff`, `reconcile`, `delete`), and resource graphs deploy in dependency order. This maps extremely well to an Effect service graph for harness infrastructure.

Proposed CRDs:

```txt
MaidensHost
  describes a machine/cluster pool capable of running pi harnesses

MaidensServer
  desired state for a pi-agent harness server
  spec: image, model providers, tools, storage, resources, sidecars, ingress, auth
  status: phase, endpoint, sessionCount, readyReplicas, lastError

PiSession
  desired/observed state for a specific pi session
  spec: hostRef, cwd/workspace, model, tool profile, persistence policy
  status: phase, sessionId, wsEndpoint, lastEventSeq, token/cost counters

CodemodeApi
  declares typed tool/API surfaces available to agents
  spec: namespace, schemaRef, permissions, implementationRef
  status: phase, version, lastValidatedAt
```

Effect service graph:

```txt
MaidensControlPlane
├─ MaidensRegistry          # hosts, servers, sessions, capabilities
├─ MaidensProvisioner       # creates/updates/deletes k8s resources
├─ MaidensScheduler         # places sessions on hosts/servers
├─ MaidensSessionGateway    # WebSocket/RPC/NEX ingress for RN clients
├─ CodemodeRpcRegistry      # typed RPC groups exposed to agents
├─ ArtifactStore            # logs, transcripts, screenshots, generated files
├─ SecretProvider           # model/API/release credentials
└─ ReleaseOrchestrator      # Fastlane/FluentCI/EAS lanes
```

### 10.12 Codemode APIs as Effect RPCs

Codemode should be modeled as **Effect v4 RPC groups**, not ad-hoc REST endpoints.

Effect v4/effect-smol evidence:

- RPC lives under `effect/unstable/rpc`.
- `Rpc.make` defines schema-backed procedures with payload, success, error, defect, and `stream: true` support.
- `RpcGroup.make` groups procedures and exposes `toLayer`, `toLayerHandler`, `toHandlers`, and `accessHandler`.
- `RpcClient.make` creates typed clients; protocol layers include HTTP and WebSocket-oriented implementations.
- `RpcServer` includes server protocols with tracing, concurrency, ack/interrupt handling, queues, schedules, streams, and spans.
- `AtomRpc.Service` under `effect/unstable/reactivity` can derive query/mutation atoms from RPC groups for React consumption.

Canonical codemode RPC shape:

```ts
import { Schema } from "effect"
import { Rpc, RpcGroup } from "effect/unstable/rpc"

class UiAction extends Schema.TaggedClass<UiAction>()("UiAction", {
  id: Schema.String,
  namespace: Schema.String,
  method: Schema.String,
  input: Schema.Unknown,
  actor: Schema.Literals(["user", "agent", "script", "system"])
}) {}

class UiActionResult extends Schema.TaggedClass<UiActionResult>()("UiActionResult", {
  id: Schema.String,
  ok: Schema.Boolean,
  output: Schema.Unknown
}) {}

const InvokeUiAction = Rpc.make("codemode.ui.invoke", {
  payload: UiAction,
  success: UiActionResult
})

const WatchSessionEvents = Rpc.make("session.events.watch", {
  payload: { sessionId: Schema.String },
  success: Schema.Unknown,
  stream: true
})

export const CodemodeRpcs = RpcGroup.make(
  InvokeUiAction,
  WatchSessionEvents
)
```

Implementation rule:

```txt
Agent intent → Effect RPC → STX transition → UI action preview/commit → event ledger → stream update
```

This gives us typed contracts, streaming session state, interruptibility, spans, replay, React atom integration, and Kubernetes-hostable implementations from the same API definitions. Very Emacs, but with schemas and a seatbelt.

### 10.13 EventLog, Effect Cluster, and durable entities

The session/event ledger should be written through **Effect EventLog** where available, not by inventing another bespoke append-only store.

Evidence from local Effect v4/effect-smol sources:

- `effect/unstable/eventlog` provides an append-only `EventLog`, handler groups, compaction, remote replay, reactivity invalidation, SQL-backed journals, duplicate detection, and live stream fanout.
- `effect/unstable/cluster` models entities as schema/RPC groups, supports persisted messages via `ClusterSchema.Persisted`, and has local/test runners (`SingleRunner`, `TestRunner`) for non-cluster development.
- Cluster entities are powerful and sharp. Persisted handlers must be idempotent; replay and duplicate delivery are real design constraints, not trivia for a future intern.

TMNL durable runtime rule:

```txt
EventLog = source of truth for codemode/session/artifact history
Atom/STX = live React projection and interaction state
SQLite = local durable store / journal backend where appropriate
Postgres = remote/collaborative sync backend where environment scope permits
Cluster Entity = durable distributed actor only for state that truly needs identity + lifecycle
```

Candidate cluster entities:

```txt
SessionEntity       # pi session lifecycle, stream cursor, attach/detach
CodemodeEntity      # active API generation, command registry, permissions
SurfaceEntity       # generated UI surface manifest + version pointer
ScriptEntity        # script draft/preview/promote/rollback lifecycle
MaidensServerEntity # spawned harness server lifecycle
```

Do **not** make every button an entity. That way lies distributed-object cosplay. Use entities for durable identity and workflow boundaries only.

### 10.14 Crash-contained codemode runtime

TMNL RN treats codemode like Emacs with a seatbelt: a stable kernel owns input, storage, networking, render hosts, and permissions; all agent-authored behavior lives behind typed commands, generation pointers, and restartable sandboxes.

| Lane | Boundary | Failure scope |
| --- | --- | --- |
| Stable native kernel | RN shell, storage, networking, render host, capability broker | app restart only |
| Schema/RPC commands | `codemode.*`, `ui.*`, `fs.*`, `script.*`, `surface.*` Effect RPC groups | request fails / no mutation |
| Hot-loop scripts | Bun sidecar, embedded JS sandbox, or native worker | worker restart |
| Generated UI | versioned surface manifest + sandboxed preview host | surface remount + fallback |
| EventLog ledger | append-only source of truth with replay cursor | rehydrate projections |
| Rollback | atomic generation pointer swap | no in-place mutation required |

Rules:

- Agents edit drafts, not the kernel.
- Every install/edit/preview/promote/rollback is Schema-backed and ledgered.
- Scripts emit intents and patches only; side effects are checked by the kernel capability broker.
- Generated UI mounts through a restartable surface host; faults degrade to fallback instead of crashing the app.
- Rollback restores the last known-good generation and replay cursor.
- Destructive actions require explicit human approval or a scoped capability grant.

This is the Emacs failure model we want: bad extension code fails locally; the editor keeps breathing.

### 10.15 DMN capability packs and scope lattice

Capabilities should be packaged as **DMN-style capability packs**, not scattered booleans.

Naming warning: existing `src/lib/capabilities` is an ECS-style visual affordance/injection system (`glowable`, `tooltippable`, `badgeable`, etc.). It is not the authority/capability-access substrate described here. Keep the new access model under a distinct `capability-access` / `CapabilityAccessRuntime` namespace unless and until a deliberate migration merges the concepts. Similar words, different beast; let us not create a homonym trap with teeth.

Local precedence exists in the IIoT Reactor architecture:

- `src/lib/iiot/services/reactor/declarations.ts` defines target-owned `EntityReactionCapability` contracts.
- `src/lib/iiot/services/reactor/ReactorRegistry.ts` assembles observations, policies, entity contracts, unique capability lookup, and stable registry fingerprints.
- `src/lib/iiot/services/reactor/contracts/work-order.ts` demonstrates capability maps that classify first, then dispatch if eligible.

TMNL should generalize that shape:

```ts
class CapabilityPack extends Schema.TaggedClass<CapabilityPack>()("CapabilityPack", {
  id: Schema.String,
  version: Schema.String,
  scope: Schema.Literals(["mobile", "laptop", "remote", "cluster", "web", "dev", "release"]),
  provides: Schema.Array(Schema.String),
  requires: Schema.Array(Schema.String),
  denies: Schema.Array(Schema.String),
  permissions: Schema.Array(Schema.String)
}) {}
```

Scope examples:

| Pack | Scope | Examples |
| --- | --- | --- |
| `mobile.client` | mobile-only | session viewer, command deck, haptics, camera, document picker |
| `laptop.sidecar` | laptop-only | local shell, filesystem workspace, Bun scripts, PTY |
| `remote.host` | remote-only | pi harness server, model/tool execution, artifact store |
| `cluster.maidens` | cluster-only | schedule/spawn/terminate harness pods |
| `release.machine` | laptop/CI only | Fastlane, EAS submit, signing material |
| `surface.generative` | platform-dependent | generated UI previews, Lottie/Skia playback, Genifer surfaces |

The set operations are **not** the API. They are implementation mechanics inside the access resolver. The actual runtime surface is a platform-scoped access decision.

Access evaluation runs whenever a user, agent, script, or generated surface attempts to use a capability:

```txt
requested intent/action
+ actor/session grants
+ platform profile
+ connected host profile
+ surface generation profile
+ current STX/XState state
+ policy pack registry
→ AccessDecision
```

Access decisions are not just `true | false`:

```ts
class AccessDecision extends Schema.TaggedClass<AccessDecision>()("AccessDecision", {
  id: Schema.String,
  capability: Schema.String,
  result: Schema.Literals(["allow", "deny", "degrade", "proxy", "requires-approval", "unavailable"]),
  platform: Schema.Literals(["ios", "android", "windows", "macos", "linux", "web", "remote", "cluster"]),
  reason: Schema.String,
  implementation: Schema.Unknown,
  uiBehavior: Schema.Unknown
}) {}
```

Examples:

| Request | iPhone | Zenbook/laptop | Remote host | UI behavior |
| --- | --- | --- | --- | --- |
| `shell.run` | `proxy` to host or `deny` | `allow` through Bun sidecar | `allow` | phone shows host picker / approval sheet |
| `release.fastlane.runLane` | `requires-approval` + remote execution | `allow` if signing pack present | CI-only `allow` | phone becomes release cockpit, not signing machine |
| `surface.lottie.preview` | `allow` if native/remote renderer exists | `allow` | `allow` | choose local Skia, remote preview, or video fallback |
| `fs.writeWorkspace` | `proxy` / document sandbox only | `allow` in workspace | `allow` | file UI changes wording and affordance per provider |
| `ui.commandDeck.open` | `allow` mobile variant | `allow` keyboard/desktop variant | N/A | same command, different machine variant |

Internal pack composition still exists, but it feeds the resolver:

```txt
union(packA, packB)       = candidate ability envelope
intersect(packA, packB)   = safe common contract across surfaces
subtract(pack, denyPack)  = hard policy removal before execution
overlay(base, session)    = temporary grants layered over environment defaults
resolveAccess(...)        = the only thing callers actually use
```

The app should show the active access decision and capability provenance before an agent invokes dangerous commands. No hidden magic. No surprise chainsaw.

#### 10.15.1 UI behavior packs and state-machine-backed surfaces

The UI itself must be capability-scoped. A capability does not merely decide whether a command exists; it can change how the UI behaves on each platform.

This is where the advanced `Schema.TaggedClass` + STX/XState model belongs. A generated or built-in surface should be a schema-backed entity with a runtime behavior machine:

```ts
class UiSurfaceDefinition extends Schema.TaggedClass<UiSurfaceDefinition>()("UiSurfaceDefinition", {
  surfaceId: Schema.String,
  generationId: Schema.String,
  renderer: Schema.Literals(["native-rn", "skia", "lottie", "genifer", "remote-preview", "web-fallback"]),
  requiredCapabilities: Schema.Array(Schema.String),
  inputSchemaId: Schema.String,
  outputSchemaId: Schema.String,
  machineId: Schema.String,
  defaultState: Schema.String,
  platformVariants: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}
```

Serializable Schema classes describe identity, contracts, permissions, renderer choice, and variant metadata. The actual runtime behavior lives in registered STX/XState machines keyed by `machineId`.

Runtime shape:

```txt
UiSurfaceDefinition
→ CapabilityAccessRuntime.resolveAccess(...)
→ choose platform variant
→ mount SurfaceActor(machineId)
→ STX/XState governs transitions
→ EventLog records lifecycle and promoted state
→ atom projection updates React
```

Surface state machines should own:

- `draft → validating → previewing → promoted → degraded → rolledBack` lifecycle;
- platform behavior variants (`mobileThumbDeck`, `desktopWhichKey`, `remotePreview`, `readOnlyCockpit`);
- failure transitions (`scriptFault`, `renderFault`, `capabilityDenied`, `hostUnavailable`);
- approval gates for destructive or remote execution;
- cache/replay cursors for generated UI versions.

This lets us modify UI behavior per platform without changing the kernel. Same surface definition; different access decision; different machine branch. Elegance, Prime — not a Rube Goldberg permissions piñata.

#### 10.15.2 Research-grounded React Native constraints

Grounding notes captured 2026-06-09:

- Expo Modules API is the native capability extension seam: Swift/Kotlin modules, New Architecture support, and native views/functions. Expo Go only supports the fixed module set bundled into Expo Go; custom modules require a development build.
- Expo permissions have two layers: build-time configuration through app config/config plugins, and runtime permission requests. Capability access must model both, not just the final granted/denied state.
- Expo Router gives a shared route tree, layout routes, deep links, and platform-specific file resolution. Platform-specific files are allowed at adapter leaves, but policy and access resolution stay in shared code.
- React Native Skia/Skottie can render Lottie through Skia and can be driven by Reanimated shared values. Expo SDK 56 docs list `@shopify/react-native-skia` as included in Expo Go with bundled version 2.6.2; still smoke-test Skottie APIs against the bundled build before treating `surface.lottie.preview` as Expo-Go-stable. Otherwise use remote preview or video fallback.

Implications:

```txt
Expo Go profile:
  allow only bundled native capabilities + remote/proxy flows

Development build profile:
  allow custom Expo Modules, config plugins, native permissions, Skia/Skottie, deeper host integration

Desktop/host profile:
  allow local process/filesystem only when sidecar/runtime pack is present
```

Therefore `CapabilityAccessRuntime` must evaluate more than `Platform.OS`:

```ts
class AccessRequest extends Schema.TaggedClass<AccessRequest>()("AccessRequest", {
  id: Schema.String,
  capability: Schema.String,
  actorId: Schema.String,
  sessionId: Schema.String,
  platform: Schema.String,
  buildProfile: Schema.Literals(["expo-go", "dev-build", "standalone", "tauri", "rn-desktop", "remote", "cluster"]),
  surfaceId: Schema.String,
  machineState: Schema.String,
  requestedAt: Schema.DateTimeUtcFromString,
  input: Schema.Unknown
}) {}
```

Resolution contract:

```ts
class CapabilityAccessRuntime extends Context.Service<CapabilityAccessRuntime, {
  readonly resolveAccess: (
    request: AccessRequest
  ) => Effect.Effect<AccessDecision, CapabilityAccessError>
}>()("tmnl/car/CapabilityAccessRuntime") {}
```

This is the public API. Pack algebra remains private resolver machinery. Prime, we're not shipping `union()` as a user affordance like some permissions-themed escape room.

#### 10.15.3 Surface actor contract

A `UiSurfaceDefinition` is serializable. A `SurfaceActor` is runtime behavior.

```txt
SurfaceActor inputs:
  UiSurfaceDefinition
  AccessDecision
  PlatformCapability
  HostStatus
  SessionGrant projection

SurfaceActor outputs:
  SurfaceLifecycleEvent
  RenderVariantSelection
  ApprovalRequest
  DegradedFallback
```

Canonical lifecycle:

```txt
draft
  → validating
  → previewing
  → promoted
  → degraded
  → rolledBack
```

Mandatory failure events:

| Event | Transition | UI obligation |
| --- | --- | --- |
| `capabilityDenied` | current → degraded | explain missing pack/permission |
| `requiresApproval` | current → approval gate | show scoped approval sheet |
| `hostUnavailable` | previewing/promoted → degraded | offer reconnect or read-only mode |
| `renderFault` | previewing/promoted → degraded | remount fallback renderer |
| `scriptFault` | validating/previewing → rolledBack | preserve last known-good generation |

Variant selection is access-driven:

```txt
ui.commandDeck.open + iPhone + allow
  → mobileThumbDeck

ui.commandDeck.open + desktop + allow
  → desktopWhichKey

shell.run + iPhone + proxy/requires-approval
  → remoteExecutionApprovalSheet

surface.lottie.preview + dev-build + Skia available
  → localSkottiePreview

surface.lottie.preview + Expo Go or Skia unavailable
  → remotePreview | videoFallback
```

#### 10.15.4 `@tmnl/stx` package integration contract

Use the package STX implementation, not the legacy local shim:

```ts
import { stxMachine, stxFamily, type StxMachineInstance } from "@tmnl/stx"
import { Schema } from "effect-v4"
import { assign, setup } from "xstate"
```

`@tmnl/stx` currently compiles against the workspace `effect-v4` alias. RFC examples that target this package should either import from `effect-v4` or explicitly note the later alias collapse to `effect` after the shared-core migration. Mixing `@/lib/stx` and `@tmnl/stx` in new architecture work is forbidden; that is how ghosts get tenure.

Keep the serializable surface contract separate from runtime state:

```ts
class UiSurfaceDefinition extends Schema.TaggedClass<UiSurfaceDefinition>()("UiSurfaceDefinition", {
  surfaceId: Schema.String,
  generationId: Schema.String,
  renderer: Schema.Literals(["native-rn", "skia", "lottie", "genifer", "remote-preview", "web-fallback"]),
  requiredCapabilities: Schema.Array(Schema.String),
  inputSchemaId: Schema.String,
  outputSchemaId: Schema.String,
  machineId: Schema.String,
  defaultState: Schema.String,
  platformVariants: Schema.Record({ key: Schema.String, value: Schema.Unknown })
}) {}

type SurfaceRuntimeState = {
  readonly surfaceId: string
  readonly generationId: string
  readonly lifecycle: "draft" | "validating" | "previewing" | "promoted" | "degraded" | "rolledBack"
  readonly selectedVariant: string
  readonly accessDecisionId: string | null
  readonly approvalRequestId: string | null
  readonly fallbackReason: string | null
  readonly ledgerCursor: string | null
}
```

Why split them:

- `UiSurfaceDefinition` is the ledgered, Schema-backed contract.
- `SurfaceRuntimeState` is the atom/STX projection React reads.
- `stxMachine()` shallow-merges `contextToState` results; until package machine sync preserves `Schema.TaggedClass` constructors on context updates, machine-backed runtime state should be plain data or should update class instances through explicit `setAt`/constructor-aware mutations only.

Canonical machine sketch:

```ts
const surfaceMachine = setup({
  types: {
    context: {} as {
      selectedVariant: string
      accessDecisionId: string | null
      approvalRequestId: string | null
      fallbackReason: string | null
      ledgerCursor: string | null
    },
    events: {} as
      | { type: "VALIDATE" }
      | { type: "PREVIEW"; variant: string; accessDecisionId: string }
      | { type: "PROMOTE"; ledgerCursor: string }
      | { type: "ROLLBACK"; ledgerCursor: string; reason: string }
      | { type: "CAPABILITY_DENIED"; reason: string; accessDecisionId: string }
      | { type: "REQUIRES_APPROVAL"; approvalRequestId: string; accessDecisionId: string }
      | { type: "HOST_UNAVAILABLE"; reason: string }
      | { type: "RENDER_FAULT"; reason: string }
      | { type: "SCRIPT_FAULT"; reason: string }
  }
}).createMachine({
  id: "tmnl.surfaceActor",
  initial: "draft",
  context: {
    selectedVariant: "unresolved",
    accessDecisionId: null,
    approvalRequestId: null,
    fallbackReason: null,
    ledgerCursor: null
  },
  states: {
    draft: { on: { VALIDATE: "validating" } },
    validating: {
      on: {
        PREVIEW: {
          target: "previewing",
          actions: assign({
            selectedVariant: ({ event }) => event.variant,
            accessDecisionId: ({ event }) => event.accessDecisionId,
            fallbackReason: null
          })
        },
        CAPABILITY_DENIED: { target: "degraded" },
        SCRIPT_FAULT: { target: "rolledBack" }
      }
    },
    previewing: {
      on: {
        PROMOTE: { target: "promoted", actions: assign({ ledgerCursor: ({ event }) => event.ledgerCursor }) },
        REQUIRES_APPROVAL: { target: "approval" },
        HOST_UNAVAILABLE: { target: "degraded" },
        RENDER_FAULT: { target: "degraded" },
        SCRIPT_FAULT: { target: "rolledBack" }
      }
    },
    approval: {
      on: {
        PREVIEW: "previewing",
        CAPABILITY_DENIED: "degraded"
      }
    },
    promoted: {
      on: {
        RENDER_FAULT: "degraded",
        HOST_UNAVAILABLE: "degraded",
        ROLLBACK: "rolledBack"
      }
    },
    degraded: { on: { PREVIEW: "previewing", ROLLBACK: "rolledBack" } },
    rolledBack: { on: { VALIDATE: "validating" } }
  }
})

const surfaceActor = stxMachine(surfaceMachine, {
  surfaceId: "ui.commandDeck.open",
  generationId: "builtin",
  lifecycle: "draft",
  selectedVariant: "unresolved",
  accessDecisionId: null,
  approvalRequestId: null,
  fallbackReason: null,
  ledgerCursor: null
} satisfies SurfaceRuntimeState, {
  contextToState: (context, snapshot) => ({
    lifecycle: String(snapshot.value) as SurfaceRuntimeState["lifecycle"],
    selectedVariant: context.selectedVariant,
    accessDecisionId: context.accessDecisionId,
    approvalRequestId: context.approvalRequestId,
    fallbackReason: context.fallbackReason,
    ledgerCursor: context.ledgerCursor
  })
}) satisfies StxMachineInstance<SurfaceRuntimeState, typeof surfaceMachine>
```

Surface registries should be keyed families:

```ts
const surfaceStateFamily = stxFamily<string, SurfaceRuntimeState>((surfaceId) => ({
  surfaceId,
  generationId: "unresolved",
  lifecycle: "draft",
  selectedVariant: "unresolved",
  accessDecisionId: null,
  approvalRequestId: null,
  fallbackReason: null,
  ledgerCursor: null
}))
```

Operational rule: `CapabilityAccessRuntime.resolveAccess(...)` selects the event sent into the `SurfaceActor`; React subscribes to `@tmnl/stx` atoms/focus atoms; EventLog records lifecycle edges and promoted generation pointers. No component should directly inspect pack unions or platform booleans to decide command authority.

React binding rule:

```ts
import { useStxMachine, useStxSend, useStxSnapshot, useFocus } from "@tmnl/stx"
```

Use package hooks with the package-owned registry. Do not rely on hidden global registry context when a surface actor already owns an explicit registry. The package exposes root and `./hooks` exports only; no deep-importing `@tmnl/stx/src/internal/*` from TMNL app code.

Registry split:

```txt
definition registry:
  stxFamily<string, UiSurfaceDefinition>
  ledger/API/search/read-model concern

runtime actor registry:
  stxMachine(surfaceMachine, SurfaceRuntimeState)
  mounted surface lifecycle + variant + fallback concern
```

### 10.16 Local state, persistence, and sync

Persistence is environment-scoped:

```txt
Phone / tablet:
  SQLite-backed local state store + EventLog cache + encrypted capability/session metadata

Laptop / Tauri / RN desktop:
  SQLite local store + workspace file cache + Bun sidecar state + optional Postgres sync

Remote host:
  SQLite or Postgres depending deployment profile; artifact store for large files

Cluster / Maidens:
  Postgres/event journal for shared durable state; object storage for artifacts; local SQLite only as pod cache when safe
```

SQLite is the default local durability layer because it survives app restarts, supports indexed projections, and maps cleanly to offline-first cache/replay. Postgres is the sync/collaboration/cluster backend, not a requirement for every phone-local action.

State taxonomy:

| State | Source of truth | Projection/cache |
| --- | --- | --- |
| session history | EventLog/EventJournal | atoms + SQLite read models |
| command registry | ledgered generation manifest | atom/STX projection |
| generated UI | surface manifest + artifact store | SQLite cache + Skia/Lottie compiled handles |
| capability grants | signed/session-scoped grant event | atom projection |
| remote host status | host RPC/cluster status | local cache with TTL |
| large artifacts | artifact/object store | local file cache by content hash |

### 10.17 Generative and cached user interfaces

TMNL should support continuously upgraded, self-creating user interfaces: an agent can generate a purpose-built surface, cache it, reason over it later, and evolve it across sessions.

`diffusionstudio/lottie` is an especially good fit for this layer:

- It renders Lottie through Skia CanvasKit / Skottie rather than `lottie-web`.
- The player hot-reloads `public/lottie.json`, making it natural for agent-authored animation iteration.
- It supports Lottie slots and `controls.json`, which maps directly to TMNL's desire for editable generated instruments.

TMNL adaptation:

```txt
agent drafts surface spec / Lottie / Genifer script
→ validate schema + capability grants
→ render in preview host
→ cache manifest + source + compiled assets by content hash
→ user/agent promotes generation
→ EventLog records generation pointer
→ future sessions can reason over prior cached surfaces and produce upgrades
```

Generated UI artifacts should carry metadata:

```txt
surfaceId, generationId, sourceHash, renderer, requiredCapabilities,
inputSchema, outputSchema, slots, controls, previewScreenshots,
createdBy, promotedBy, ledgerCursor, rollbackTarget
```

Hot generative loops should not be forced through chat/RPC round trips for every frame. Use RPC for authority and lifecycle; use local streams/workers/shared buffers for animation, synthesis, and high-frequency preview updates.

### 10.18 RPC vs hot-loop execution

Not everything needs to be RPC. RPC is for authority, auditability, permissions, durable transitions, and cross-boundary invocation. Hot loops need lower-latency lanes.

| Workload | Lane |
| --- | --- |
| `ui.invokeCommand` / `script.promote` / `surface.install` | Effect RPC |
| session event stream | streaming RPC / WebSocket / NEX |
| generated UI animation frames | local render loop / Skia / Reanimated / worker |
| Genifer-style synthesis loop | script worker + streaming patches |
| Lottie slot scrubbing | local state/Skia control path; ledger committed changes only |
| file edits / release lanes / shell | RPC + capability broker + approval gates |

Agent constraint model:

```txt
Agents are constrained by typed APIs and capability grants.
Scripts are constrained by sandbox workers and intent-only side effects.
Generated UI is constrained by surface manifests and render-host boundaries.
The kernel is constrained by schemas, STX, and the ledger.
```

That is the correct separation: agents get expressive power without being allowed to turn the app into a glass cannon.

---

## 11. Fastlane / FluentCI Release Automation

Fastlane is part of the release substrate. FluentCI has a ready-to-use **Fastlane pipeline for React Native projects** with:

```sh
fluentci run fastlane_pipeline <lane>
```

It also exposes a programmatic TypeScript/JSR API:

```ts
import { execLane } from "jsr:@fluentci/fastlane"

await execLane("buildRelease")
```

Release automation direction:

- Use **Fastlane** for iOS/Android signing, screenshots, TestFlight/App Store, and Play Store workflows.
- Use **FluentCI** as a programmable pipeline layer where we want Nix/Dagger-style reproducibility.
- Use **Bun** as the TMNL orchestration runtime. JSR packages can be consumed through JSR's npm compatibility layer / `bunx jsr add --bun` flow when needed.
- Keep `@expo/fastlane` as a possible thin wrapper around the host `fastlane` executable, but watch its BUSL license.
- Treat `@lamantin/fastpush` and `@fastlanejs/api` as reference material, not default dependencies, because they appear older and narrower.

Release lanes should be exposed through the harness as typed APIs:

```txt
release.fastlane.runLane
release.fastlane.listLanes
release.fluentci.execLane
release.expo.buildDevClient
release.expo.submit
```

That lets the iPhone trigger and observe a release lane without pretending the iPhone itself is the signing machine.

---

## 12. Migration Phases

### Phase 0 — RFC and inventory

- Ratify this RFC.
- Complete web-only hazard audit.
- Decide initial package names.
- Identify exact Expo SDK / RN / Effect v4 versions.

### Phase 1 — New RN app shell

- Create sibling Expo app package.
- Add NX targets and Bun scripts explicitly.
- Add physical-device run docs.
- Add platform capability probe.

### Phase 2 — Shared v4 core extraction

- Extract `stx` first.
- Extract `ui` token bridge.
- Extract minimal `hrn` harness API schemas.
- Avoid importing Tauri/DOM from shared core.

### Phase 3 — HMI vertical slice

- Implement adaptive panel shell.
- Implement drawer.
- Implement slider.
- Implement reticle/overlay with Skia.
- Implement API-call demo through harness.

### Phase 4 — Harness expansion

- Codemode API registry as Effect RPC groups.
- Remote/local transport adapters.
- Mobile-safe tool execution.
- Event log/replay surface.
- AtomRpc client bindings for RN session/UI state.

### Phase 4.5 — Maidens control plane spike

- Define `MaidensServer`, `PiSession`, and `CodemodeApi` schemas/CRDs.
- Prototype local computer provider first.
- Prototype Kubernetes provider with Pepr and/or cdk8s.
- Evaluate Alchemy custom resource provider for plan/apply lifecycle.
- Expose spawn/attach/terminate/list operations through Effect RPC.

### Phase 5 — Native visualization adapters

- Data grid native adapter.
- Chart native adapter.
- Map native adapter.
- Canvas/workspace native adapter.

### Phase 6 — Desktop-native targets

- React Native Windows spike for Zenbook native app.
- macOS spike.
- Linux-native feasibility decision.
- Tauri coexistence/bridge decision.

---

## 13. Open Questions

1. Final app package name: `tmnl-rn`, `tmn`, or another three-letter package?
2. Harness package name: `hrn`, `har`, or another three-letter code?
3. How much of the current Tauri harness should be exposed as a remote API for mobile?
4. Is Zenbook-native v1 required, or is Expo Web touch preview acceptable until the HMI slice lands?
5. Which map stack is canonical for GEOINT: MapLibre by default, Mapbox only when needed?
6. Should codemode APIs be implemented first as local desktop sidecars, remote server APIs, or dual from day one?
7. Which phone-local pi provider is first: remote-only bootstrap, Android Termux sidecar, embedded Node/Bun runtime, or Rust-native harness core?

---

## 14. Ratification Recommendation

Approve this RFC as the north-star contract with these immediate next actions:

1. Create the Expo RN app as a sibling, not a replacement.
2. Preserve Tauri.
3. Extract `stx`, `ui`, and a minimal `hrn` harness API first.
4. Build the HMI/touch vertical slice before touching AG Grid/tldraw parity.
5. Treat Zenbook support as capability-driven: Web preview immediately, RN Windows native next.

This keeps the architecture elegant and the blast radius contained. You know, almost like we planned it instead of summoning a dependency hydra in a trench coat.
