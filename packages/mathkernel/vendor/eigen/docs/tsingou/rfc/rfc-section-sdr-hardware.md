# TSG-RFC-002 Section: SDR Hardware Landscape

```
Section:       SDR Hardware Landscape
Section ID:    TSG.16
Parent RFC:    TSG-RFC-002 (Tsingou SIGINT Visualization Platform)
Part:          IV — SDR & RF Integration (Normative)
Status:        DRAFT
Author:        Val (sdr-analyst)
Created:       2026-02-18
Research Base: research-sdr-hardware-ecosystem.md (1,019 lines)
Codebase Refs: src/lib/tsingou-flow/schemas/base-signal.ts (159 lines),
               src/lib/tsingou-flow/adapters/HolonetBridgeAdapter.ts (277 lines),
               docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md (125 lines)
```

> This section specifies the Software Defined Radio (SDR) hardware integration
> model for the Tsingou SIGINT visualization platform. It establishes device
> requirements, API contracts, IQ sample format handling, sidecar process
> architecture, and multi-device coordination. The key words "MUST", "MUST NOT",
> "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted
> as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.16.1 Scope and Design Philosophy](#tsg161-scope-and-design-philosophy)
2. [TSG.16.2 RTL-SDR v4](#tsg162-rtl-sdr-v4)
3. [TSG.16.3 HackRF One](#tsg163-hackrf-one)
4. [TSG.16.4 USRP B200/B210](#tsg164-usrp-b200b210)
5. [TSG.16.5 Additional Devices](#tsg165-additional-devices)
6. [TSG.16.6 SoapySDR Abstraction Layer](#tsg166-soapysdr-abstraction-layer)
7. [TSG.16.7 IQ Sample Formats](#tsg167-iq-sample-formats)
8. [TSG.16.8 Device Selection Matrix](#tsg168-device-selection-matrix)
9. [TSG.16.9 Sidecar Architecture](#tsg169-sidecar-architecture)
10. [TSG.16.10 Normative Requirements Summary](#tsg1610-normative-requirements-summary)
11. [TSG.16.11 References](#tsg1611-references)

---

## TSG.16.1 Scope and Design Philosophy

### TSG.16.1.1 Separation of Concerns

Tsingou is a signal intelligence *analysis and visualization* platform. It is NOT a digital signal processing framework. This distinction is fundamental and governs the entire SDR integration architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│ OUT OF SCOPE FOR TSINGOU                                           │
│                                                                     │
│  RF Reception → Analog Frontend → ADC → DSP → Demodulation         │
│                                                                     │
│  Handled by: GNU Radio, sidecar processes, external decoders        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                                   │ NATS messages (JSON/binary)
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│ IN SCOPE FOR TSINGOU                                               │
│                                                                     │
│  Signal Ingestion → Schema Validation → d2ts Pipeline →             │
│  Atom State → 4-Layer Rendering → SIGINT Analysis                   │
│                                                                     │
│  Handled by: Effect-TS services, HolonetBridgeAdapter, BaseSignal   │
└─────────────────────────────────────────────────────────────────────┘
```

Implementations MUST NOT embed DSP processing within the Tsingou application. All DSP — including FFT computation, demodulation, protocol decoding, and filtering — MUST execute in external processes (GNU Radio flow graphs, sidecar binaries, or standalone decoders). Tsingou receives only the *products* of DSP via the NATS messaging fabric.

### TSG.16.1.2 Dual-Path Architecture

Tsingou supports two integration paths for SDR hardware [ADR-011]:

1. **GNU Radio Bridge Path**: GNU Radio flow graph performs all DSP. Processed output (FFT magnitudes, decoded protocol data, demodulated audio metadata) is published to NATS via a custom sink block (gr-nats) or a ZMQ-to-NATS bridge process. See TSG.17.

2. **Direct Sidecar Path**: A lightweight sidecar process interfaces directly with SDR hardware via vendor libraries (librtlsdr, libhackrf, UHD). The sidecar performs minimal processing (typically FFT only) and publishes results to NATS. This path is optimized for simplicity and low latency when full GNU Radio DSP is not required.

```
Path 1: GNU Radio Bridge                Path 2: Direct Sidecar

  SDR HW                                  SDR HW
    │                                       │
    ▼                                       ▼
  GNU Radio                               Sidecar Process
  (full DSP)                              (librtlsdr FFI)
    │                                       │
    ▼                                       ▼
  gr-nats / ZMQ bridge                    NATS publish
    │                                       │
    └──────────── NATS ─────────────────────┘
                   │
                   ▼
            HolonetBridgeAdapter
            (kind: "sdr")
                   │
                   ▼
              d2ts Pipeline
                   │
                   ▼
             4-Layer Rendering
```

Implementations MUST support at least one integration path. Implementations SHOULD support both paths for maximum flexibility.

### TSG.16.1.3 HolonetBridgeAdapter Integration

SDR data enters Tsingou through the same `HolonetBridgeAdapter` service used for all sidecar-bridged sources (file-watch, serial, OSC). The adapter subscribes to NATS subjects, validates incoming messages against the SDR signal schema, and pushes validated signals to the d2ts ingest pipeline.

See `src/lib/tsingou-flow/adapters/HolonetBridgeAdapter.ts` for the service implementation. The SDR-specific configuration factory (`makeSdrBridgeConfig`) is specified in TSG.19.7.

---

## TSG.16.2 RTL-SDR v4

### TSG.16.2.1 Overview

The RTL-SDR v4 is a USB DVB-T dongle repurposed for general-purpose SDR reception. It is the minimum-viable SDR hardware for Tsingou and MUST be supported by all conforming implementations.

| Parameter | Value |
|-----------|-------|
| Tuner | Rafael Micro R828D |
| ADC | Realtek RTL2832U (8-bit) |
| Frequency range | 24 MHz — 1766 MHz (HF via built-in upconverter) |
| Maximum sample rate | 3.2 MSPS (2.4 MSPS recommended) |
| IQ format | CU8 (complex unsigned 8-bit) |
| Interface | USB 2.0 High Speed |
| Duplex | RX only |
| Bias-tee | 4.5V via software (V4 only) |
| Clock | TCXO, <0.5 PPM stability |
| Price | ~$30 USD |

### TSG.16.2.2 Hardware Architecture

```
Antenna ──► R828D Tuner ──► RTL2832U ADC ──► USB 2.0 ──► Host
               │                 │
          ┌────┴────┐       ┌────┴────┐
          │ LNA     │       │ 8-bit   │
          │ Mixer   │       │ ADC     │
          │ IF Filt │       │ USB PHY │
          │ PLL/VCO │       │ I2C Ctl │
          └─────────┘       └─────────┘
```

The R828D tuner downconverts the RF signal to an intermediate frequency, which the RTL2832U digitizes at 8-bit resolution. The RTL2832U was originally designed as a DVB-T demodulator, but its raw IQ output mode (discovered by Antti Palosaari in 2012) enabled its use as a general-purpose SDR receiver.

### TSG.16.2.3 V4 Improvements

The V4 revision introduces critical improvements over previous versions:

| Feature | V3 (R820T2) | V4 (R828D) |
|---------|------------|-----------|
| HF reception | Requires external upconverter | Built-in (direct sampling mode) |
| Bias-tee | External modification | Software-controlled, 4.5V, ~180 mA |
| Frequency stability | 1-60 PPM (XO) | <0.5 PPM (TCXO) |
| Case | Plastic | Metal (thermal dissipation, shielding) |
| ESD protection | Minimal | ESD protection diodes on antenna input |
| DC offset | ~127.5 | ~127.4 (empirically measured) |

### TSG.16.2.4 librtlsdr API Reference

Implementations interfacing directly with RTL-SDR hardware MUST use the librtlsdr API [RTLSDR]. The following functions constitute the required API surface:

**Device Discovery:**

| Function | Returns | Description |
|----------|---------|-------------|
| `rtlsdr_get_device_count()` | `uint32_t` | Number of attached RTL-SDR devices |
| `rtlsdr_get_device_name(index)` | `const char*` | Device name string |
| `rtlsdr_get_device_usb_strings(index, mfg, prod, serial)` | `int` | USB descriptor strings |
| `rtlsdr_get_index_by_serial(serial)` | `int` | Device index for serial number |

Implementations SHOULD use serial numbers for persistent device identification across system reboots.

**Device Lifecycle:**

| Function | Description |
|----------|-------------|
| `rtlsdr_open(dev, index)` | Opens device. Only one process MAY open a device simultaneously. |
| `rtlsdr_close(dev)` | Releases device. Implementations MUST close devices on shutdown. |

**Frequency Control:**

| Function | Parameter | Range | Notes |
|----------|-----------|-------|-------|
| `rtlsdr_set_center_freq(dev, freq)` | Hz (uint32_t) | 24M-1766M | PLL lock time ~5-10 ms |
| `rtlsdr_set_freq_correction(dev, ppm)` | PPM (int) | Typically -60 to +60 | V4 TCXO: set to 0 |
| `rtlsdr_set_direct_sampling(dev, mode)` | 0/1/2 | 0=off, 1=I-ADC, 2=Q-ADC | V4 HF reception |

**Sample Rate:**

| Function | Parameter | Recommended Range |
|----------|-----------|-------------------|
| `rtlsdr_set_sample_rate(dev, rate)` | Hz (uint32_t) | 225001-2400000 |

Implementations MUST default to 2,400,000 Hz (2.4 MSPS). Implementations MUST NOT configure rates above 2,560,000 Hz without user acknowledgment of potential sample drops.

**Gain Control:**

| Function | Description |
|----------|-------------|
| `rtlsdr_set_tuner_gain_mode(dev, manual)` | 0=auto, 1=manual |
| `rtlsdr_get_tuner_gains(dev, gains)` | Available gain values (tenths of dB) |
| `rtlsdr_set_tuner_gain(dev, gain)` | Set gain (must match available value) |
| `rtlsdr_set_agc_mode(dev, on)` | RTL2832U internal AGC |

The R828D tuner provides 29 discrete gain steps from 0.0 dB to 49.6 dB. Implementations SHOULD default to automatic gain unless the user explicitly selects manual gain.

**Sample Reading:**

| Function | Mode | Description |
|----------|------|-------------|
| `rtlsdr_read_sync(dev, buf, len, n_read)` | Synchronous | Blocks until `len` bytes available |
| `rtlsdr_read_async(dev, cb, ctx, buf_num, buf_len)` | Asynchronous | Callback-based, ring buffer |
| `rtlsdr_cancel_async(dev)` | — | Cancels pending async read |
| `rtlsdr_reset_buffer(dev)` | — | MUST be called before first read |

Implementations SHOULD use `rtlsdr_read_async` with the default ring buffer configuration (15 buffers, 524,288 bytes each) for production use. Synchronous reads are acceptable for testing.

### TSG.16.2.5 Sample Rate Stability

| Rate (MSPS) | Stability | Recommended Use |
|-------------|-----------|----------------|
| 0.225-1.0 | Excellent | Narrowband single-channel monitoring |
| 1.0-2.0 | Good | Standard operation |
| 2.4 | Good | Default — most tested configuration |
| 2.56 | Fair | Maximum stable for most USB host controllers |
| 2.8-3.0 | Poor | USB frame timing issues on many systems |
| 3.2 | Unstable | Theoretical maximum — NOT RECOMMENDED |

USB host controller quality significantly affects stability. Intel controllers consistently outperform Renesas and VIA controllers at higher sample rates. Direct USB connection (no hub) is RECOMMENDED for rates above 2.0 MSPS.

### TSG.16.2.6 Known Artifacts

1. **DC Spike**: RTL2832U ADC produces a spectral spike at the center frequency due to DC offset in the IQ path. Mitigation: offset-tune by bandwidth/4, digitally shift, and ignore the center bin. The sidecar SHOULD implement this mitigation.

2. **Thermal Drift**: Crystal frequency drifts with temperature changes. V4 TCXO limits drift to <0.5 PPM. For V3 devices, the sidecar SHOULD periodically recalibrate using `rtlsdr_set_freq_correction`.

3. **Intermodulation**: Strong nearby transmitters can generate spurious signals through intermodulation in the R828D mixer. Mitigation: bandpass filtering before antenna input, gain reduction.

4. **Quantization Noise**: 8-bit ADC limits dynamic range to ~48 dB (ENOB ~6.5 bits). This is adequate for signal detection but insufficient for precise amplitude measurements. See TSG.16.7.5 for dynamic range analysis.

### TSG.16.2.7 Optimal Settings Per Protocol

| Protocol | Freq (MHz) | Rate (MSPS) | Gain | Notes |
|----------|-----------|-------------|------|-------|
| ADS-B | 1090 | 2.0-2.4 | Maximum | dump1090 requires >= 2 MSPS |
| FM Broadcast | 88-108 | 2.4 | Auto | Decimate to 250 kHz for mono |
| POCSAG | varies | 2.4 | 30-40 dB | 25 kHz channel bandwidth |
| AIS | 162.0 | 2.4 | Auto | Captures both Ch A and Ch B |
| ISM (433 MHz) | 433.92 | 1.0 | Auto | rtl_433 recommended |
| NOAA APT | 137.x | 2.4 | Auto | ~40 kHz bandwidth signal |
| P25 / DMR | varies | 2.4 | 30-40 dB | 12.5 kHz channel |
| ACARS (VHF) | 131.55 | 2.4 | Auto | Multiple frequencies |

---

## TSG.16.3 HackRF One

### TSG.16.3.1 Overview

The HackRF One is a wideband SDR transceiver designed by Great Scott Gadgets [HACKRF]. It provides significantly wider bandwidth and frequency coverage than RTL-SDR, at the cost of the same 8-bit resolution.

| Parameter | Value |
|-----------|-------|
| Frequency range | 1 MHz — 6 GHz |
| Sample rates | 2-20 MSPS (8, 10, 12.5, 16, 20 MHz recommended) |
| ADC/DAC resolution | 8-bit signed (CS8) |
| Duplex | Half-duplex (TX or RX, not simultaneous) |
| Instantaneous bandwidth | Up to 20 MHz |
| Interface | USB 2.0 High Speed |
| RF amplifier | 14 dB (switchable) |
| LNA gain | 0-40 dB (8 dB steps) |
| VGA gain | 0-62 dB (2 dB steps) |
| TX VGA gain | 0-47 dB (1 dB steps) |
| Clock | 10 MHz TCXO, external clock I/O |
| Open hardware | Yes (full schematics and PCB files) |

Implementations SHOULD support HackRF One for wideband spectrum monitoring and sweep analysis.

### TSG.16.3.2 Hardware Architecture

Five-chip design:

| Chip | Function | Key Specifications |
|------|----------|-------------------|
| RFFC5072 | Wideband synthesizer/VCO | 85 MHz — 4200 MHz LO generation |
| MAX2839 | Wideband transceiver | 2.3-2.7 GHz IF, baseband filtering |
| MAX5864 | ADC/DAC | 22 MSPS, 8-bit, simultaneous ADC+DAC |
| LPC4320 | MCU | ARM Cortex-M4 + Cortex-M0, USB 2.0 HS |
| XC2C64A | CPLD | Clock domain crossing, RX/TX mux, routing |

### TSG.16.3.3 libhackrf API Reference

Implementations interfacing with HackRF hardware MUST use the libhackrf API [HACKRF].

**Core Lifecycle:**

| Function | Description |
|----------|-------------|
| `hackrf_init()` | Initialize library. MUST be called first. |
| `hackrf_exit()` | Deinitialize library. MUST be called after closing all devices. |
| `hackrf_open()` | Open first available device. |
| `hackrf_open_by_serial(serial)` | Open specific device by serial number. |
| `hackrf_close(device)` | Close device. |

**Configuration:**

| Function | Range | Step |
|----------|-------|------|
| `hackrf_set_freq(device, freq_hz)` | 1 MHz — 6 GHz | 1 Hz |
| `hackrf_set_sample_rate(device, rate_hz)` | 2-20 MSPS | Continuous |
| `hackrf_set_baseband_filter_bandwidth(device, bw_hz)` | 1.75-28 MHz | Discrete steps |
| `hackrf_set_lna_gain(device, value)` | 0-40 dB | 8 dB |
| `hackrf_set_vga_gain(device, value)` | 0-62 dB | 2 dB |
| `hackrf_set_amp_enable(device, value)` | 0 or 1 | — |

**Streaming:**

| Function | Description |
|----------|-------------|
| `hackrf_start_rx(device, callback, ctx)` | Start receiving. Callback receives CS8 sample buffers. |
| `hackrf_stop_rx(device)` | Stop receiving. |
| `hackrf_start_tx(device, callback, ctx)` | Start transmitting. Callback fills CS8 buffers. |
| `hackrf_stop_tx(device)` | Stop transmitting. |

### TSG.16.3.4 Sweep Mode

HackRF One supports a unique hardware-accelerated sweep mode via `hackrf_init_sweep` and `hackrf_start_rx_sweep`. This enables wideband spectrum monitoring at approximately 8 GHz/second sweep rate (full 1 MHz — 6 GHz coverage in ~625 ms).

Sweep mode is particularly valuable for spectrum surveillance applications where detecting signal activity across a wide frequency range is more important than continuous monitoring of a single frequency.

Implementations MAY support HackRF sweep mode for wideband spectrum monitoring. When sweep mode is used, the sidecar MUST publish FFT data with per-segment center frequency metadata so that the visualization layer can assemble a composite wideband display.

### TSG.16.3.5 Preferred Sample Rates

| Rate (MSPS) | BB Filter | Data Rate (CS8) | USB Utilization | Recommended |
|-------------|-----------|-----------------|----------------|-------------|
| 2 | 1.75 MHz | 4 MB/s | 11% | Narrowband |
| 8 | 5.0 MHz | 16 MB/s | 44% | Standard |
| 10 | 7.0 MHz | 20 MB/s | 56% | Common |
| 12.5 | 9.0 MHz | 25 MB/s | 69% | High bandwidth |
| 16 | 12.0 MHz | 32 MB/s | 89% | Very high bandwidth |
| 20 | 14.0 MHz | 40 MB/s | ~100% | Maximum — USB limit |

The `hackrf_set_sample_rate` function automatically configures the baseband filter to approximately 0.75 * sample_rate. Implementations MAY override this with `hackrf_set_baseband_filter_bandwidth` for custom anti-aliasing.

---

## TSG.16.4 USRP B200/B210

### TSG.16.4.1 Overview

The Ettus Research USRP (Universal Software Radio Peripheral) B-series represents professional-grade SDR hardware with 12-bit resolution, USB 3.0 interface, and FPGA-accelerated processing [UHD].

| Parameter | B200 | B210 |
|-----------|------|------|
| Transceiver | AD9364 | AD9361 |
| Channels | 1x1 | 2x2 MIMO |
| Frequency range | 70 MHz — 6 GHz | 70 MHz — 6 GHz |
| Max sample rate | 61.44 MSPS (1 ch) | 61.44 MSPS (1 ch), 30.72 MSPS (2 ch) |
| ADC/DAC | 12-bit | 12-bit |
| Bandwidth | 56 MHz | 56 MHz (1 ch), 28 MHz (2 ch) |
| Interface | USB 3.0 SuperSpeed | USB 3.0 SuperSpeed |
| FPGA | Xilinx Spartan-6 XC6SLX75 | Xilinx Spartan-6 XC6SLX150 |
| Clock | Internal TCXO, external 10 MHz input | Internal TCXO, external 10 MHz input |
| GPSDO | Optional | Optional |
| IQ formats | CS16 (native), CF32 (host-side conversion) | CS16, CF32 |

Implementations MAY support USRP B-series for professional-grade SIGINT collection. Note that raw IQ streaming at full rate (56 MSPS CS16 = 224 MB/s) exceeds practical NATS throughput limits and MUST be handled via sidecar-side FFT or decimation before NATS transport.

### TSG.16.4.2 UHD API Key Operations

The UHD (USRP Hardware Driver) API is the vendor-provided interface [UHD]. Key operations:

```
Device creation:     uhd::usrp::multi_usrp::make("type=b200")
Set sample rate:     usrp->set_rx_rate(rate_hz)
Set frequency:       usrp->set_rx_freq(tune_request)
Set gain:            usrp->set_rx_gain(gain_db)
Set antenna:         usrp->set_rx_antenna("TX/RX" or "RX2")
Create streamer:     usrp->get_rx_stream(stream_args)
Start streaming:     rx_stream->issue_stream_cmd(STREAM_MODE_START_CONTINUOUS)
Receive samples:     rx_stream->recv(buffer, num_samples, metadata)
Set clock source:    usrp->set_clock_source("external" or "gpsdo")
```

### TSG.16.4.3 RFNoC (RF Network-on-Chip)

The Spartan-6 FPGA in USRP B-series supports RFNoC blocks for FPGA-accelerated DSP:

| Block | Function | Benefit |
|-------|----------|---------|
| DDC | Digital Down Converter | Frequency translation + decimation in FPGA |
| FFT | Fast Fourier Transform | Offloads FFT to FPGA, reduces USB bandwidth |
| FIR Filter | Programmable filter | Channel selection in FPGA |
| Replay | Record/replay from FPGA memory | Trigger-based recording |
| Window | FFT windowing | Complete FFT pipeline in FPGA |

RFNoC processing occurs BEFORE data reaches the host, significantly reducing USB bandwidth requirements and CPU load. Implementations MAY leverage RFNoC blocks to perform FFT computation entirely in the FPGA, publishing only magnitude data to NATS.

### TSG.16.4.4 GPS-Disciplined Oscillator

USRP devices optionally support a GPS-disciplined oscillator (GPSDO) for:
- Absolute frequency accuracy (locked to GPS satellite constellation)
- PPS (Pulse Per Second) time synchronization for sample timestamping
- Phase-coherent operation across multiple synchronized USRP devices

When GPSDO is available, implementations SHOULD use it for timestamping:
```
usrp->set_clock_source("gpsdo")
usrp->set_time_source("gpsdo")
```

---

## TSG.16.5 Additional Devices

### TSG.16.5.1 LimeSDR

The LimeSDR (Lime Microsystems) provides full-duplex MIMO capability with 12-bit ADC/DAC:

| Parameter | LimeSDR USB | LimeSDR Mini |
|-----------|-------------|--------------|
| Transceiver | LMS7002M | LMS7002M |
| Frequency | 100 kHz — 3.8 GHz | 10 MHz — 3.5 GHz |
| Channels | 2x2 MIMO | 1x1 |
| Sample rate | Up to 61.44 MSPS | Up to 30.72 MSPS |
| Full-duplex | Yes | Yes |
| Interface | USB 3.0 | USB 3.0 |
| Price | ~$300 | ~$150 |

Integration via SoapySDR (SoapyLMS7 module) or GNU Radio (gr-limesdr).

### TSG.16.5.2 ADALM-Pluto (PlutoSDR)

The Analog Devices ADALM-Pluto is an educational SDR with professional-grade internals:

| Parameter | Value |
|-----------|-------|
| Transceiver | AD9364 (same chip as USRP B200) |
| Frequency | 325 MHz — 3.8 GHz (hackable to 70 MHz — 6 GHz) |
| Sample rate | Up to 61.44 MSPS |
| Bandwidth | 20 MHz |
| Full-duplex | Yes |
| Interface | USB 2.0 (OTG) |
| Price | ~$150 |

Note: The ADALM-Pluto's AD9364 transceiver supports 70 MHz — 6 GHz, but firmware restricts the range to 325 MHz — 3.8 GHz. Community firmware patches change the device-tree compatible string from `ad9364` to `ad9361`, unlocking the full range. Implementations MAY support this extended range but MUST NOT require it.

Integration via libiio, SoapySDR (SoapyPlutoSDR module), or GNU Radio (gr-iio).

---

## TSG.16.6 SoapySDR Abstraction Layer

### TSG.16.6.1 Architecture

SoapySDR [SOAPYSDR] is a vendor-neutral SDR API that provides a common interface across all SDR hardware through dynamically loaded driver modules:

```
Application (Tsingou sidecar)
         │
         ▼
  SoapySDR API (C/C++/Python)
         │
         ▼
  Driver Modules (runtime-loaded .so/.dll)
         │
    ┌────┼────┬────────┬─────────┬──────────┐
    │    │    │        │         │          │
    ▼    ▼    ▼        ▼         ▼          ▼
 RTL   HackRF  UHD    LMS7     PlutoSDR  Remote
 SDR    One    USRP   LimeSDR             (network)
```

Implementations SHOULD support SoapySDR as the primary hardware abstraction layer. This enables a single sidecar binary to operate with any supported SDR device without code changes.

### TSG.16.6.2 Core API Operations

**Device discovery:**
```
SoapySDR::Device::enumerate()           → list of device descriptors
SoapySDR::Device::enumerate("driver=rtlsdr")  → filtered list
```

**Device lifecycle:**
```
SoapySDR::Device::make(args)            → device handle
SoapySDR::Device::unmake(device)        → release device
```

**Configuration:**
```
device->setSampleRate(direction, channel, rate)
device->setFrequency(direction, channel, frequency)
device->setGain(direction, channel, gain)
device->setBandwidth(direction, channel, bandwidth)
device->setAntenna(direction, channel, antenna_name)
```

**Streaming:**
```
device->setupStream(direction, format)  → stream handle
device->activateStream(stream)
device->readStream(stream, buffers, numElems, flags, timeNs)
device->deactivateStream(stream)
device->closeStream(stream)
```

### TSG.16.6.3 Driver Module Matrix

| Module | Hardware | Status |
|--------|----------|--------|
| SoapyRTLSDR | RTL-SDR v3/v4 | Stable (RX only) |
| SoapyHackRF | HackRF One | Stable (TX/RX) |
| SoapyUHD | USRP family | Stable (full UHD features) |
| SoapyLMS7 | LimeSDR family | Stable (full-duplex, MIMO) |
| SoapyPlutoSDR | ADALM-Pluto | Stable (full-duplex) |
| SoapyAirspy | Airspy R2/Mini | Stable (RX only) |
| SoapyAirspyHF | Airspy HF+ Discovery | Stable (RX only, HF+VHF) |
| SoapyBladeRF | BladeRF family | Stable (full-duplex) |
| SoapyRemote | Network bridge | Stable (any device over network) |

### TSG.16.6.4 SoapyRemote

SoapyRemote enables network-attached SDR operation, allowing the SDR hardware to be physically separated from the processing host:

```
┌─────────────┐     TCP/UDP     ┌──────────────┐
│ Client      │◄───────────────►│ SoapyRemote  │
│ (sidecar)   │                 │ Server       │
│ SoapySDR    │                 │ + local drv  │
│ remote drv  │                 │ + SDR HW     │
└─────────────┘                 └──────────────┘
```

Server: `SoapySDRServer --bind=0.0.0.0:55132`

This is particularly valuable for distributed deployment scenarios where SDR antennas are mounted at elevated positions (rooftop, tower) while analysis processing runs elsewhere.

Implementations MAY support SoapyRemote for distributed SDR deployment. When used, implementations MUST account for network latency in frequency change commands (add ~1-5 ms per control operation).

---

## TSG.16.7 IQ Sample Formats

### TSG.16.7.1 Mathematical Foundation

SDR receivers convert analog RF signals to digital baseband complex (IQ) representation:

```
RF signal:    s(t) = A(t) * cos(2*pi*f_c*t + phi(t))

IQ baseband:  I(t) = A(t) * cos(phi(t))       ← In-phase
              Q(t) = A(t) * sin(phi(t))       ← Quadrature

Complex:      z(t) = I(t) + j*Q(t) = A(t) * e^(j*phi(t))
```

This representation preserves amplitude A(t) and phase phi(t), enabling frequency discrimination, phase-sensitive demodulation, and full Nyquist bandwidth utilization.

### TSG.16.7.2 Format Catalog

Implementations MUST support at least CU8 and CF32 formats. Implementations SHOULD support CS8 and CS16.

| Format | Bits/Value | Bytes/Sample | Value Range | SigMF Datatype | Primary Device |
|--------|-----------|-------------|-------------|----------------|----------------|
| CU8 | 8 | 2 | 0-255 | `cu8` | RTL-SDR |
| CS8 | 8 | 2 | -128..127 | `ci8` | HackRF One |
| CS16 | 16 | 4 | -32768..32767 | `ci16_le` | USRP, PlutoSDR |
| CF32 | 32 | 8 | +-3.4e38 | `cf32_le` | GNU Radio |
| CF64 | 64 | 16 | +-1.8e308 | `cf64_le` | MATLAB, SciPy |

### TSG.16.7.3 Memory Layout

All IQ formats interleave I and Q values. Multi-byte formats use little-endian byte order (indicated by `_le` suffix in SigMF datatype strings).

CU8 (RTL-SDR native):
```
Byte offset: 0    1    2    3    4    5    ...
Content:     I[0] Q[0] I[1] Q[1] I[2] Q[2]
Type:        u8   u8   u8   u8   u8   u8
```

CS16 (USRP native):
```
Byte offset: 0  1    2  3    4  5    6  7    ...
Content:     I[0]_LE  Q[0]_LE  I[1]_LE  Q[1]_LE
Type:        s16      s16      s16      s16
```

### TSG.16.7.4 Conversion Formulas

When converting between formats, implementations MUST use the following formulas:

**CU8 → CF32** (RTL-SDR to processing):
```
I_f32 = (I_u8 - 127.4) / 128.0
Q_f32 = (Q_u8 - 127.4) / 128.0
```

The offset value 127.4 (not 127.5 or 128.0) is the empirically measured DC offset for the RTL2832U ADC. Using the correct offset minimizes the DC spike artifact.

**CS8 → CF32** (HackRF to processing):
```
I_f32 = I_s8 / 128.0
Q_f32 = Q_s8 / 128.0
```

**CS16 → CF32** (USRP to processing):
```
I_f32 = I_s16 / 32768.0
Q_f32 = Q_s16 / 32768.0
```

**CF32 → CS16** (processing to recording with quantization):
```
I_s16 = clamp(round(I_f32 * 32767), -32768, 32767)
Q_s16 = clamp(round(Q_f32 * 32767), -32768, 32767)
```

### TSG.16.7.5 Dynamic Range Analysis

| Format | Bits | Theoretical DR | Quantization Noise | ENOB |
|--------|------|---------------|-------------------|------|
| CU8/CS8 | 8 | 48.16 dB | -48.16 dBFS | ~6.5 |
| CS12 | 12 | 72.25 dB | -72.25 dBFS | ~10.5 |
| CS16 | 16 | 96.33 dB | -96.33 dBFS | ~14 |
| CF32 | 23 (mantissa) | 138.5 dB | -138.5 dBFS | ~23 |

Formula: `DR = 6.02 * N + 1.76 dB` where N = effective number of bits.

8-bit formats (CU8, CS8) provide approximately 48 dB of dynamic range. This is sufficient for detecting signals above the noise floor and for basic spectrum monitoring, but insufficient for precise amplitude measurements or weak signal detection near strong transmitters. When dynamic range requirements exceed 48 dB, implementations SHOULD use USRP (12-bit) or perform DSP in CF32 format.

### TSG.16.7.6 Data Rate Calculations

| Device | Rate | Format | Data Rate | MB/s | GB/hour |
|--------|------|--------|-----------|------|---------|
| RTL-SDR | 2.4 MSPS | CU8 | 4.8 MB/s | 4.58 | 16.5 |
| HackRF | 8 MSPS | CS8 | 16 MB/s | 15.26 | 54.9 |
| HackRF | 20 MSPS | CS8 | 40 MB/s | 38.15 | 137.3 |
| USRP B200 | 10 MSPS | CS16 | 40 MB/s | 38.15 | 137.3 |
| USRP B200 | 56 MSPS | CS16 | 224 MB/s | 213.6 | 769.0 |

These data rates apply to raw IQ streaming. FFT-only output is dramatically smaller (typically 10-50 KB/s) because it transmits only the magnitude array, not the raw samples.

---

## TSG.16.8 Device Selection Matrix

### TSG.16.8.1 Comprehensive Comparison

| Feature | RTL-SDR v4 | HackRF One | USRP B200 | USRP B210 | LimeSDR USB | PlutoSDR |
|---------|-----------|------------|-----------|-----------|-------------|----------|
| Price | ~$30 | ~$350 | ~$800 | ~$1,400 | ~$300 | ~$150 |
| Freq (MHz) | 24-1766 | 1-6000 | 70-6000 | 70-6000 | 0.1-3800 | 325-3800* |
| Bandwidth | 2.56 MHz | 20 MHz | 56 MHz | 56 MHz | 61.44 MHz | 20 MHz |
| ADC Bits | 8 | 8 | 12 | 12 | 12 | 12 |
| TX | No | Yes | Yes | Yes | Yes | Yes |
| Duplex | N/A | Half | Full | Full | Full | Full |
| MIMO | No | No | No | 2x2 | 2x2 | No |
| USB | 2.0 | 2.0 | 3.0 | 3.0 | 3.0 | 2.0 |
| FPGA | No | No | Yes | Yes | Yes | Yes |
| GPS Sync | No | No | Optional | Optional | No | No |
| HF | Yes (V4) | Yes | No | No | Yes | No |
| Open HW | Partial | Full | No | No | Full | No |
| SoapySDR | Yes | Yes | Yes | Yes | Yes | Yes |

\* Hackable to 70-6000 MHz

### TSG.16.8.2 Device Tier Classification

| Tier | Devices | Use Case | Tsingou Support Level |
|------|---------|----------|----------------------|
| Entry | RTL-SDR v4 | Learning, ADS-B, narrowband monitoring | MUST support |
| Intermediate | HackRF One | Wideband analysis, spectrum sweep | SHOULD support |
| Professional | USRP B200/B210 | High-dynamic-range SIGINT, MIMO | MAY support |
| Specialty | LimeSDR, PlutoSDR | Full-duplex, research | MAY support (via SoapySDR) |

### TSG.16.8.3 Selection Decision Tree

```
Primary use case?
│
├─ Signal monitoring (RX only)
│  ├─ Budget < $50 ─────────────► RTL-SDR v4
│  ├─ Need wideband (>3 MHz) ──► HackRF One
│  ├─ Need high dynamic range ─► USRP B200
│  └─ Need MIMO ───────────────► USRP B210
│
├─ Spectrum surveillance
│  ├─ Full 1-6 GHz sweep ──────► HackRF One (sweep mode)
│  ├─ High-resolution scan ────► USRP B200 (12-bit)
│  └─ Multi-band simultaneous ─► USRP B210 (MIMO) or RTL-SDR array
│
└─ Protocol decoding
   ├─ ADS-B / AIS / POCSAG ───► RTL-SDR v4 (sufficient, cheapest)
   ├─ P25 / DMR / trunked ────► RTL-SDR v4 or HackRF One
   └─ Wideband digital ────────► HackRF One or USRP
```

---

## TSG.16.9 Sidecar Architecture

### TSG.16.9.1 Design Philosophy

The SDR sidecar is a standalone process that:
1. Opens SDR hardware via vendor library (librtlsdr, libhackrf, UHD, SoapySDR)
2. Reads IQ samples from the device
3. Performs minimal processing (FFT, format conversion)
4. Publishes results to NATS
5. Accepts commands from NATS (tune, scan, configure)
6. Reports health status to NATS

The sidecar runs outside the Tauri webview process for resource isolation and crash containment. If the sidecar crashes (e.g., USB disconnect), the Tsingou application continues running and can restart the sidecar when the device is reconnected.

### TSG.16.9.2 Implementation Language

Implementations SHOULD use Rust for production sidecar binaries:

| Concern | Rust Advantage |
|---------|---------------|
| FFI to C libraries | First-class C FFI via `extern "C"` |
| Performance | Zero-cost abstractions, no GC pauses |
| Safety | Borrow checker prevents use-after-free, data races |
| Async I/O | Tokio runtime for async NATS (async-nats crate) |
| FFT | rustfft crate (pure Rust, competitive with FFTW) |
| Cross-compilation | Cargo cross-compile for ARM targets |

Implementations MAY use Python (pyrtlsdr + nats.py) for prototyping and testing. Python sidecars are acceptable for Tier 1 (hobby) deployments.

### TSG.16.9.3 Configuration Schema

The sidecar configuration MUST be expressible as an Effect Schema for consistency with the Tsingou type system:

```typescript
const SdrSidecarConfig = Schema.Struct({
  /** SDR device identifier (serial number or index) */
  deviceId: Schema.String,

  /** Device type for driver selection */
  deviceType: Schema.Literal('rtlsdr', 'hackrf', 'usrp', 'soapy'),

  /** Center frequency in Hz */
  centerFreq: Schema.Number.pipe(Schema.greaterThan(0)),

  /** Sample rate in Hz */
  sampleRate: Schema.Number.pipe(Schema.greaterThan(0)),

  /** Gain in dB (null = auto) */
  gain: Schema.NullOr(Schema.Number),

  /** FFT configuration */
  fft: Schema.Struct({
    /** FFT size (must be power of 2) */
    size: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
    /** Overlap ratio (0.0-1.0) */
    overlap: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(1)),
    /** Window function name */
    window: Schema.Literal('hann', 'hamming', 'blackman', 'blackman_harris', 'kaiser', 'rectangular'),
    /** Number of FFTs to average before publishing */
    averaging: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  }),

  /** Output mode */
  outputMode: Schema.Literal('fft', 'iq', 'both'),

  /** NATS connection */
  nats: Schema.Struct({
    url: Schema.String,
    subjectPrefix: Schema.String,
  }),
})
```

### TSG.16.9.4 Device Lifecycle State Machine

```
                    ┌───────────┐
                    │           │
            ┌──────►  INIT     │
            │       │           │
            │       └─────┬─────┘
            │             │ device found
            │             ▼
            │       ┌───────────┐
            │       │           │
       error│  ┌────► CONFIGURE │◄──── tune/reconfig command
            │  │    │           │
            │  │    └─────┬─────┘
            │  │          │ configured
            │  │          ▼
            │  │    ┌───────────┐
            │  │    │           │ ◄─── resume command
            │  │    │  RUNNING  ├────► PAUSED ──┐
            │  │    │           │ pause         │
            │  │    └─────┬─────┘          resume
            │  │          │                     │
            │  │          │ stop command    ┌────┘
            │  │          ▼                │
            │  │    ┌───────────┐          │
            │  │    │           │◄─────────┘
            │  └────┤ SHUTDOWN  │
            │       │           │
            │       └─────┬─────┘
            │             │ device released
            └─────────────┘
```

Implementations MUST handle USB disconnect (device removal) as a transition to INIT state with automatic retry. The sidecar SHOULD publish a health message indicating the device disconnect.

### TSG.16.9.5 Multi-Device Coordination

When multiple SDR devices are attached, the sidecar MUST:

1. **Enumerate devices** at startup using serial numbers for persistent identification
2. **Register each device** in NATS KV store at `tsingou.sdr.devices.{serial}`
3. **Assign frequency bands** per device (manually configured or auto-divided)
4. **Publish health** for each device independently on `tsingou.signal.sdr.health.{device_id}`

Device registry KV value schema:

```typescript
const SdrDeviceRegistryEntry = Schema.Struct({
  serial: Schema.String,
  deviceType: Schema.String,
  centerFreq: Schema.Number,
  sampleRate: Schema.Number,
  status: Schema.Literal('running', 'paused', 'error', 'disconnected'),
  lastSeen: Schema.DateFromSelf,
  metrics: Schema.Struct({
    droppedSamples: Schema.Number,
    fftRate: Schema.Number,
    usbErrors: Schema.Number,
  }),
})
```

### TSG.16.9.6 Health Monitoring

The sidecar MUST publish health heartbeat messages at a minimum interval of 5 seconds:

Subject: `tsingou.signal.sdr.health.{device_id}`

```json
{
  "type": "health",
  "deviceId": "rtlsdr-00000001",
  "status": "running",
  "uptime": 3600,
  "metrics": {
    "sampleRate": 2400000,
    "actualSampleRate": 2399987,
    "droppedSamples": 0,
    "fftRate": 10.2,
    "usbErrors": 0,
    "temperature": null,
    "cpuUsage": 12.5
  },
  "config": {
    "centerFreq": 433920000,
    "gain": 40,
    "fftSize": 1024
  },
  "timestamp": 1708300000.123
}
```

If no health message is received within 15 seconds (3x the minimum interval), the Tsingou application SHOULD consider the sidecar unresponsive and MAY attempt to restart it.

---

## TSG.16.10 Normative Requirements Summary

### TSG.16.10.1 Device Support

| Requirement | Level | Rationale |
|-------------|-------|-----------|
| RTL-SDR v4 support | MUST | Minimum viable SDR, lowest barrier to entry |
| HackRF One support | SHOULD | Wideband capability, common in SIGINT |
| USRP B200/B210 support | MAY | Professional grade, higher cost |
| SoapySDR abstraction | SHOULD | Enables broad device compatibility |

### TSG.16.10.2 Architecture

| Requirement | Level |
|-------------|-------|
| DSP in external processes (not in Tsingou) | MUST |
| Support at least one integration path (GNU Radio or sidecar) | MUST |
| Support both integration paths | SHOULD |
| Sidecar crash isolation from Tsingou application | MUST |
| Device serial number for persistent identification | SHOULD |

### TSG.16.10.3 IQ Formats

| Requirement | Level |
|-------------|-------|
| Support CU8 format | MUST |
| Support CF32 format | MUST |
| Support CS8 format | SHOULD |
| Support CS16 format | SHOULD |
| Use correct DC offset (127.4) for CU8 conversion | MUST |

### TSG.16.10.4 Sample Rates

| Requirement | Level |
|-------------|-------|
| Default RTL-SDR to 2.4 MSPS | MUST |
| Warn user for RTL-SDR rates > 2.56 MSPS | MUST |
| Publish health heartbeat every 5 seconds | MUST |

### TSG.16.10.5 NATS Integration

| Requirement | Level |
|-------------|-------|
| Publish SDR data to NATS subjects per taxonomy (TSG.18.5) | MUST |
| Accept frequency commands on `tsingou.signal.sdr.command.*` | SHOULD |
| Register devices in NATS KV store | SHOULD |
| Handle USB disconnect with automatic retry | MUST |

---

## TSG.16.11 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [ADR-011] | "ADR-011: SDR Integration via GNU Radio Bridge + RTL-SDR Sidecar", Tsingou ADR |
| [RTLSDR] | steve-m, "librtlsdr", https://github.com/steve-m/librtlsdr |
| [HACKRF] | Great Scott Gadgets, "HackRF", https://github.com/greatscottgadgets/hackrf |
| [UHD] | Ettus Research, "UHD Manual", https://files.ettus.com/manual/ |
| [SOAPYSDR] | Pothosware, "SoapySDR", https://github.com/pothosware/SoapySDR |
| [SIGMF] | "Signal Metadata Format Specification", https://github.com/sigmf/SigMF |
| [EFFECT] | "Effect-TS", https://effect.website |
