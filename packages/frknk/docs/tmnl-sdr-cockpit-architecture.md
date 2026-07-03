# TMNL SDR Cockpit Architecture — Profiles, Tiles, Islands, Controls

This document pivots from “clone Quisk’s UI” to “extract Quisk’s SDR cockpit semantics and rebuild them as a TMNL-native architecture.”

Quisk remains the reference cockpit for SDR behavior. It is **not** the desired visual grammar.

The chosen architecture:

- **Layout model:** three-column tiling cockpit.
- **Island granularity:** compound islands / third-order compound components.
- **Profile role:** profiles control both layout and capability policy.
- **Agentic surface:** future chat/agent manipulation lives as a command island or drawer.

---

## 1. Core thesis

Quisk’s visible screens do not radically change the useful cockpit skeleton. Graph, waterfall, bandscope, scope, config, and help all sit inside a mostly stable control frame.

That means the architectural target is not “many screens.”

The target is:

```text
SDR Cockpit = Profile + Tiled Islands + Capability Policy + Command Surface
```

Where:

- **Profile** decides what kind of cockpit this is.
- **Tiling engine** places islands into columns.
- **Islands** are compound components that bind controls, metrics, commands, and state.
- **Capability policy** determines what is enabled, locked, simulated, hidden, or dangerous.
- **Command surface** exposes deep manipulation through structured operator commands and, later, agents.

Prime, this is how we avoid building a Rube Goldberg clone of a wxPython button carpet. We keep the radio brain and replace the furniture.

---

## 2. Cockpit macro-layout

The default cockpit is a three-column tiling layout:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  SDR COCKPIT SHELL                                           │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│ VFO / SESSION HEADER                                                                          │
│ ┌───────────────┬──────────────────────────────────────────────┬───────────────────────────┐ │
│ │ Conn: Hermes  │  7.074000 MHz   LSB   RX-only   Stream OK     │  Profile: Hermes RX Lab   │ │
│ └───────────────┴──────────────────────────────────────────────┴───────────────────────────┘ │
├───────────────────────┬────────────────────────────────────────────┬─────────────────────────┤
│ LEFT CONTROL COLUMN   │ CENTER SIGNAL WORKBENCH                    │ RIGHT CONTROL COLUMN    │
│                       │                                            │                         │
│ ┌───────────────────┐ │ ┌────────────────────────────────────────┐ │ ┌─────────────────────┐ │
│ │ RF Frontend       │ │ │ Spectrum / Waterfall / Scope Surface   │ │ │ Mode + Filter       │ │
│ │ LNA, Ant, Gain    │ │ │ cursor, passband, candidates, markers  │ │ │ LSB, CW, AM, BW     │ │
│ └───────────────────┘ │ └────────────────────────────────────────┘ │ └─────────────────────┘ │
│ ┌───────────────────┐ │ ┌────────────────────────────────────────┐ │ ┌─────────────────────┐ │
│ │ DSP Cleanup       │ │ │ Signal Detail / Zoom / Selection       │ │ │ Capture Transport   │ │
│ │ AGC, NR, NB       │ │ │ selected slice, demod preview, sketch  │ │ │ record/play/corpus   │ │
│ └───────────────────┘ │ └────────────────────────────────────────┘ │ └─────────────────────┘ │
│ ┌───────────────────┐ │                                            │ ┌─────────────────────┐ │
│ │ Metering          │ │                                            │ │ Bookmarks / Memory  │ │
│ │ S-meter, SWR      │ │                                            │ │ bands/favorites     │ │
│ └───────────────────┘ │                                            │ └─────────────────────┘ │
├───────────────────────┴────────────────────────────────────────────┴─────────────────────────┤
│ DIAGNOSTICS / COMMAND DRAWER                                                                  │
│ Hermes packets, stream stats, emulator state, command island, agent intent preview             │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Column intent:

| Region | Role | Examples |
|---|---|---|
| Header | Session identity and dominant VFO state | frequency, mode, connection, safety |
| Left column | physical/RF and signal hygiene | LNA, antenna, gain, AGC, NR, NB, meters |
| Center column | signal workbench | spectrum, waterfall, scope, selection, overlays |
| Right column | operator intent and artifacts | mode/filter, capture, memory, profile tools |
| Bottom drawer | deeper systems | diagnostics, protocol, command/agent interface |

The columns are not hard-coded panels. They are placement domains for profile-resolved islands.

---

## 3. Tiling engine

The tiling engine is deterministic. A profile provides islands and constraints; the engine places them into the three-column grid.

### 3.1 Tile placement model

```text
ProfileTile
├─ islandId
├─ preferredColumn: left | center | right | drawer
├─ priority
├─ sizeHint: compact | standard | wide | hero
├─ minSize
├─ maxSize
├─ span
├─ breakpointPolicy
├─ visibilityPolicy
└─ capabilityGuards[]
```

