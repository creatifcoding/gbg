# Plan: SDR Integration Documentation

## Deliverable 1: `docs/tsingou/SDR_INTEGRATION.md`

Full SDR pipeline specification — "antenna to pixel" — covering the complete signal chain from RF hardware through GNU Radio DSP, NATS transport, Tsingou ingestion, and 4-layer rendering.

### Document Structure

```
# SDR Integration — Antenna to Pixel

## 1. Overview & Architecture
   - SDR integration philosophy: Tsingou does NOT do DSP
   - Dual-path architecture diagram (GNU Radio bridge + RTL-SDR sidecar)
   - Signal flow: antenna -> SDR hardware -> DSP (GNU Radio/sidecar) -> NATS -> HolonetBridgeAdapter -> d2ts -> rendering

## 2. SDR Hardware Reference
   ### 2.1 Device Comparison Matrix
   - RTL-SDR v4 (R828D tuner, RX-only, 24-1766 MHz, ~$30, 2.4 MSPS stable)
   - HackRF One (MAX2839, TX/RX half-duplex, 1 MHz-6 GHz, 8-20 MSPS, ~$350)
   - LimeSDR (LMS7002M, full-duplex MIMO, 100 kHz-3.8 GHz, ~$300)
   - ADALM-Pluto (AD9364, TX/RX, 325 MHz-3.8 GHz, ~$150)
   - USRP B200/B210 (AD9364/AD9361, 70 MHz-6 GHz, 56 MHz BW, $1k-$10k)

   ### 2.2 Driver APIs
   - librtlsdr: rtlsdr_open, rtlsdr_set_center_freq, rtlsdr_set_sample_rate, rtlsdr_read_async
   - libhackrf: hackrf_open, hackrf_set_freq, hackrf_set_sample_rate, hackrf_start_rx
   - UHD (USRP): uhd::usrp::multi_usrp, set_rx_rate, set_rx_freq, get_rx_stream
   - SoapySDR: universal driver abstraction layer (LimeSDR, Pluto, others)

   ### 2.3 USB Transport & Bandwidth
   - USB 2.0 limits (RTL-SDR: 480 Mbps theoretical, ~2.4 MSPS stable)
   - USB 3.0 limits (HackRF: 5 Gbps, USRP: 61.44 MSPS)
   - Buffer sizing and dropped sample prevention
   - Ring buffer optimization pattern (rtl_tcp case study)

## 3. IQ Sample Formats
   ### 3.1 Format Reference Table
   - CU8 (RTL-SDR native): unsigned 8-bit, 16 bits/sample
   - CS8: signed 8-bit
   - CS16 (HackRF/Pluto native): signed 16-bit, 32 bits/sample
   - CF32 (GNU Radio native): 32-bit float, 64 bits/sample
   - CF64: 64-bit double float, 128 bits/sample

   ### 3.2 Conversion Pipeline
   - CU8 -> CF32 normalization formula
   - CS16 -> CF32 normalization formula
   - Interleaved layout: [I0, Q0, I1, Q1, ...]
   - Byte-order considerations (little-endian standard)

   ### 3.3 Bandwidth Calculations
   - RTL-SDR @ 2.4 MSPS CU8: 4.8 MB/s
   - HackRF @ 20 MSPS CS8: 40 MB/s
   - USRP @ 56 MSPS CF32: 448 MB/s
   - NATS message sizing implications

## 4. GNU Radio Architecture
   ### 4.1 Flow Graph Model
   - Blocks (source, processing, sink), ports, connections
   - Sample streams (continuous) vs message passing (async PMT)
   - GRC (GNU Radio Companion) → Python code generation
   - Scheduler: work() function, buffer management, thread pool

   ### 4.2 GNU Radio 3.10 (Current Stable)
   - OOT module structure (gr_modtool)
   - Python blocks: gr.sync_block, gr.basic_block
   - C++ blocks with pybind11
   - YAML block descriptors

   ### 4.3 GNU Radio 4.0 (Future)
   - Clean-slate scheduler (newsched)
   - Heterogeneous computing (CPU/GPU)
   - Scheduler-as-a-plugin architecture
   - Block API changes

   ### 4.4 ZMQ Bridge Pattern
   - ZMQ PUB Sink → ZMQ SUB Source (inter-process)
   - ZMQ PUB Message Sink (PMT-based, async)
   - Stream blocks vs Message blocks
   - ZMQ as GNU Radio ↔ NATS bridge layer

   ### 4.5 Custom NATS Sink Block
   - gr-nats OOT module design (Python)
   - nats_pub_sink: stream data → NATS publish
   - nats_pub_msg_sink: PMT messages → NATS publish
   - JSON serialization with SigMF metadata headers
   - Implementation sketch (~100 lines Python)
   - Alternative: ZMQ-to-NATS bridge process (simpler, less efficient)

## 5. DSP Fundamentals (What GNU Radio Does)
   ### 5.1 FFT (Fast Fourier Transform)
   - Time domain → frequency domain conversion
   - FFT size tradeoffs: resolution vs update rate
   - Windowing functions: Hamming, Hann, Blackman-Harris, Kaiser
   - Overlap-add for continuous spectrum display

   ### 5.2 Demodulation
   - AM (envelope detection)
   - FM (frequency discriminator, WBFM/NBFM)
   - SSB (USB/LSB via Weaver or phasing method)
   - Digital: FSK, PSK, QAM

   ### 5.3 Filtering
   - Low-pass, band-pass, high-pass (FIR/IIR)
   - Decimation and interpolation
   - Polyphase filter banks
   - GNU Radio filter design tool

## 6. SigMF (Signal Metadata Format)
   ### 6.1 Specification (v1.2.5)
   - Three objects: global, captures, annotations
   - global: core:datatype, core:sample_rate, core:hw, core:version
   - captures[]: core:sample_start, core:frequency, core:datetime
   - annotations[]: core:sample_start, core:sample_count, core:label, core:description

   ### 6.2 SigMF Extensions
   - signal extension: modulation type, symbol rate, filter info
   - antenna extension: model, gain, azimuth, elevation
   - Custom tsingou extension namespace

   ### 6.3 SigMF ↔ BaseSignal Codec
   - Mapping: SigMF global → BaseSignal metadata
   - Mapping: SigMF captures → SdrSignal.frequency, .sampleRate
   - Mapping: SigMF annotations → signal annotations in d2ts
   - Effect Schema: SigMFGlobal, SigMFCapture, SigMFAnnotation
   - Codec: SigMF JSON → SdrSignal, SdrSignal → SigMF JSON

## 7. Protocol Decoders
   ### 7.1 Aviation
   - ADS-B (dump1090): 1090 MHz, Mode S, position/altitude/velocity
   - ACARS (acarsdec): 129.125/131.550 MHz, aircraft text messages
   - HFDL: HF data link for oceanic flights

   ### 7.2 Maritime
   - AIS (gnuais/gr-ais): 161.975/162.025 MHz, vessel position/ID
   - NAVTEX: Maritime safety information

   ### 7.3 Paging & Trunked Radio
   - POCSAG (multimon-ng): 512/1200/2400 baud pager messages
   - FLEX (multimon-ng): Higher-speed paging
   - P25 (OP25/DSD): APCO digital trunked radio
   - DMR (DSD/DSD+): Digital mobile radio

   ### 7.4 Utility & IoT
   - APRS: Amateur position reporting, 144.390 MHz
   - ISM Band (433/868/915 MHz): Weather stations, sensors, remotes
   - Iridium: Satellite burst data

   ### 7.5 Decoder → NATS Integration
   - Each decoder outputs JSON to stdout or TCP
   - Bridge pattern: decoder stdout → JSON parse → NATS publish
   - NATS subject: tsingou.signal.sdr.decoded.{protocol}
   - Payload schema per protocol

## 8. RTL-SDR Sidecar Architecture
   ### 8.1 Design
   - Rust binary using librtlsdr FFI (or Python with pyrtlsdr)
   - Reads raw IQ, computes FFT, publishes to NATS
   - Configurable: center_freq, sample_rate, fft_size, gain
   - Lightweight alternative to full GNU Radio for simple use cases

   ### 8.2 IQ Streaming Strategy
   - Raw IQ over NATS: chunk size = FFT size × sample size
   - NATS max message size consideration (default 1MB)
   - Chunked IQ: header + payload framing
   - FFT-only mode: only publish magnitude data (much smaller)

   ### 8.3 Frequency Management
   - Tuning requests via NATS command subject
   - Scan lists: sequential frequency hopping
   - Dwell time configuration
   - Multi-device coordination: device array with assigned bands

## 9. Tsingou Integration Layer
   ### 9.1 HolonetBridgeAdapter Configuration
   - kind: "sdr"
   - subjects: ["tsingou.signal.sdr.>"]
   - Config factory: makeSdrBridgeConfig()
   - Payload schema validation

   ### 9.2 SdrSignal Schema
   - Extends BaseSignal with SDR-specific fields
   - Fields: frequency, bandwidth, sampleRate, modulationType, deviceId, gain
   - Sub-schemas: SdrFftPayload, SdrDecodedPayload, SdrIqPayload, SdrWaterfallPayload

   ### 9.3 NATS Subject Taxonomy
   - tsingou.signal.sdr.fft.{device_id} — FFT magnitude arrays
   - tsingou.signal.sdr.decoded.{protocol} — Decoded protocol data
   - tsingou.signal.sdr.iq.{device_id} — Raw IQ chunks
   - tsingou.signal.sdr.waterfall.{device_id} — Pre-rendered waterfall rows
   - tsingou.signal.sdr.command.{device_id} — Tuning/config commands (reverse)

   ### 9.4 d2ts Ingest Processing
   - SDR signal normalization in ingest graph
   - Temporal windowing for FFT accumulation
   - Cross-source correlation (e.g., ADS-B position + AIS vessel)

## 10. Visualization Pipeline
   ### 10.1 Waterfall Display (p5 Layer, z:2)
   - Rendering algorithm: off-screen canvas, pixel buffer write
   - Color mapping: magnitude → colormap (viridis, magma, plasma, inferno)
   - Scrolling: new FFT row at top, shift existing rows down
   - Zoom: frequency axis zoom, time axis zoom
   - Performance: requestAnimationFrame, typed arrays, ImageData

   ### 10.2 Spectrum Plot (visx Layer, z:1)
   - Real-time FFT magnitude line chart
   - Peak hold (max envelope over time)
   - Average trace (rolling mean)
   - Axis labels: frequency (MHz), power (dBFS)
   - Interactive: cursor readout, bandwidth measurement markers

   ### 10.3 Decoded Data Display (DOM Layer, z:3)
   - Protocol-specific components
   - ADS-B: aircraft table (callsign, altitude, speed, heading, lat/lon)
   - AIS: vessel table (MMSI, name, position, course, speed)
   - POCSAG: message feed (address, function, alphanumeric content)
   - Generic decoder: JSON tree view

   ### 10.4 Constellation Diagram (p5 Layer, z:2)
   - I/Q scatter plot for modulation analysis
   - Reference constellations: BPSK, QPSK, 8PSK, 16QAM, 64QAM
   - Eye diagram variant for digital signal quality

   ### 10.5 Signal Topology (R3F Layer, z:0)
   - 3D frequency × time × power surface
   - Device array spatial layout
   - Signal-of-interest highlighting

## 11. Performance Analysis Framework
   ### 11.1 Data Rate Budget
   - Per-device bandwidth: sample_rate × bytes_per_sample
   - NATS throughput limits (per subject, aggregate)
   - Browser rendering budget: 16ms frame time at 60fps
   - Memory: FFT history depth × FFT size × 4 bytes

   ### 11.2 Optimization Strategies
   - Sidecar-side decimation (reduce before publish)
   - FFT averaging (reduce update rate)
   - NATS subject filtering (subscribe only to needed streams)
   - WebWorker offloading for heavy rendering
   - SharedArrayBuffer for zero-copy IQ transfer

   ### 11.3 Scaling Considerations
   - Single SDR device: ~5 MB/s NATS throughput
   - Multi-device array (4x RTL-SDR): ~20 MB/s
   - Professional setup (USRP B210): ~450 MB/s (requires dedicated NATS server)
   - Graceful degradation: auto-reduce FFT rate under load

## 12. Example Flow Graphs
   ### 12.1 FM Broadcast Receiver
   - RTL-SDR Source → Low-pass Filter → WBFM Demod → Audio Sink + NATS Sink

   ### 12.2 ADS-B Receiver
   - RTL-SDR Source (1090 MHz) → dump1090 → JSON → NATS bridge

   ### 12.3 Multi-Protocol Scanner
   - RTL-SDR Source → Frequency Xlating Filter × N → Protocol Decoders → NATS

   ### 12.4 Wideband Spectrum Monitor
   - HackRF Source (20 MSPS) → FFT → NATS Sink → Tsingou Waterfall

## 13. Reference Implementations
   ### 13.1 Comparison: OpenWebRX, SigDigger, SDR++
   - What Tsingou learns from each
   - Where Tsingou differs (SIGINT analysis vs general radio)

   ### 13.2 MISP + SigMF Integration
   - Threat intel sharing with SigMF recordings
   - STIX observed-data wrapping for RF artifacts
```

