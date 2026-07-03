# TMNL SDR Cockpit Brief

Objective: build a TMNL-native SDR cockpit that preserves Quisk's useful radio semantics while
throwing its visual grammar into the sea where it belongs.

## Core stance

- Quisk remains the proven SDR/DSP/protocol reference.
- FRKNK owns SDR contracts, emulator/protocol runtime, IQ corpus, and sketch/locator sidecars.
- TMNL owns the operator cockpit: stateful UI, panels, overlays, command surfaces, diagnostics.
- Cycle 1 is receive-only. TX controls are visible only as locked/safe indicators.

## Primary surfaces

### 1. VFO Command Header

Purpose: the operator's anchor.

Fields:

- active RX frequency;
- VFO/base frequency;
- demod mode;
- filter bandwidth;
- sample rate;
- board identity and connection status;
- stream health.

Interactions:

- frequency entry;
- coarse/fine tune;
- band stepping;
- mode and filter quick switch;
- command palette shortcuts.

### 2. Spectrum Workbench

Purpose: clean FFT visibility and direct tune gestures.

Elements:

- spectrum trace;
- dB axis;
- frequency axis;
- passband overlay;
- cursor readout;
- candidate markers from lossy sketch locator;
- zoom/scale controls.

### 3. Waterfall Workbench

Purpose: time context.

Elements:

- scrolling waterfall texture;
- tone/signal persistence;
- event/candidate overlays;
- current passband and tuned center;
- capture bookmarks.

### 4. RF/DSP Control Rail

Purpose: expose RF and demod controls without Quisk's button carpet.

Groups:

- RF front-end: LNA, antenna, RF gain;
- DSP: AGC, squelch, noise reduction, blanker, notch;
- display: waterfall gain/zero/zoom;
- audio: volume, mute, output health.

### 5. Hermes Diagnostics Drawer

Purpose: make protocol truth inspectable.

Fields:

- discovery count;
- start/stop count;
- endpoint-6 frame count;
- frame rate;
- bytes sent/received;
- last PC→Hermes sequence;
- sample rate;
- RX/TX frequencies from C0 control words;
- receiver count;
- MOX/PTT state;
- board id/version/MAC.

### 6. Safe TX Rail

Purpose: acknowledge Quisk's transceiver model without pretending cycle 1 can transmit.

Visible but locked:

- PTT;
- VOX;
- FDX;
- Spot;
- predistortion;
- ATU;
- PA telemetry.

## State contracts to add/extend in FRKNK

Likely Effect Schema contracts:

- `SdrConnectionState`
- `HermesDiscoveryState`
- `HermesControlState`
- `HermesStreamStats`
- `ReceiverState`
- `DemodMode`
- `FilterPreset`
- `SpectrumFrame`
- `WaterfallTile`
- `SdrOperatorCommand`

## First build slice

1. Extend fake Hermes emulator with a JSON status endpoint or side-channel event stream.
2. Add FRKNK TS contracts mirroring Python `HermesControlState` and stream stats.
3. Build TMNL testbed route: `SDRCockpitTestbed`.
4. Render VFO header + spectrum/waterfall placeholder fed by deterministic IQ/sketch frames.
5. Add Hermes diagnostics drawer driven by emulator status.
6. Keep Quisk running separately as verifier until FRKNK can demodulate enough for confidence.

## Visual direction

Not Quisk.

Use TMNL language:

- dark instrument-panel base;
- high-contrast spectral color ramps;
- readable 12px minimum labels;
- dense but tiered controls;
- progressive disclosure for rarely used controls;
- live protocol evidence as small telemetry chips, not modal config swamp.

## Non-goals for cycle 1

- TX RF.
- Full Quisk feature parity.
- Recreating every config page.
- Supporting all hardware families.
- Pretending the ML sketch locator is truth.

## Success criteria

- Operator can see the fake Hermes tone in a TMNL-native surface.
- Operator can inspect protocol/control state without packet captures.
- Quisk remains available as side-by-side truth/verifier.
- UI conveys SDR intent without causing retinal despair.


## Related

- `quisk-ui-wireframe-breakdown.md` — total ASCII wireframe and component/state breakdown.

- `tmnl-sdr-cockpit-architecture.md` — profile-driven three-column tiling/island architecture.