### 3.2 Placement algorithm

Recommended first algorithm: **priority skyline within fixed semantic columns**.

1. Partition tiles by `preferredColumn`.
2. Filter by profile capability policy.
3. Sort by priority, then stability key.
4. Place each tile in its column using vertical skyline packing.
5. Promote hero center tiles to large workbench slots.
6. Overflow lower-priority islands into drawers.
7. Persist user overrides as profile deltas, not mutations to the base profile.

```text
Input:
  profile.tiles[] + viewport + capability policy

Process:
  filter → partition → sort → pack → overflow → persist delta

Output:
  CockpitLayoutResolved
```

This avoids fully freeform chaos while still allowing profiles to reshape the cockpit.

### 3.3 Why not pure freeform?

A radio cockpit needs muscle memory. Pure freeform canvas placement is seductive but hazardous as a default. The operator should know where RF, DSP, mode, capture, and diagnostics live.

Freeform can still exist later as an expert mode or tldraw-derived layout editor.

---

## 4. Compound island anatomy

Every cockpit surface is an island. An island is not merely a card. It is a compound component with explicit slots and bindings.

```text
CockpitIsland
├─ Island.Root
│  ├─ Island.Header
│  │  ├─ title
│  │  ├─ status badge
│  │  ├─ capability/safety badge
│  │  └─ local actions
│  ├─ Island.Body
│  │  ├─ one or more control surfaces
│  │  ├─ visualizations
│  │  └─ contextual help/labels
│  ├─ Island.Telemetry
│  │  ├─ meter values
│  │  ├─ sparklines
│  │  └─ stream status
│  ├─ Island.Actions
│  │  ├─ command buttons
│  │  ├─ menus
│  │  └─ transport controls
│  └─ Island.Footer
│     ├─ bound state source
│     ├─ last command result
│     └─ lock/simulation reason
```

Third-order composition:

```text
Cockpit Profile
└─ Island
   └─ Control Surface
      └─ Primitive Control
```

Example:

```text
Hermes RF Island
└─ LNA Control Surface
   ├─ Slider primitive
   ├─ Numeric readout primitive
   ├─ Sparkline primitive
   └─ Capability lock primitive
```

The point: buttons and sliders are not one-off JSX fragments. They are part of a control-surface system with shared command binding, safety, telemetry, and layout rules.

---

## 5. Control surface taxonomy

Quisk exposes all controls as dense buttons and wrapped sliders. TMNL should expose them as semantic control systems.

### 5.1 Primitive control families

| Family | Purpose | Examples |
|---|---|---|
| Button | discrete command | mute, notch, start stream |
| Toggle button | boolean state | AGC on/off, NB on/off |
| Momentary button | hold/press behavior | PTT, spot tone |
| Segmented control | mutually exclusive choice | mode, screen surface, filter preset |
| Slider | continuous scalar | volume, LNA, AGC threshold, y-scale |
| Dial | high-resolution continuous control | VFO tuning, fine RIT |
| XY grid | two-axis parameter shaping | filter width/offset, pan/zoom, IQ correction |
| Transport | capture/playback flow | record, play, pause, mark, loop |
| Meter | instantaneous value | S-meter, SWR, PA current |
| Sparkline | recent history | frame rate, level drift, packet jitter |
| Mini graph | local spectral/shape feedback | filter response, AGC envelope |
| Command input | structured/deep action | natural language or command palette |

### 5.2 Derived/specialized controls

Some controls should be derived from the active surface.

Examples:

| Active surface | Derived controls |
|---|---|
| Spectrum | center, zoom, passband, peak hold, candidate marker |
| Waterfall | time depth, palette, intensity, decay, freeze |
| Scope | trigger, timebase, run/stop |
| Capture | record, play, corpus target, annotation marker |
| Diagnostics | packet filter, stream reset, emulator state dump |
| ML sketch lab | select signal, sketch tile, label, classify, locate |

This is the critical shift: controls do not live globally because Quisk put them in a bottom row. Controls are routed by active task and surface context.

---

## 6. Cockpit profiles

A cockpit profile is a complete policy object.

It decides:

- which islands are present;
- where islands prefer to live;
- which controls are enabled;
- which hardware affordances are visible;
- which commands are allowed;
- which commands require confirmation;
- which telemetry is first-class;
- which state presets apply;
- which layout overrides are accepted.

### 6.1 Profile examples