---

## Deliverable 2: Expanded `docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md`

### Expansion Plan

The existing ADR-011 is a solid 125-line skeleton. It will be expanded to ~500+ lines with:

1. **Detailed GNU Radio Flow Graph Examples** (new section)
   - GRC block diagram → Python code → NATS output
   - FM receiver flow graph (complete)
   - ADS-B receiver flow graph (complete)
   - Wideband spectrum monitor flow graph

2. **RTL-SDR Sidecar Architecture** (expand existing mention)
   - Rust binary design: main loop, FFT computation, NATS publish
   - Configuration schema (Effect Schema)
   - Command channel for remote tuning
   - Health monitoring heartbeat

3. **SigMF ↔ BaseSignal Codec** (new section)
   - Complete field mapping table
   - Effect Schema definitions for SigMF objects
   - Encode/decode functions
   - Round-trip fidelity guarantee

4. **IQ Sample Streaming Strategy** (new section)
   - NATS message framing for IQ chunks
   - Header format: {device_id, center_freq, sample_rate, format, chunk_seq, timestamp}
   - Back-pressure handling via NATS flow control
   - JetStream for IQ recording/replay

5. **Frequency Management** (new section)
   - Tuning request/response protocol over NATS
   - Scan list execution engine
   - Dwell time and sweep rate configuration
   - Multi-device band assignment

