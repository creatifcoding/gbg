# Quisk UI Recon for a TMNL SDR Cockpit

Status: preliminary static recon + protocol-backed Quisk run. DeepWiki was attempted first but
`jimahlstrom/quisk`, `IW0HDV/quisk`, and `df8oe/quisk` are not indexed as of this pass.

## DeepWiki question matrix attempted

All returned `Repository not found`; preserve the question set for re-run once indexed:

1. Enumerate Quisk's UI architecture in fine detail: wxPython entrypoints/classes, windows,
   tabs/screens, graph/waterfall/scope panels, config panels, menu/tool controls, visual
   composition.
2. Map Hermes-Lite/OpenHPSDR-specific UI: widgets, config screens, status fields, buttons,
   meters, radio controls, file/class/function names.
3. For a React/TMNL clone, extract UI surfaces and state domains grouped by display, tuning,
   demodulation, audio, transmit, configuration, hardware status, and protocol diagnostics.
4. Enumerate screenshots needed to fully document Quisk: screen/state list and user actions.

## Source basis used instead

Execution target:

- Nixpkgs `quisk-4.2.50`

Reference checkout:

- `/tmp/quisk-research`

Important source files:

- Quisk app and main UI: `quisk.py`
- Hermes/Hermes-Lite widgets: `hermes/quisk_widgets.py`
- Hermes protocol/hardware bridge: `hermes/quisk_hardware.py`
- Runtime configuration UI: `configure.py`

## Top-level composition

Quisk is a single wxPython app with a large `App` class and a `QMainFrame` window.

The main frame composes:

1. A single active screen region.
2. Hidden sibling screens switched by screen buttons.
3. A spacer bar.
4. A dense `GridBagSizer` control bank.
5. Optional hardware-specific bottom widgets injected by `quisk_widgets.BottomWidgets`.

Screens are constructed in `App.OnInit()` and then hidden/shown:

- `MultiReceiverScreen` — primary graph/waterfall receiver surface.
- `ConfigScreen` — status/config/favorites/tx-audio notebook.
- `ScopeScreen` — oscilloscope-like signal view.
- `BandscopeScreen` — Hermes/OpenHPSDR bandscope when `bandscope_clock` exists.
- `FilterScreen` — RX filter visualization.
- `AudioFFTScreen` — audio FFT when enabled.
- `HelpScreen` — embedded HTML help.
- `StationScreen` — station/favorites display.

## Display surfaces

### Graph stack

Classes:

- `GraphDisplay`
- `GraphScreen`
- `MultiRxGraph`
- `FilterScreen`
- `AudioFFTScreen`

Responsibilities:

- Spectrum graph rendering.
- Frequency ticks and dB scale.
- Mouse click/drag/wheel tuning.
- Filter passband overlay.
- Multi-receiver overlays and per-RX graph toggles.

TMNL equivalent:

- `SpectrumPanel`
- `FrequencyAxis`
- `PassbandOverlay`
- `ReceiverLane[]`
- pointer-intent state machine for tune / drag / zoom.

### Waterfall stack

Classes:

- `WaterfallDisplay`
- `WaterfallScreen`
- `WaterfallPane`
- `BandscopeScreen`

Responsibilities:

- Time-scrolling spectral intensity.
- Split graph+waterfall panes.
- Main RX waterfall and optional bandscope.

TMNL equivalent:

- WebGL/canvas waterfall with FRKNK IQ/sketch stream input.
- Separate `ReceiverWaterfall` and `BandScope` surfaces.

### Scope stack

Class:

- `ScopeScreen`

Responsibilities:

- Oscilloscope-like waveform view.
- Grid/tick rendering.

TMNL equivalent:

- `SignalScopePanel` fed by demod/audio/IQ preview state.

## Main control bank

Constructed in `App.MakeButtons()`.

### Left side / receive controls

- Vertical `Vol` slider.
- Optional sidetone `STo` slider.
- `Mute`.
- `NR2` / `NR2t` noise reduction cycle.
- `AGC` with wrapped slider.
- `Sqlch` with wrapped slider.
- `NB 1` noise blanker button with menu for `NB 1`, `NB 2`, `NB 3`, `SNB`.
- `Notch`.
- Hardware RF gain cycle when available.
- Hardware antenna cycle when available.

TMNL state domains:

- Audio output gain.
- DSP toggles and intensity values.
- RF front-end gain/antenna selection.

### Transmit / split row

- `Spot` with level slider.
- `Split` with menu:
  - Play both, high freq right/left.
  - Play only Rx/Tx.
  - Tx/Rx lock choices.
  - Reverse Rx and Tx.
- `FDX`.
- `PTT` with Tx indicator wrapper.
- `VOX`.
- `Add Rx` multi-receiver control.
- File record/play.

Cycle-1 TMNL boundary:

- Render TX controls as disabled/safe receive-only indicators until FRKNK explicitly enables TX.

### Right side / mode and filter controls

Modes:

- `CWL`, `CWU`
- `LSB`, `USB`
- `AM`
- `FM`
- `DGT-U`, `DGT-L`, `DGT-FM`, `DGT-IQ`
- `FDV-U`, `FDV-L`
- `IMD`