```text
frknk.hermes-emulator.rx
├─ receive-only
├─ fake Hermes/OpenHPSDR stream
├─ TX/PA/ATU locked
├─ protocol diagnostics visible
└─ capture/corpus controls enabled

frknk.operator.basic
├─ live receive workflow
├─ simplified RF + DSP controls
├─ mode/filter prominent
├─ protocol drawer collapsed
└─ command island optional

frknk.lossy-sketch-lab
├─ spectrum/waterfall hero workbench
├─ sketch candidate overlays
├─ capture/labeling island prominent
├─ ML locator diagnostics visible
└─ RF controls reduced

frknk.tx-capable.safe
├─ explicit hardware capability checks
├─ PTT/VOX/FDX gated
├─ SWR/PA telemetry mandatory
├─ command dry-run required for TX changes
└─ red-line safety states visible
```

### 6.2 Profile schema sketch

Future TypeScript/Effect Schema shape:

```ts
CockpitProfile
├─ id
├─ label
├─ description
├─ hardwareKind
├─ defaultReceiver
├─ capabilities
│  ├─ receive
│  ├─ transmit
│  ├─ fullDuplex
│  ├─ atu
│  ├─ predistortion
│  ├─ capture
│  ├─ diagnostics
│  └─ agentCommands
├─ layout
│  ├─ columns
│  ├─ tiles[]
│  └─ drawers[]
├─ islands[]
├─ commandPolicy
├─ safetyPolicy
└─ themeHints
```

Profiles should be data, not component code. Component registries resolve island IDs to React implementations.

---

## 7. Capability policy

Capability policy is non-negotiable. SDR controls can become hardware actions. TX, PA, ATU, and full-duplex controls must not merely be hidden or visually grayed out by convention.

```text
CapabilityDecision
├─ visible: boolean
├─ enabled: boolean
├─ mode: live | simulated | locked | unavailable
├─ reason
├─ requiredTelemetry[]
├─ confirmationLevel: none | confirm | hold-to-arm | external-approval
└─ commandGuards[]
```

Example decisions:

```text
PTT in frknk.hermes-emulator.rx
├─ visible: true
├─ enabled: false
├─ mode: locked
└─ reason: receive-only emulator has no TX RF path

Record in frknk.hermes-emulator.rx
├─ visible: true
├─ enabled: true
├─ mode: live
└─ reason: corpus capture is safe and local

ATU in frknk.hermes-emulator.rx
├─ visible: true
├─ enabled: false
├─ mode: simulated
└─ reason: Hermes widget exists, but no tuner backend is attached
```

This is where profiles become more than layouts. They are operational contracts.

---

## 8. Island catalog for first TMNL slice

### 8.1 VFO Header Island

Role: dominant operator state.

Controls:

- frequency display;
- direct frequency entry;
- band up/down;
- RIT summary;
- connection status;
- RX/TX safety badge.

Telemetry:

- stream status;
- sample rate;
- board ID/MAC/code version.

### 8.2 Signal Workbench Island

Role: central signal display.

Surfaces:

- spectrum;
- waterfall;
- scope;
- bandscope;
- filter response.

Controls:

- active surface selector;
- zoom;
- y-scale;
- y-zero;
- passband edit;
- marker/candidate selection.

### 8.3 RF Frontend Island

Controls:

- LNA dB;
- antenna selector;
- RF gain;
- attenuator/preamp if supported.

Telemetry:

- current LNA;
- optional PA temperature/SWR if hardware supports it.

### 8.4 DSP Cleanup Island

Controls:

- AGC;
- squelch;
- noise reduction;
- noise blanker;
- notch;
- mute.

Telemetry:

- audio level;
- squelch gate state;
- AGC gain history sparkline.

### 8.5 Mode + Filter Island

Controls:

- demod mode segmented control;
- filter preset segmented control;
- continuous bandwidth/offset editor;
- optional XY filter editor.

### 8.6 Capture Transport Island

Controls:

- record;
- play;
- stop;
- mark segment;
- corpus target;
- annotation label.

Telemetry:

- capture duration;
- sample count;
- dropped frame count;
- current file/session ID.

### 8.7 Hermes Diagnostics Island

Controls:

- discovery ping;
- stream start/stop;
- reset counters;
- packet filter.

Telemetry:

- discovery count;
- endpoint-6 frame count;
- last control sequence;
- parsed RX frequency;
- parsed TX frequency;
- sample rate;
- MOX state;
- packet jitter sparkline.

### 8.8 Safe TX Island

Cycle 1: locked.

Controls:

- PTT;
- VOX;
- FDX;
- ATU;
- predistortion;
- PS Cal.

Policy:

- visible as future seam;
- disabled unless hardware profile allows;
- must explain lock reason.

### 8.9 Command Island

Future agentic/deep manipulation surface.

Controls:

- natural language input;
- command palette;
- dry-run preview;
- approval buttons;
- command history.

Pipeline:

```text
operator text
  → intent parse
  → proposed SdrOperatorCommand
  → capability-policy check
  → dry-run preview
  → human confirmation if needed
  → execute
  → telemetry/event log
```