6. **Multi-Device Coordination** (new section)
   - SDR array concept: N devices, each assigned frequency band
   - Synchronized sampling (GPS discipline for USRP)
   - Aggregate bandwidth computation
   - Device discovery and health monitoring

7. **Updated Consequences** (expand existing)
   - More detailed positive/negative analysis
   - Migration path from existing serial adapter
   - Quantified performance characteristics

---

## Hardware Coverage

| Device | Driver API | Covered in Detail |
|--------|-----------|-------------------|
| RTL-SDR v4 | librtlsdr | Full (primary consumer device) |
| HackRF One | libhackrf | Full (wideband analysis reference) |
| USRP B200/B210 | UHD | Medium (professional tier reference) |
| LimeSDR | SoapySDR | Light (SoapySDR abstraction) |
| ADALM-Pluto | SoapySDR/libiio | Light (education reference) |

## GNU Radio Flow Graph Examples

1. **FM Broadcast** — Complete GRC + Python, showing RTL-SDR → WBFM → Audio + NATS
2. **ADS-B** — dump1090 integration, JSON bridge to NATS
3. **Wideband Monitor** — HackRF → FFT → NATS waterfall data
4. **Multi-Protocol Scanner** — Frequency xlating filters to parallel decoders

## SigMF ↔ BaseSignal Codec

