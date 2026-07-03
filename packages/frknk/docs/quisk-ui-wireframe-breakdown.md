# Quisk Cockpit — Total UI Breakdown + ASCII Wireframe

Reference captures:

- `packages/frknk/docs/screenshots/quisk-visible-main.png`
- `packages/frknk/docs/screenshots/quisk-main-cockpit-cropped.png`
- `packages/frknk/docs/screenshots/quisk-control-bank-cropped.png`

Source map:

- App composition: Nixpkgs `quisk-4.2.50`, `quisk.py`
- Hermes widgets: `hermes/quisk_widgets.py`
- Hermes hardware/protocol: `hermes/quisk_hardware.py`
- Config screens: `configure.py`

DeepWiki note: attempted first against `jimahlstrom/quisk`, `IW0HDV/quisk`, and `df8oe/quisk`; all were unindexed.

---

## 0. Window macrostructure

Captured Quisk is a single top-level wxPython frame containing:

1. Primary signal display region.
2. Frequency axis strip.
3. Dense bottom control bank.
4. Hermes-Lite-specific bottom widget row.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  QUISK MAIN FRAME                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                                        │  │
│  │                           A. PRIMARY SIGNAL DISPLAY                                    │  │
│  │                                                                                        │  │
│  │  y-axis dB scale   spectrum/waterfall/scope/bandscope surface                          │  │
│  │  -40..-150         passband shade + tuned frequency marker                             │  │
│  │                                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────────────────────┐  │
│  │                            B. FREQUENCY AXIS / TICK STRIP                              │  │
│  │          -20      -15      -10      -5       0       5       10      15       20        │  │
│  └────────────────────────────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  C. CONTROL BANK: frequency, bands, memories, receive/DSP, mode/filter, screens, sliders     │
├──────────────────────────────────────────────────────────────────────────────────────────────┤
│  D. HERMES-LITE BOTTOM WIDGETS: PS, PS Cal, ATU, RfLna, telemetry/PA widgets                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

TMNL translation: keep the four semantic zones, but invert the information architecture. The display is the cockpit, controls are tiered rails/drawers, not a permanent keyboard of buttons.

---

## 1. Primary signal display

Captured state: `Graph` screen selected. The plot is a pale spectrum graph with horizontal dB grid lines, x-axis frequency ticks, a shaded filter/passband region, and a red tuned frequency marker.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ A. GRAPH / SPECTRUM DISPLAY                                                                  │
│                                                                                              │
│ -40 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│ -50 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│ -60 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│ -70 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│ -80 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│ -90 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│-100 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│-110 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│-120 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│-130 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│-140 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│-150 ───────────────────────────────────────────────────────────────────────────────────────  │
│                                                                                              │
│                         ░░░░░░░░░░░                                                          │
│                         ░ PASSBAND ░ │ red tuned-frequency marker                            │
│                         ░░░░░░░░░░░  │                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Source classes:

- `GraphDisplay`
- `GraphScreen`
- `MultiRxGraph`
- `FilterScreen`
- `AudioFFTScreen`

Responsibilities:

- render FFT/spectrum data;
- draw y-axis grid and dB labels;
- draw x-axis frequency ticks;
- display passband/filter overlay;
- support mouse tuning, drag, wheel zoom;
- show multi-receiver overlays.

TMNL clone components:

- `SpectrumPanel`
- `DbAxis`
- `FrequencyAxis`
- `PassbandOverlay`
- `TunedFrequencyCursor`
- `ReceiverOverlayLayer`
- `SignalCandidateOverlay`

State domains:

- `SpectrumFrame`
- `ReceiverState[]`
- `FilterState`
- `DisplayScaleState`
- `TuneGestureState`

---

## 2. Frequency axis strip

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ B. FREQUENCY AXIS STRIP                                                                      │
│                                                                                              │
│   | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | | |    │
│      -20          -15          -10           -5           0           5           10          │
│                                                   ▲                                          │
│                                              tuned center                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Source behavior:

- tick math lives in graph/waterfall screen classes;
- current tuned point and filter center are updated by tuning/mode/filter handlers.

TMNL translation:

- axis belongs to the display panel, not global frame chrome;
- pointer hover should emit exact Hz offset + absolute RF frequency;
- zoom should preserve cursor-centered or passband-centered intent.

---

## 3. Bottom control bank — complete captured layout