Example:

```text
"Find the strongest narrowband signal in this waterfall region and tune to it."

Proposed commands:
1. AnalyzeWaterfallRegion(region=selection, detector=narrowband)
2. MarkSignalCandidate(candidateId=...)
3. TuneReceiver(frequencyHz=..., mode=USB?)
4. SetFilter(widthHz=2200)

Requires confirmation before TuneReceiver.
```

The command island is not a chatbot bolted to the side. It is an island governed by the same profile/capability system as every other cockpit control.

---

## 9. Control binding model

A control does not directly mutate arbitrary UI state. It emits a typed operator command.

```text
Primitive gesture
  → ControlSurface adapter
  → SdrOperatorCommand
  → capability guard
  → backend adapter / state store
  → telemetry/event log
```

Examples:

```text
LNA slider drag
  → SetRfLna(db=20)
  → Hermes capability guard
  → OpenHPSDR control packet update
  → HermesControlState.lnaDb
  → RF Frontend Island telemetry

Record button
  → StartIqCapture(target=corpus/session)
  → capture capability guard
  → Python SDR lab capture runtime
  → CaptureTransportState.recording
  → event log

Mode segmented control
  → SetDemodMode(mode=LSB)
  → receiver capability guard
  → receiver state + DSP config
  → ModeFilterIsland active state
```

This is how buttons, sliders, dials, XY grids, and agent commands share a coherent substrate.

---

## 10. State architecture

FRKNK should define the contracts. TMNL should consume them.

```text
FRKNK
├─ Effect Schema contracts
├─ Python SDR runtime models
├─ Hermes/OpenHPSDR protocol bridge
├─ IQ capture/corpus models
└─ command/event contract definitions

TMNL
├─ cockpit component registry
├─ profile resolver
├─ tiling engine
├─ STX/effect-atom state adapters
├─ control surfaces
└─ visual cockpit shell
```

Recommended state domains:

```text
CockpitRuntimeState
├─ profile
├─ layoutResolved
├─ connection
├─ receiver
├─ rfFrontend
├─ dsp
├─ displaySurface
├─ capture
├─ diagnostics
├─ safety
└─ commandIsland
```

The architecture should prefer STX/effect-atom for React-facing state. Long-running RF/protocol work remains Python-owned where appropriate, with TypeScript contracts defining the seam.

---

## 11. Quisk semantic translation

| Quisk artifact | TMNL architecture target |
|---|---|
| fixed bottom button matrix | profile-resolved island layout |
| screen buttons | signal workbench surface modes |
| button groups | control-surface primitives |
| wrapped sliders | typed scalar controls with telemetry |
| Hermes bottom widgets | hardware/capability islands |
| config screen | diagnostics/settings drawer |
| tx buttons always visible | safe TX island with policy locks |
| mode/filter rows | Mode + Filter compound island |
| memory/favorites | bookmarks/capture/session island |
| record/play buttons | Capture Transport island |
| future assistant | Command Island governed by profile policy |

---

## 12. First implementation slice

Do not build every island at once. Prime, I know the temptation. Behave.

Recommended slice:

1. Define Effect Schema contracts:
   - `CockpitProfile`
   - `CockpitTile`
   - `CockpitIslandKind`
   - `CapabilityDecision`
   - `SdrOperatorCommand`
   - `ReceiverState`
   - `HermesDiagnosticsState`
2. Implement a deterministic profile resolver.
3. Implement static three-column tiling with profile data.
4. Build island shell + registry.
5. Build five islands:
   - `VfoHeaderIsland`
   - `SignalWorkbenchIsland`
   - `RfFrontendIsland`
   - `ModeFilterIsland`
   - `HermesDiagnosticsIsland`
6. Stub Command Island with typed dry-run display only.
7. Bind emulator state through FRKNK contracts.

Out of scope for first slice:

- actual TX enablement;
- fully freeform layout editing;
- agent execution;
- advanced ML locator UI;
- every Quisk config page.

---

## 13. Architectural guardrails

1. **Profiles are data.** Components are registered by island kind.
2. **Controls emit commands.** They do not hand-edit unrelated state.
3. **Capability policy is first-class.** Do not hide danger behind CSS disabled styling.
4. **Tiles are deterministic.** User overrides are deltas, not mutated defaults.
5. **Islands are compound components.** No button soup.
6. **Central display remains primary.** SDR is visual/time-frequency work.
7. **Agentic control is governed.** It must dry-run and pass policy like any other control.
8. **Quisk is a semantic oracle, not a style guide.**

---

## 14. One-sentence architecture

TMNL SDR is a profile-driven, three-column cockpit where compound control islands manipulate typed SDR state through capability-guarded operator commands, with Quisk providing the semantic map and FRKNK providing the runtime contracts.
