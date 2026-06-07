# Research: Muse EEG ingest options

## Summary
Best MVP: keep the headset/BLE work out of TypeScript. Use a local Python ingest service (BrainFlow or `muse-lsl`) to acquire Muse data, normalize it, and publish LSL streams; optionally fan out OSC for tools that want it. For a future TS/Effect app, consume the normalized stream via a Node LSL bridge if platform support is acceptable, otherwise bridge over localhost WebSocket/JSON. LSL is the best spine; OSC is the compatibility layer.

## Findings
1. **BrainFlow is the strongest device-facing API** — Muse is first-class in BrainFlow (`MUSE_2_BOARD`, `MUSE_S_BOARD`, `MUSE_2016_BOARD`, etc.), and BrainFlow splits device data into presets with their own sampling rates/timestamps. It exposes `get_sampling_rate`, `get_eeg_channels`, `get_board_descr`, and `add_streamer(...)`, so one acquisition layer can also serve as a preprocessing boundary. [BrainFlow Supported Boards](https://brainflow.readthedocs.io/en/stable/SupportedBoards.html), [BrainFlow Data Format Description](https://brainflow.readthedocs.io/en/stable/DataFormatDesc.html), [BrainFlow User API](https://brainflow.readthedocs.io/en/stable/UserAPI.html?highlight=MUSE_2016_BOARD)
2. **LSL is the best downstream transport spine** — LSL is built around outlets/inlets, metadata, and time correction. The docs recommend a small app pattern: acquire from device, preallocate buffers, create `StreamInfo`, optionally add XDF-style metadata, then create the outlet. That is exactly the contract a custom visualization/processing app wants. [LSL User Guide](https://labstreaminglayer.readthedocs.io/info/user_guide.html), [LSL App Development](https://labstreaminglayer.readthedocs.io/dev/app_dev.html), [LSL Examples](https://labstreaminglayer.readthedocs.io/dev/examples.html)
3. **OSC is simple, but it is only a transport** — OSC packets are UDP-friendly messages with address patterns and type tags. MuseIO publishes Muse data as OSC and the Muse docs list `/muse/eeg`, `/muse/eeg/quantization`, and `/muse/eeg/dropped_samples`. Great for compatible tools; weaker than LSL for timing, metadata, and schema discipline. [OSC spec](https://opensoundcontrol.stanford.edu/spec-1_0.html), [MuseIO](https://nagasm.org/ASL/Sketch06/Muse/museio.html), [Muse OSC Paths](https://nagasm.org/ASL/Sketch06/Muse/osc-paths---v3-6-0.html)
4. **Python Muse bridges are the practical path today** — `muse-lsl` explicitly supports Muse 2, Muse S, and Muse (2016), and it can stream EEG plus separate ACC/GYRO/PPG LSL streams. Other small projects do `muselsl -> OSC` for neurofeedback apps. Translation: use Python as the local radio/decoder boundary, not your TS app. [muse-lsl](https://github.com/alexandrebarachant/muse-lsl/), [muse-osc](https://github.com/operatorequals/muse-osc)
5. **Node/TypeScript can consume LSL, but should not own acquisition** — community Node LSL bindings exist, but the npm package is a wrapper around `liblsl` with known M-series focus and limited validation on x86/Linux/Windows. There is no official JS LSL stack, so TS is better as the consumer layer, not the BLE layer. [node-lsl](https://www.npmjs.com/package/@neurodevs/node-lsl), [LSL language wrappers](https://labstreaminglayer.readthedocs.io/info/language_wrappers.html)

## Recommended MVP architecture
**Muse headset → Python ingest service → canonical normalized schema → LSL streams → TS/Effect consumer**

- Use **BrainFlow** if you want acquisition + optional signal processing in one place.
- Use **`muse-lsl`** if you want the quickest stable Muse-to-LSL path.
- Normalize to one internal event/frame shape before emitting anything else.
- Fan out **OSC only as a compatibility output**, not as the primary data model.
- If TS must consume live data directly, bridge LSL to localhost via Node or a tiny websocket adapter.

## Normalization contract
Keep one internal shape regardless of transport:
- `source`: vendor/model/firmware/boardId
- `stream`: `eeg | acc | gyro | ppg | marker`
- `sampleRate`
- `channels`: name, index, unit, montage
- `samples`: chunked numeric arrays
- `timestamps`: device + host
- `sequence` / `droppedSamples`
- `transportMeta`: LSL stream info, OSC address, BrainFlow preset, quantization

Normalize EEG to **microvolts** where possible; preserve raw/quantized values as secondary fields. MuseIO already emits `/muse/eeg` in microvolts and exposes quantization/dropped-sample metadata, while BrainFlow gives channel and preset separation for Muse data. [Muse OSC Paths](https://nagasm.org/ASL/Sketch06/Muse/osc-paths---v3-6-0.html), [BrainFlow Data Format Description](https://brainflow.readthedocs.io/en/stable/DataFormatDesc.html)

## Tradeoffs
- **BrainFlow**: best structure, strongest board abstraction; not TS-native.
- **LSL**: best sync/metadata story; still needs an acquisition bridge.
- **OSC**: easiest compatibility; weakest rigor.
- **Python bridge**: most battle-tested; adds a runtime.
- **Node bridge**: nice for TS consumption; platform support is the catch.

## Sources
- Kept: BrainFlow Supported Boards (https://brainflow.readthedocs.io/en/stable/SupportedBoards.html) — confirms Muse board support and IDs.
- Kept: BrainFlow Data Format Description (https://brainflow.readthedocs.io/en/stable/DataFormatDesc.html) — explains presets, channel helpers, and data layout.
- Kept: BrainFlow User API (https://brainflow.readthedocs.io/en/stable/UserAPI.html?highlight=MUSE_2016_BOARD) — shows board-agnostic API and streamer hooks.
- Kept: LSL User Guide (https://labstreaminglayer.readthedocs.io/info/user_guide.html) — explains outlet/inlet discovery and time-corrected transport.
- Kept: LSL App Development (https://labstreaminglayer.readthedocs.io/dev/app_dev.html) — shows the recommended app structure.
- Kept: LSL Examples (https://labstreaminglayer.readthedocs.io/dev/examples.html) — documents metadata/XDF conventions and stream shapes.
- Kept: OSC spec 1.0 (https://opensoundcontrol.stanford.edu/spec-1_0.html) — defines OSC packets, addresses, and type tags.
- Kept: MuseIO / OSC Paths (https://nagasm.org/ASL/Sketch06/Muse/museio.html, https://nagasm.org/ASL/Sketch06/Muse/osc-paths---v3-6-0.html) — canonical Muse OSC output and field meanings.
- Kept: muse-lsl (https://github.com/alexandrebarachant/muse-lsl/) — pragmatic Muse-to-LSL bridge.
- Kept: muse-osc (https://github.com/operatorequals/muse-osc) — practical LSL-to-OSC fanout example.
- Kept: node-lsl (https://www.npmjs.com/package/@neurodevs/node-lsl) — current Node binding status and platform caveats.
- Dropped: muse-rs docs — useful, but implementation-specific and redundant for this decision.
- Dropped: muse-lsl PyPI page — redundant with the GitHub README.
- Dropped: `brainflow_boards.cpp` source — duplicate of the docs for this purpose.

## Gaps
- I did not benchmark latency, dropout, or CPU use across BrainFlow vs `muse-lsl` vs MuseIO.
- I did not verify a production-grade Node LSL binding that is equally solid on Linux/Windows.
- I did not confirm the best path for Muse S Athena specifically; verify firmware/protocol if that headset is in scope.