The captured control bank has a vertical volume slider at far left, then multiple dense rows of controls. This is the area we mine for semantics and then redesign.

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ C0. TOP ROW: POWER / VFO / MEMORY / AUX / RIT / DISPLAY SLIDERS                              │
├─────┬──────┬────────────────┬────────┬────┬────┬──────┬──────┬──────┬──────┬──────┬────────┤
│ Vol │  On  │      0 Hz       │ entry  │ ⇩  │ ⇧  │  M↑  │ M→   │ M×   │ ★↑   │ ★↓   │ ●  ▶   │
│     │      │ frequency disp  │        │band│band│mem   │mem   │mem   │fav   │fav   │rec/play│
├─────┴──────┴────────────────┴────────┴────┴────┴──────┴──────┴──────┴──────┴──────┴────────┤
│  Add Rx │ menu/list │ text/status field │ menu/list │ RIT 0 │        Rit │ Ys │ Yz │ Zo        │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

Observed labels:

- `On`
- large frequency display: `0 Hz` in capture
- band down/up arrows
- memory add/next/delete icons
- favorites add/recall icons
- red record dot, play triangle
- `Add Rx`
- list/menu buttons
- `RIT 0`
- vertical sliders: `Rit`, `Ys`, `Yz`, `Zo`

Source handlers:

- `OnBtnOnOff`
- `FreqEntry`
- `OnBtnDownBand`, `OnBtnUpBand`, `OnBtnUpDnBandDone`
- `OnBtnMemSave`, `OnBtnMemNext`, `OnBtnMemDelete`
- `OnBtnFavoritesNew`, `OnBtnFavoritesShow`
- `OnBtnTmpRecord`, `OnBtnTmpPlay`, `OnBtnFileRecord`, `OnBtnFilePlay`
- `MultiReceiverScreen.OnAddReceiver`
- `OnBtnRit`, `OnRitScale`
- `ChangeYscale`, `ChangeYzero`, `OnChangeZoom`

TMNL target:

- `VfoHeader` owns On/connection/frequency/band stepping.
- Memory/favorites move to a collapsible `BookmarksDrawer`.
- Record/play move to `CaptureTransport` with explicit corpus targets.
- RIT/Ys/Yz/Zo become contextual display controls, not unlabeled slider spaghetti.

---

## 4. Band row

Captured row:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ C1. BAND / AUDIO ROW                                                                          │
├────────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┬────────────┤
│ Audio  │ 160  │  80  │ 60~  │  40  │  30  │  20  │  17  │  15  │  12  │  10    │ Time↓ ...  │
└────────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴────────┴────────────┘
```

Meaning:

- `Audio` is the selected/active band-like category in capture.
- Numeric labels are HF bands.
- `Time↓` appears as part of a screen/aux group in the same row.

Source:

- `bandBtnGroup`
- `conf.bandLabels`
- `OnBtnBand`

TMNL target:

- `BandSelector` as segmented control or command palette group.
- Show absolute band ranges and current allocation metadata when expanded.

---

## 5. Receive/DSP row

Captured row:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ C2. RECEIVE / DSP CONTROLS                                                                    │
├────────┬──────┬────────┬────┬────────┬────┬────────┬──────┬────────┬──────────┬─────────────┤
│ Mute   │ NR2~ │  AGC   │ ⇳  │ Sqlch  │ ⇳  │ NB 1   │ menu │ Notch  │ Ant 0~   │ Test 1      │
└────────┴──────┴────────┴────┴────────┴────┴────────┴──────┴────────┴──────────┴─────────────┘
```

Meaning:

- `Mute`: audio output mute.
- `NR2~`: noise reduction mode/cycle.
- `AGC`: automatic gain control + wrapped slider.
- `Sqlch`: squelch + wrapped slider.
- `NB 1`: noise blanker with popup menu.
- `Notch`: auto notch.
- `Ant 0~`: hardware antenna cycle from Hermes hardware labels.
- `Test 1`: generic test/custom button.

Source:

- `OnBtnMute`
- `OnBtnNR2`
- `OnBtnAGC`
- `OnBtnSquelch`
- `OnMenuNB`, `OnBtnNB`
- `OnBtnAutoNotch`
- `Hardware.OnButtonAntenna`

TMNL target:

```text
RF / DSP Rail
├─ Audio: Volume, Mute
├─ Gain: RF Gain / LNA / AGC
├─ Cleanup: NR, NB, Notch
└─ Front-end: Antenna, attenuator, hardware status
```

Use readable chips/sliders with values, not ambiguous tilde buttons.

---

## 6. TX / split / capture row