- Effect Schema: `SigMFGlobal`, `SigMFCapture`, `SigMFAnnotation`, `SigMFRecording`
- Mapping: SigMF `core:datatype` → SdrSignal `sampleFormat`
- Mapping: SigMF `core:sample_rate` → SdrSignal `sampleRate`
- Mapping: SigMF `core:frequency` → SdrSignal `centerFrequency`
- Mapping: SigMF `core:hw` → SdrSignal `deviceId`
- Round-trip codec with Schema.transform

## Visualization Rendering Strategy

| Data Type | Rendering Layer | Technology | Update Rate |
|-----------|----------------|------------|-------------|
| Waterfall (FFT history) | p5 (z:2) | Canvas 2D pixel buffer | 10-30 fps |
| Spectrum (FFT current) | visx (z:1) | SVG line chart | 10-30 fps |
| Constellation (IQ scatter) | p5 (z:2) | Canvas 2D scatter | 10-30 fps |
| Decoded data (tables) | DOM (z:3) | React + framer-motion | Event-driven |
| Signal topology (3D) | R3F (z:0) | WebGL mesh/points | 1-5 fps |

## Performance Analysis Framework

### Key Metrics

| Scenario | Data Rate | NATS Messages/s | Browser Cost |
|----------|-----------|-----------------|--------------|
| RTL-SDR FFT only (1024-pt, 10/s) | 40 KB/s | 10 | Minimal |
| RTL-SDR raw IQ (2.4 MSPS CU8) | 4.8 MB/s | ~4,700 (1KB chunks) | Heavy |
| HackRF FFT (4096-pt, 30/s) | 480 KB/s | 30 | Moderate |
| HackRF raw IQ (20 MSPS CS8) | 40 MB/s | ~40,000 (1KB chunks) | Extreme |
| USRP raw IQ (56 MSPS CF32) | 448 MB/s | Not feasible over NATS | N/A |

