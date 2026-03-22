# ADR-011: SDR Integration via GNU Radio Bridge + RTL-SDR Sidecar

**Status**: Accepted  
**Date**: 2026-02-18  
**Decision Makers**: Prime (user), Val (architect)  
**Evidence**: Questionnaire `tsingou-sigint-scope` — Q6: "GNU Radio bridge — Also need sidecar for interfacing with rtl-sdr, etc!"

---

## Context

Software Defined Radio (SDR) is a foundational SIGINT tool. The open-source SDR ecosystem provides hardware and software for RF signal collection:

| Device | Price | Frequency Range | TX/RX | Use Case |
|--------|-------|----------------|-------|----------|
| RTL-SDR v4 | ~$30 | 24-1766 MHz | RX only | ADS-B, FM, weather, pager, trunked radio |
| HackRF One | ~$350 | 1 MHz-6 GHz | TX/RX | Wideband analysis, replay, spectrum survey |
| LimeSDR | ~$300 | 100 kHz-3.8 GHz | TX/RX | Full-duplex, MIMO, cellular |
| ADALM-Pluto | ~$150 | 325 MHz-3.8 GHz | TX/RX | Education, narrowband analysis |
| USRP (Ettus) | $1k-$10k+ | DC-6 GHz+ | TX/RX | Professional SIGINT, wide bandwidth |

GNU Radio is the dominant open-source signal processing framework — a flow-graph based DSP toolkit that connects to all these devices.

## Decision

**Dual-path SDR integration:**

1. **GNU Radio bridge** — GNU Radio flow graph handles DSP (demodulation, decoding, FFT). Decoded output published to NATS. Tsingou subscribes via `HolonetBridgeAdapter`.
2. **RTL-SDR/HackRF sidecar** — Lightweight sidecar reads raw IQ samples from SDR hardware via `librtlsdr`/`libhackrf`. Publishes raw or FFT-processed data to NATS.

### Architecture

```
                          NATS
                           │
┌─────────────────────┐    │    ┌──────────────────────┐
│ GNU Radio Companion │    │    │ Tsingou (Tauri)      │
│                     │    │    │                      │
│ ┌─────────────────┐ │    │    │ ┌──────────────────┐ │
│ │ SDR Source Block│ │    │    │ │ HolonetBridge    │ │
│ │ (RTL-SDR/       │ │    │    │ │ Adapter          │ │
│ │  HackRF/USRP)  │ │    │    │ │ (kind: "sdr")    │ │
│ └────────┬────────┘ │    │    │ └────────┬─────────┘ │
│          │          │    │    │          │           │
│ ┌────────▼────────┐ │    │    │ ┌────────▼─────────┐ │
│ │ DSP Blocks      │ │    │    │ │ d2ts Ingest      │ │
│ │ (FFT, demod,    │ │    │    │ │ → STIX observed  │ │
│ │  decode, filter)│ │    │    │ │   -data (SCO:    │ │
│ └────────┬────────┘ │    │    │ │    artifact +    │ │
│          │          │    │    │ │    custom ext)   │ │
│ ┌────────▼────────┐ │    │    │ └────────┬─────────┘ │
│ │ NATS Sink Block │─┼────┼───►│          │           │
│ │ (JSON/SigMF)    │ │    │    │ ┌────────▼─────────┐ │
│ └─────────────────┘ │    │    │ │ p5 Layer:        │ │
│                     │    │    │ │ Spectrum waterfall│ │
│                     │    │    │ │ FFT display       │ │
└─────────────────────┘    │    │ └──────────────────┘ │
                           │    └──────────────────────┘
┌─────────────────────┐    │
│ SDR Sidecar         │    │
│ (raw IQ → NATS)     │────┘
│ librtlsdr/libhackrf │
└─────────────────────┘
```

### NATS Subjects

```
tsingou.signal.sdr.>                    # All SDR signals
tsingou.signal.sdr.fft.{device_id}      # FFT magnitude data
tsingou.signal.sdr.decoded.{protocol}    # Decoded protocol data (ADS-B, POCSAG, etc.)
tsingou.signal.sdr.iq.{device_id}       # Raw IQ samples (high bandwidth!)
tsingou.signal.sdr.waterfall.{device_id} # Pre-computed waterfall data
```

### SigMF (Signal Metadata Format)

SDR recordings use SigMF for metadata standardization:

```json
{
  "global": {
    "core:datatype": "cf32_le",
    "core:sample_rate": 2400000,
    "core:hw": "RTL-SDR v4",
    "core:version": "1.0.0"
  },
  "captures": [
    { "core:sample_start": 0, "core:frequency": 433920000 }
  ],
  "annotations": [
    { "core:sample_start": 0, "core:sample_count": 2400000, "core:label": "ISM Band 433MHz" }
  ]
}
```

### Rendering: p5 Layer for Spectrum

The p5 rendering layer (z:2) handles real-time spectrum visualization:

- **Waterfall display** — frequency × time × intensity heatmap
- **FFT magnitude plot** — real-time frequency spectrum
- **Signal constellation diagram** — IQ scatter plot for modulation analysis
- **Spectrogram** — scrolling time-frequency display

## Consequences

### Positive
- **Full RF SIGINT capability** — from SDR hardware to visual analysis
- **Leverages existing ecosystem** — GNU Radio has 1000+ signal processing blocks
- **SigMF standard** — recordings are interoperable with other SDR tools
- **Sidecar pattern reuse** — same HolonetBridgeAdapter pattern as FileWatch/Serial

### Negative
- **High bandwidth** — raw IQ at 2.4 MSPS = ~19 MB/s. NATS needs careful subject/buffer tuning.
- **GNU Radio dependency** — requires separate installation (not bundled with Tsingou)
- **Custom GNU Radio blocks needed** — NATS sink block doesn't exist in upstream GNU Radio

### Implementation

1. Write NATS sink block for GNU Radio (Python, ~100 lines)
2. Create SDR signal schema extension (`SdrSignal` with frequency, bandwidth, modulation fields)
3. Write p5 waterfall/FFT components for rendering layer
4. Bundle example GNU Radio flow graphs for common protocols (ADS-B, FM, POCSAG)