Captured row:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ C3. TX / SPLIT / CAPTURE                                                                      │
├────────┬────┬────────┬──────┬──────┬──────┬──────────┬──────────┬──────────────┬─────────────┤
│ Spot   │ ⇳  │ Split  │ menu │ FDX  │ PTT  │ VOX      │ File ●   │ File ▶       │             │
└────────┴────┴────────┴──────┴──────┴──────┴──────────┴──────────┴──────────────┴─────────────┘
```

Meaning:

- `Spot`: tone/carrier spot, slider wrapped.
- `Split`: split RX/TX frequency mode with menu.
- `FDX`: full duplex.
- `PTT`: transmit push-to-talk.
- `VOX`: voice-operated transmit.
- `File ●` / `File ▶`: record/play controls.

Cycle-1 TMNL decision:

- TX controls are present as **locked/safe rail**.
- Show why locked: `receive-only emulator`, `no TX RF path`, `no PA/QSK contract`.
- Keep file/corpus capture active, because that is useful and safe.

---

## 7. Mode/filter/screen cluster

Captured right-side rows:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ C4. MODE ROW                                                                                  │
├────────┬────────┬────────┬────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ CWL~   │ LSB~   │ AM     │ FM     │ DGT-U~   │ FDV-U~   │ ...      │ ...      │             │
└────────┴────────┴────────┴────────┴──────────┴──────────┴──────────┴──────────┴─────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ C5. FILTER ROW                                                                                │
├────────┬────────┬────────┬────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ 2000   │ 2200   │ 2500   │ 2800   │ 3000     │ 1000 ⇳   │ ...      │ ...      │             │
└────────┴────────┴────────┴────────┴──────────┴──────────┴──────────┴──────────┴─────────────┘

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ C6. SCREEN SELECTOR                                                                           │
├────────┬────────┬────────┬────────┬──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Graph~ │ WFall~ │ Scope~ │ Config │ Bscope   │ Help     │ ...      │ ...      │             │
└────────┴────────┴────────┴────────┴──────────┴──────────┴──────────┴──────────┴─────────────┘
```

Source:

- `modeButns`, `OnBtnMode`
- `filterButns`, `OnBtnFilter`, `OnBtnAdjFilter`
- `screenBtnGroup`, `OnBtnScreen`

Modes in source:

- CWL / CWU
- LSB / USB
- AM
- FM
- DGT-U / DGT-L / DGT-FM / DGT-IQ
- FDV-U / FDV-L
- IMD

Screens in source:

- Graph / GraphP1 / GraphP2
- WFall / WFallP1 / WFallP2
- Scope
- Config
- Bscope or RX Filter or Audio FFT
- Help

TMNL target:

- `ModeStrip`: segmented, with current passband expectation.
- `FilterStrip`: preset buttons plus continuous bandwidth editor.
- `SurfaceTabs`: Graph / Waterfall / Scope / Bandscope / Diagnostics.
- Hide rarely used split variants in menus or command palette.

---

## 8. Hermes-Lite bottom widget row

Captured row:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ D. HERMES-LITE BOTTOM WIDGETS                                                                 │
├────────┬────────┬────────────────┬──────────────┬───────────────────────────────────────────┤
│  PS    │ PS Cal │ ATU [dropdown] │ RfLna 20 dB  │ horizontal LNA slider                     │
└────────┴────────┴────────────────┴──────────────┴───────────────────────────────────────────┘
```

Source: `hermes/quisk_widgets.py`, `BottomWidgets.Widgets_0x06()`.

Controls:

- `PS`: predistortion enable.
- `PS Cal`: predistortion calibration.
- `ATU`: Tune / Bypass / transient ATU state.
- `RfLna`: LNA gain slider, -12 to 48 dB.
- Telemetry labels on larger layouts:
  - temperature;
  - PA current;
  - forward/PEP power;
  - SWR.

TMNL decision:

- `RfLna` belongs in RF/DSP rail.
- PS, PS Cal, ATU, PA telemetry belong in **Safe TX / Hardware drawer**.
- In cycle 1, PS/ATU/PA controls are locked or simulated-only.

---

## 9. Screen inventory wireframe

Quisk internally creates multiple full-size screens and toggles visibility.

```text
Screen Stack (only one visible at a time)

┌──────────────────────┐
│ MultiReceiverScreen  │  primary Graph/Waterfall receiver surface
├──────────────────────┤
│ ConfigScreen         │  status/config/favorites/tx audio notebook
├──────────────────────┤
│ ScopeScreen          │  oscilloscope waveform
├──────────────────────┤
│ BandscopeScreen      │  Hermes bandscope when clock available
├──────────────────────┤
│ FilterScreen         │  RX filter response display
├──────────────────────┤
│ AudioFFTScreen       │  optional audio FFT
├──────────────────────┤
│ HelpScreen           │  HTML help
├──────────────────────┤
│ StationScreen        │  station/favorites display
└──────────────────────┘
```

TMNL replacement:

```text
TMNL SDR Workspace