### Recommendation
- Default mode: FFT-only for visualization (low bandwidth)
- Raw IQ: only when recording or doing client-side DSP
- USRP: requires dedicated high-throughput path (not standard NATS)

---

## Research Sources Used

- GNU Radio 4.0 architecture: https://www.gnuradio.org/news/2025-12-17-gr4-transform-sdr-workflows/
- GNU Radio ZMQ blocks: https://wiki.gnuradio.org/index.php/Understanding_ZMQ_Blocks
- GNU Radio OOT modules: https://wiki.gnuradio.org/index.php/OutOfTreeModules
- SigMF specification: https://github.com/sigmf/SigMF
- RTL-SDR v4 guide: https://www.rtl-sdr.com/v4/
- HackRF documentation: https://hackrf.readthedocs.io/en/latest/hackrf_one.html
- libhackrf API: https://github.com/dodgymike/hackrf-wiki/blob/master/libHackRF-API.md
- USRP B200/B210 specs: https://files.ettus.com/manual/page_usrp_b200.html
- IQ format reference: https://triq.org/rtl_433/IQ_FORMATS.html
- PySDR IQ files: https://pysdr.org/content/iq_files.html
- OpenWebRX waterfall: https://deepwiki.com/jketterl/openwebrx/2.2-waterfall-display
- dump1090 ADS-B: https://github.com/antirez/dump1090
- OP25 P25 decoder: https://robg.dev/blog/posts/op25-sdr-radio/
- SoapySDR: https://wiki.gnuradio.org/index.php/Soapy