Filters:

- Six filter buttons, final slot adjustable via wrapped slider.
- Filter bandwidth maps by mode and propagates to graph/waterfall overlays.

Screens:

- `Graph`, `GraphP1`, `GraphP2`
- `WFall`, `WFallP1`, `WFallP2`
- `Scope`
- `Config`
- `Bscope` when Hermes bandscope exists; otherwise `RX Filter` or `Audio FFT`
- `Help`

TMNL equivalent:

- `ModeStrip`
- `FilterStrip`
- `SurfaceTabs` or command palette surface switching.

### Top row

- On/off button.
- Large frequency display.
- Frequency entry.
- Band up/down repeat buttons.
- Memory add/next/delete.
- Favorites add/recall.
- Temp record/play.
- Add Rx.
- S-meter with popup mode menu.
- RIT button plus vertical RIT slider.
- Vertical Ys/Yz/Zo sliders for display scale/zero/zoom.

TMNL equivalent:

- Central VFO capsule.
- S-meter / signal diagnostics capsule.
- Display scale controls folded into graph panel chrome.
- Memory/favorites as secondary rail, not always-on clutter.

## Hermes-Lite-specific UI

File: `hermes/quisk_widgets.py`

`BottomWidgets.Widgets_0x06()` injects a bottom-row Hermes-Lite panel:

- `PS` predistortion enable checkbutton.
- `PS Cal` predistortion calibration button.
- `ATU` combo: `Tune`, `Bypass`, transient states like `Tuning`, `ATU OK`, `ATU RF`, errors.
- `RfLna` horizontal slider from `-12` to `48` dB.
- Telemetry text:
  - temperature in °C;
  - PA current in mA;
  - forward/PEP power;
  - SWR.

File: `configure.py`

`RadioHardware` exposes Hermes/Hermes-Lite config controls:

- gateware update if hardware supports it;
- power meter calibration choices/new calibration dialog;
- Hermes bias adjust controls for PA bias 0/1;
- write-bias button;
- Hermes/Hermes-Lite settings from config metadata.

File: `hermes/quisk_hardware.py`

Hardware state exposed to widgets:

- `hermes_temperature`
- `hermes_fwd_power`
- `hermes_rev_power`
- `hermes_pa_current`
- `is_HermesLite2`
- antenna labels;
- LNA/gain changes;
- I2C read/write queue for HL2 accessories.

Cycle-1 TMNL boundary:

- Show telemetry as protocol diagnostics, but do not fake PA or ATU correctness until emulator supports those packets.
- Keep PS/PS Cal/ATU/TX controls visibly disabled or marked simulator-only.

## TMNL clone first vertical slice

Minimum viable SDR cockpit that does not suck:

1. **VFO Header**
   - active frequency;
   - sample rate;
   - receiver count;
   - connection state;
   - board identity (`Hermes-Lite`, board `0x06`).

2. **Spectrum + Waterfall Workbench**
   - deterministic tone from fake Hermes emulator;
   - passband overlay;
   - zoom/scale controls;
   - candidate/annotation overlay ready for lossy sketch locator.

3. **Mode/Filter Strip**
   - modes from Quisk, rendered as compact segmented controls;
   - filter presets + adjustable bandwidth.

4. **RF/DSP Side Rail**
   - RF gain/LNA;
   - AGC;
   - squelch;
   - noise reduction / blanker;
   - notch.

5. **Protocol Diagnostics Drawer**
   - discovery/start/stop/control packet counters;
   - last PC→Hermes control state;
   - stream fps / dropped frames;
   - emulator source profile.

6. **TX Safety Rail**
   - PTT/VOX/FDX/Spot present as disabled/locked in receive-only cycle 1.

## Screenshot capture plan

Needed captures:

1. Main Graph screen with fake Hermes connected.
2. Waterfall screen showing deterministic tone.
3. Bandscope screen (`Bscope`) under Hermes mode.
4. Scope screen.
5. RX Filter screen.
6. Config/status screen.
7. Config/radio hardware Hermes page.
8. Hermes bottom widget row close-up.
9. S-meter popup menu.
10. Split popup menu.
11. Noise blanker popup menu.
12. Small-screen layout variant, if we care about responsive behavior.

Current evidence:

- A Quisk run against the FRKNK emulator successfully exchanged discovery, stop/start, control,
  and endpoint-6 streaming packets.
- Xvfb root screenshots are currently blank because Quisk does not map visible X child windows in
  the headless test despite running and exchanging packets. Next capture should use either:
  - a real visible Wayland/XWayland session with `grim` after explicit operator approval; or
  - a nested compositor/window-manager harness if we want fully headless screenshots.

## Design warning

Quisk's UI is functionally rich but compositionally hostile: dense always-on controls, many tiny
labels, mixed rendering concerns, and hardware controls injected into layout by side-effect. The clone
should preserve the SDR semantics, not the layout pathology.


## Related

- `quisk-ui-wireframe-breakdown.md` — total ASCII wireframe and component/state breakdown.

- `tmnl-sdr-cockpit-architecture.md` — architecture pivot from Quisk UI recon to TMNL cockpit profiles/islands.