┌─────────────────────────────────────────────────────────────────────────────┐
│ VFO Header + Connection Telemetry                                           │
├───────────────────────────────┬─────────────────────────────────────────────┤
│ Spectrum/Waterfall Workbench  │ Right Rail                                  │
│                               │ ├─ RF/DSP                                   │
│                               │ ├─ Mode/Filter                              │
│                               │ ├─ Bookmarks                                │
│                               │ └─ Safe TX                                  │
├───────────────────────────────┴─────────────────────────────────────────────┤
│ Diagnostics Drawer: Hermes packets, emulator stats, sketch candidates        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Semantic component table

| Legacy surface | Source | State / behavior | TMNL clone component |
|---|---|---|---|
| Main frame | `QMainFrame` | window title, config text | `SdrCockpitShell` |
| Screen stack | `App.OnInit` | show/hide selected screen | `SdrWorkspaceTabs` |
| Spectrum | `GraphScreen`, `MultiRxGraph` | FFT, filter overlay, tune gestures | `SpectrumPanel` |
| Waterfall | `WaterfallScreen` | spectral time history | `WaterfallPanel` |
| Bandscope | `BandscopeScreen` | wideband/bandscope view | `BandscopePanel` |
| Scope | `ScopeScreen` | waveform display | `SignalScopePanel` |
| VFO | `FrequencyDisplay`, handlers | tuned frequency / entry | `VfoHeader` |
| Band buttons | `bandBtnGroup` | band selection | `BandSelector` |
| Mode buttons | `modeButns` | demodulation mode | `ModeStrip` |
| Filter buttons | `filterButns` | passband presets | `FilterStrip` |
| S-meter | `smeter`, `NewSmeter` | signal level | `SignalMeter` |
| RIT | `ritButton`, `ritScale` | receiver incremental tuning | `RitControl` |
| AGC | `BtnAGC`, `SliderAGC` | AGC enabled/level | `AgcControl` |
| Squelch | `BtnSquelch` | squelch threshold | `SquelchControl` |
| Noise reduction | `NR2`, `NB_menu` | NR/NB modes | `NoiseMitigationGroup` |
| Notch | `OnBtnAutoNotch` | auto notch | `NotchControl` |
| LNA | Hermes `sliderLNA` | LNA dB | `LnaControl` |
| ATU | Hermes `atu_ctrl` | tune/bypass/accessory state | `AtuControl` locked in cycle 1 |
| PTT/VOX/FDX | TX row | transmit controls | `SafeTxRail` locked in cycle 1 |
| Protocol state | `quisk_hardware.py` + emulator | discovery/start/control/IQ stream | `HermesDiagnosticsDrawer` |

---

## 11. State domains for FRKNK/TMNL contracts

```text
SdrCockpitState
├─ connection: SdrConnectionState
│  ├─ status: disconnected | discovering | streaming | error
│  ├─ boardId / codeVersion / mac / ip
│  └─ sampleRateHz
├─ receiver: ReceiverState
│  ├─ vfoFrequencyHz
│  ├─ txFrequencyHz
│  ├─ ritHz
│  ├─ mode
│  └─ filter
├─ display: DisplayState
│  ├─ surface: graph | waterfall | scope | bandscope | filter | diagnostics
│  ├─ yScale
│  ├─ yZero
│  └─ zoom
├─ dsp: DspState
│  ├─ agc
│  ├─ squelch
│  ├─ noiseReduction
│  ├─ noiseBlanker
│  └─ notch
├─ rf: RfFrontendState
│  ├─ lnaDb
│  ├─ antenna
│  └─ rfGain
├─ protocol: HermesProtocolState
│  ├─ discoveryCount
│  ├─ startStopCount
│  ├─ lastControlSequence
│  ├─ endpoint6Frames
│  └─ droppedFrames
└─ safety: TxSafetyState
   ├─ txEnabled: false in cycle 1
   ├─ pttLockedReason
   └─ unsafeControls[]
```

---

## 12. What to keep vs discard

Keep:

- SDR semantic coverage.
- Frequency axis + spectrum + waterfall model.
- Mode/filter interaction model.
- Hermes protocol/control state.
- Hardware-specific extension seam.
- S-meter and RF/DSP controls.

Discard:

- always-on button carpet;
- ambiguous labels and tilde suffixes;
- tiny unlabeled vertical sliders;
- config swamp as a primary UX path;
- hardware widgets injected into rows by side effect;
- TX controls looking available when the backend is receive-only.

---

## 13. Next screenshot actions

Now that visible capture works, capture these next:

1. `WFall` selected.
2. `Bscope` selected.
3. `Scope` selected.
4. `Config` selected.
5. `NB` popup open.
6. `Split` popup open.
7. `ATU` dropdown open.
8. S-meter popup open.

These can be captured from the live Quisk process with `grim`; interaction can be manual or via XWayland tooling if available.


## Related

- `tmnl-sdr-cockpit-architecture.md` — TMNL-native cockpit architecture derived from this Quisk semantic inventory.
