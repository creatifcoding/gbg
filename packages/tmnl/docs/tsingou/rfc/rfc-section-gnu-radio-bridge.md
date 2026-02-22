# TSG-RFC-002 Section: GNU Radio Bridge

```
Section:       GNU Radio Bridge
Section ID:    TSG.17
Parent RFC:    TSG-RFC-002 (Tsingou SIGINT Visualization Platform)
Part:          IV — SDR & RF Integration (Normative)
Status:        DRAFT
Author:        Val (sdr-analyst)
Created:       2026-02-18
Research Base: research-gnu-radio-architecture.md (1,478 lines),
               research-protocol-decoders.md (633 lines)
Codebase Refs: src/lib/tsingou-flow/adapters/HolonetBridgeAdapter.ts (277 lines),
               docs/tsingou/adr/ADR-011-sdr-gnu-radio-bridge.md (125 lines)
```

> This section specifies the GNU Radio integration bridge for the Tsingou SIGINT
> visualization platform. It establishes bridge architecture patterns, the custom
> NATS sink block design, ZMQ bridge alternative, DSP processing reference, and
> protocol decoder integration. The key words "MUST", "MUST NOT", "REQUIRED",
> "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED",
> "MAY", and "OPTIONAL" in this document are to be interpreted as described in
> [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.17.1 Bridge Architecture](#tsg171-bridge-architecture)
2. [TSG.17.2 GNU Radio Flow Graph Model](#tsg172-gnu-radio-flow-graph-model)
3. [TSG.17.3 ZMQ Bridge Pattern](#tsg173-zmq-bridge-pattern)
4. [TSG.17.4 Custom NATS Sink (gr-nats)](#tsg174-custom-nats-sink-gr-nats)
5. [TSG.17.5 DSP Processing Reference](#tsg175-dsp-processing-reference)
6. [TSG.17.6 Protocol Decoder Integration](#tsg176-protocol-decoder-integration)
7. [TSG.17.7 Example Flow Graphs](#tsg177-example-flow-graphs)
8. [TSG.17.8 GNU Radio 4.0 Migration](#tsg178-gnu-radio-40-migration)
9. [TSG.17.9 Normative Requirements](#tsg179-normative-requirements)
10. [TSG.17.10 References](#tsg1710-references)

---

## TSG.17.1 Bridge Architecture

### TSG.17.1.1 Overview

The GNU Radio Bridge provides a transport layer between GNU Radio [GNURADIO] signal processing flow graphs and the Tsingou analysis platform via the NATS messaging fabric. GNU Radio handles all DSP operations; the bridge publishes processed results to NATS subjects where Tsingou's HolonetBridgeAdapter (kind: "sdr") subscribes.

### TSG.17.1.2 Bridge Strategies

Three bridge strategies exist, in order of preference:

| Strategy | Path | Latency | Complexity | Recommended For |
|----------|------|---------|------------|-----------------|
| gr-nats OOT sink | GNU Radio → NATS (direct) | Lowest | Medium | Production |
| ZMQ bridge | GNU Radio → ZMQ → bridge → NATS | Medium | Low | Prototyping |
| Embedded Python | GNU Radio → Python block → NATS | Variable | Lowest | Quick tests |

Implementations MUST support at least one bridge strategy. Implementations SHOULD support the gr-nats OOT sink for production deployments.

### TSG.17.1.3 Data Flow Diagrams

**Strategy 1: gr-nats OOT Sink (Recommended)**

```
┌─────────────────────────────────────────────────────┐
│ GNU Radio Flow Graph                                │
│                                                     │
│ ┌──────────┐   ┌─────────┐   ┌──────────────────┐ │
│ │ SDR      │──►│ DSP     │──►│ nats_pub_sink    │─┼──► NATS
│ │ Source   │   │ Blocks  │   │ (gr-nats OOT)    │ │
│ └──────────┘   └─────────┘   └──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Strategy 2: ZMQ Bridge**

```
┌──────────────────────────────────┐
│ GNU Radio Flow Graph             │    ┌──────────────────┐
│                                  │    │ Bridge Process   │
│ ┌──────────┐   ┌──────────────┐ │    │ (Python/Rust)    │
│ │ SDR      │──►│ zmq_pub_sink │─┼──► │                  │──► NATS
│ │ Source   │   │ (ZMQ PUB)    │ │ZMQ │ ZMQ SUB → JSON   │
│ └──────────┘   └──────────────┘ │    │ → NATS publish   │
└──────────────────────────────────┘    └──────────────────┘
```

**Strategy 3: Embedded Python Block**

```
┌─────────────────────────────────────────────────────┐
│ GNU Radio Flow Graph                                │
│                                                     │
│ ┌──────────┐   ┌─────────┐   ┌──────────────────┐ │
│ │ SDR      │──►│ DSP     │──►│ Embedded Python  │─┼──► NATS
│ │ Source   │   │ Blocks  │   │ (nats.py inline) │ │
│ └──────────┘   └─────────┘   └──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## TSG.17.2 GNU Radio Flow Graph Model

### TSG.17.2.1 Block Type Reference

GNU Radio processing is organized as a flow graph of typed blocks [GNURADIO]. Understanding block types is essential for designing GNU Radio flow graphs that integrate with Tsingou.

| Block Type | Class | I/O Ratio | work() Contract | Use Case |
|------------|-------|-----------|----------------|----------|
| Sync block | `gr.sync_block` | 1:1 | Equal input/output | Gain, threshold, type conversion |
| Decimation block | `gr.decim_block` | N:1 | N inputs → 1 output | FIR decimator, CIC |
| Interpolation block | `gr.interp_block` | 1:N | 1 input → N outputs | Upsampler, interpolator |
| General block | `gr.basic_block` | Arbitrary | Manual consume/produce | Variable-rate decoder, AGC |
| Tagged stream block | `gr.tagged_stream_block` | Packet-based | Length-tagged packets | Packet encoder/decoder |
| Hierarchical block | `gr.hier_block2` | Composite | Sub-flowgraph | WBFM receiver, channel filter |
| Message-only block | `gr.basic_block` (no sig) | Messages only | PMT handler callback | Protocol message decoder |

### TSG.17.2.2 Buffer Management

Stream connections between blocks use circular buffers with memory-mapped double-mapping (the buffer appears twice in virtual memory, eliminating copy at wraparound). The scheduler negotiates buffer sizes based on each block's output_multiple and history requirements.

### TSG.17.2.3 PMT (Polymorphic Types)

GNU Radio's message passing system uses PMT values for inter-block communication:

| PMT Type | Constructor | Python Equivalent |
|----------|-------------|-------------------|
| Boolean | `pmt.PMT_T` / `pmt.PMT_F` | `bool` |
| Integer | `pmt.from_long(n)` | `int` |
| Float | `pmt.from_double(x)` | `float` |
| Complex | `pmt.from_complex(z)` | `complex` |
| String | `pmt.intern("str")` | `str` |
| Pair | `pmt.cons(car, cdr)` | `tuple` |
| Dict | `pmt.make_dict()` | `dict` |
| Vector | `pmt.init_f32vector(N, data)` | `np.ndarray` |
| Blob | `pmt.make_blob(data, len)` | `bytes` |

PMT values are used in:
- **Message passing**: Async communication between blocks (e.g., decoded protocol data)
- **Stream tags**: Key-value metadata attached to specific sample positions (e.g., `rx_freq` on retune)

### TSG.17.2.4 Stream Tags

Stream tags are key-value annotations at specific sample positions. Standard tags include:

| Tag Key | Type | Description | Set By |
|---------|------|-------------|--------|
| `rx_freq` | double | Center frequency (Hz) | Source block on tune |
| `rx_rate` | double | Sample rate (Hz) | Source block |
| `rx_time` | pair(long, double) | UHD timestamp | UHD source |
| `packet_len` | long | Packet length (samples) | Tagged stream blocks |
| `burst_start` | bool | Burst detection | Signal detection blocks |

The gr-nats sink block MUST propagate `rx_freq` and `rx_rate` tags to NATS message metadata so that Tsingou can correctly label spectrum displays.

---

## TSG.17.3 ZMQ Bridge Pattern

### TSG.17.3.1 Available ZMQ Blocks

GNU Radio provides ZMQ blocks [ZMQ] for inter-process communication:

**Stream blocks:**

| Sink | Source | Pattern | Use Case |
|------|--------|---------|----------|
| `zmq_pub_sink` | `zmq_sub_source` | PUB/SUB | Fan-out to multiple receivers |
| `zmq_push_sink` | `zmq_pull_source` | PUSH/PULL | Load-balanced pipeline |
| `zmq_rep_sink` | `zmq_req_source` | REQ/REP | Request-reply |

**Message blocks:**

| Sink | Source | Pattern |
|------|--------|---------|
| `zmq_pub_msg_sink` | `zmq_sub_msg_source` | PUB/SUB (PMT) |
| `zmq_push_msg_sink` | `zmq_pull_msg_source` | PUSH/PULL (PMT) |

Implementations using the ZMQ bridge SHOULD use the PUB/SUB pattern (`zmq_pub_sink`) for stream data.

### TSG.17.3.2 ZMQ Sink Configuration

```python
from gnuradio import zeromq

pub_sink = zeromq.pub_sink(
    gr.sizeof_gr_complex,    # item_size: 8 bytes per complex sample
    1,                        # vlen: vector length
    "tcp://*:5555",           # address: bind to all interfaces, port 5555
    100,                      # timeout: ms
    True,                     # pass_tags: propagate stream tags
    65536                     # hwm: high water mark (messages)
)
```

### TSG.17.3.3 ZMQ → NATS Bridge Process

The bridge subscribes to the ZMQ PUB socket, computes FFT (if receiving raw IQ), serializes to JSON, and publishes to NATS.

**Python implementation:**

```python
async def zmq_to_nats_bridge(zmq_addr, nats_url, nats_subject, fft_size=1024):
    ctx = zmq.asyncio.Context()
    sub = ctx.socket(zmq.SUB)
    sub.connect(zmq_addr)
    sub.setsockopt(zmq.SUBSCRIBE, b"")

    nc = await nats.connect(nats_url)
    window = np.hanning(fft_size)
    seq = 0

    while True:
        raw = await sub.recv()
        samples = np.frombuffer(raw, dtype=np.complex64)

        if len(samples) >= fft_size:
            fft_data = np.fft.fftshift(np.fft.fft(samples[:fft_size] * window))
            magnitudes = 20 * np.log10(np.abs(fft_data) + 1e-12)

            msg = json.dumps({
                "type": "fft",
                "magnitudes": magnitudes.tolist(),
                "fftSize": fft_size,
                "timestamp": time.time(),
                "seq": seq,
            }).encode()

            await nc.publish(nats_subject, msg)
            seq += 1
```

**Rust implementation** (higher performance) is provided in the research file `research-gnu-radio-architecture.md` Section 6.3, using the `zmq`, `rustfft`, `async-nats`, and `serde_json` crates.

### TSG.17.3.4 Performance Characteristics

| Metric | ZMQ PUB/SUB | Impact on Bridge |
|--------|-------------|-----------------|
| Latency | <1 ms (local) | Adds ~1-2 ms to pipeline |
| Throughput | >1 GB/s (local) | Not a bottleneck |
| Memory | HWM * message_size | ~65 MB at default HWM |
| Reliability | Best-effort (drop on slow) | Acceptable for real-time display |

---

## TSG.17.4 Custom NATS Sink (gr-nats)

### TSG.17.4.1 Module Design

The gr-nats Out-Of-Tree (OOT) module provides two blocks:

| Block | Type | Input | Output |
|-------|------|-------|--------|
| `nats_pub_sink` | `gr.sync_block` | Complex stream | NATS messages (JSON or binary) |
| `nats_pub_msg_sink` | Message-only | PMT messages | NATS messages (JSON) |

### TSG.17.4.2 nats_pub_sink Specification

The stream sink block receives continuous complex samples, applies FFT with configurable windowing, and publishes magnitude arrays to NATS.

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `nats_url` | string | `nats://localhost:4222` | NATS server URL |
| `subject` | string | `tsingou.signal.sdr.fft.device0` | NATS publish subject |
| `output_format` | enum | `fft_json` | `fft_json`, `iq_binary`, or `iq_json` |
| `fft_size` | int | 1024 | FFT size (power of 2) |
| `window` | enum | `hann` | Window function |
| `fft_averaging` | int | 1 | Number of FFTs to average before publish |

**Window functions available:**

| Name | Sidelobe | Mainlobe | Best For |
|------|----------|----------|----------|
| `rectangular` | -13 dB | Narrowest | Transient analysis |
| `hann` | -32 dB | 1.44 bins | General spectrum analysis |
| `hamming` | -43 dB | 1.30 bins | Communications |
| `blackman` | -58 dB | 1.68 bins | High dynamic range |
| `blackman_harris` | -92 dB | 1.90 bins | Weak signal detection |
| `kaiser` | -90 dB | ~1.8 bins | Tunable trade-off |
| `flat_top` | -94 dB | 3.72 bins | Amplitude measurement |

### TSG.17.4.3 Thread/Async Bridge

GNU Radio blocks execute in synchronous threads (`work()` is a blocking function), while NATS clients use async I/O. The gr-nats sink bridges these worlds:

```
GNU Radio thread ──► work() ──► asyncio.run_coroutine_threadsafe() ──► NATS async publish
                                            │
                                     Background thread
                                     (asyncio event loop)
```

Implementations MUST NOT block the `work()` function on NATS publish operations. The async bridge pattern (background thread running an asyncio event loop) ensures that NATS network latency does not stall the GNU Radio scheduler.

### TSG.17.4.4 FFT Output Message Format

When `output_format = fft_json`, each published NATS message contains:

```json
{
  "type": "fft",
  "magnitudes": [-80.5, -78.2, -75.1, ...],
  "centerFrequency": 433920000,
  "bandwidth": 2400000,
  "fftSize": 1024,
  "windowFunction": "hann",
  "averageCount": 1,
  "timestamp": 1708300000.123,
  "seq": 42
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | MUST | Always "fft" |
| `magnitudes` | number[] | MUST | dBFS values, length = fftSize |
| `centerFrequency` | number | MUST | Center frequency in Hz |
| `bandwidth` | number | MUST | Instantaneous bandwidth in Hz (= sampleRate) |
| `fftSize` | number | MUST | Number of FFT points |
| `windowFunction` | string | SHOULD | Window function name |
| `averageCount` | number | MAY | Number of averaged FFTs |
| `timestamp` | number | MUST | Unix timestamp (seconds, fractional) |
| `seq` | number | MUST | Monotonically increasing sequence number |

### TSG.17.4.5 IQ Output Message Format

When `output_format = iq_binary`, the message is a binary frame:

```
┌──────────────────────┬───────────────────────────────┐
│ Header Length (4B LE) │ JSON Header                   │
├──────────────────────┼───────────────────────────────┤
│ uint32               │ UTF-8 JSON string             │
└──────────────────────┴───────────────────────────────┘
│ Binary IQ Samples (CF32 or native format)             │
└───────────────────────────────────────────────────────┘
```

JSON header:
```json
{
  "type": "iq",
  "format": "cf32",
  "centerFrequency": 433920000,
  "sampleRate": 2400000,
  "sampleCount": 65536,
  "timestamp": 1708300000.123,
  "seq": 42
}
```

### TSG.17.4.6 nats_pub_msg_sink Specification

The message sink block converts incoming PMT messages to JSON and publishes to NATS. This is used for decoded protocol output from GNU Radio demodulator/decoder blocks that produce PMT messages rather than stream data.

**Message format:**
```json
{
  "type": "decoded",
  "data": { ... PMT message converted to JSON ... },
  "timestamp": 1708300000.123
}
```

### TSG.17.4.7 GRC Block Descriptor

The gr-nats blocks MUST provide YAML block descriptors for GNU Radio Companion (GRC) integration:

```yaml
id: nats_nats_pub_sink
label: NATS Publish Sink
category: '[NATS]'
parameters:
- id: nats_url
  label: NATS URL
  dtype: string
  default: 'nats://localhost:4222'
- id: subject
  label: NATS Subject
  dtype: string
- id: output_format
  label: Output Format
  dtype: enum
  options: ['fft_json', 'iq_binary', 'iq_json']
- id: fft_size
  label: FFT Size
  dtype: int
  default: '1024'
- id: window
  label: Window Function
  dtype: enum
  options: ['hann', 'hamming', 'blackman', 'blackman_harris', 'kaiser', 'flat_top']
inputs:
- label: in
  domain: stream
  dtype: complex
```

---

## TSG.17.5 DSP Processing Reference

This subsection provides the DSP theory reference for signal processing operations performed in GNU Radio flow graphs. See TSG.25 for the full DSP foundations treatment.

### TSG.17.5.1 FFT Computation

The Discrete Fourier Transform converts time-domain samples to frequency-domain representation:

```
X[k] = SUM_{n=0}^{N-1} x[n] * e^(-j*2*pi*k*n/N)    for k = 0, 1, ..., N-1
```

The Fast Fourier Transform (FFT) computes this in O(N log N) operations via the Cooley-Tukey divide-and-conquer algorithm [OPPENHEIM].

**Frequency resolution:**
```
delta_f = sample_rate / fft_size
```

**dBFS conversion:**
```
dBFS[k] = 20 * log10(|X[k]| / N)
```

### TSG.17.5.2 Windowing

Implementations MUST apply a window function before FFT to reduce spectral leakage. The default window SHOULD be Hann (good general-purpose trade-off between mainlobe width and sidelobe level).

Windowing formulas:

| Window | Formula |
|--------|---------|
| Hann | `w[n] = 0.5 * (1 - cos(2*pi*n/(N-1)))` |
| Hamming | `w[n] = 0.54 - 0.46 * cos(2*pi*n/(N-1))` |
| Blackman | `w[n] = 0.42 - 0.50*cos(2*pi*n/(N-1)) + 0.08*cos(4*pi*n/(N-1))` |
| Blackman-Harris | `a0 - a1*cos(x) + a2*cos(2x) - a3*cos(3x)` where a0=0.35875, a1=0.48829, a2=0.14128, a3=0.01168, x=2*pi*n/(N-1) |
| Kaiser | `w[n] = I0(beta*sqrt(1-(2n/(N-1)-1)^2)) / I0(beta)` where I0 is the modified Bessel function |

### TSG.17.5.3 Demodulation

**FM quadrature discriminator** (the fundamental FM demodulation operation):
```
diff[n] = z[n] * conj(z[n-1])
output[n] = atan2(imag(diff[n]), real(diff[n]))
```

GNU Radio gain parameter: `gain = sample_rate / (2*pi*max_deviation)`

| Mode | Max Deviation | Channel BW | Gain (@ 240 kHz rate) |
|------|--------------|-----------|----------------------|
| WBFM | 75 kHz | 200 kHz | 0.509 |
| NBFM | 5 kHz | 12.5-25 kHz | 7.639 |

**AM envelope detection:**
```
output[n] = |z[n]| = sqrt(I[n]^2 + Q[n]^2)
```

### TSG.17.5.4 Filtering

The Frequency Xlating FIR Filter is the most important block for SDR channelization, combining:

1. Frequency translation (mix to baseband)
2. FIR low-pass filtering (channel selection)
3. Decimation (sample rate reduction)

In a single, computationally efficient operation.

```python
xlating_fir = filter.freq_xlating_fir_filter_ccc(
    decimation,     # integer decimation factor
    taps,           # FIR filter taps
    center_freq,    # frequency to translate to DC (Hz)
    sample_rate     # input sample rate (Hz)
)
```

This is 3-5x more efficient than implementing mixing, filtering, and decimation as separate blocks.

---

## TSG.17.6 Protocol Decoder Integration

### TSG.17.6.1 Universal Bridge Architecture

All protocol decoders follow a common integration pattern:

```
┌──────────────┐   stdout/TCP/HTTP   ┌────────────┐   NATS    ┌──────────┐
│ Decoder      │────────────────────►│ Bridge     │─────────►│ Tsingou  │
│ (standalone) │   (text/JSON/       │ Process    │          │ via      │
│              │    binary)          │            │          │ Holonet  │
└──────────────┘                     └────────────┘          └──────────┘
```

### TSG.17.6.2 ADS-B Integration

**Decoder**: dump1090-fa [DUMP1090] — the standard open-source ADS-B decoder.

**RF**: 1090 MHz, Pulse Position Modulation, 1 Mbit/s, Mode S Extended Squitter (DF17).

**Message structure** (112 bits):
```
DF (5 bits) | CA (3 bits) | ICAO (24 bits) | ME (56 bits) | PI/CRC (24 bits)
```

**Type Codes** (first 5 bits of ME):

| TC | Content |
|----|---------|
| 1-4 | Aircraft identification (callsign) |
| 9-18 | Airborne position (baro alt + CPR lat/lon) |
| 19 | Airborne velocity (speed, heading, vrate) |
| 20-22 | Airborne position (GNSS altitude) |
| 28 | Aircraft status (emergency) |
| 31 | Operational status (version, capability) |

**Bridge**: HTTP poll dump1090 JSON API (port 8080) → NATS publish on `tsingou.signal.sdr.decoded.adsb`.

**NATS message:**
```json
{
  "protocol": "adsb",
  "data": {
    "icao": "4840D6",
    "callsign": "UAL123",
    "altitude": 35000,
    "lat": 40.6892,
    "lon": -74.0445,
    "speed": 450,
    "heading": 270,
    "verticalRate": -500,
    "squawk": "1200",
    "rssi": -8.5
  },
  "frequency": 1090000000
}
```

### TSG.17.6.3 AIS Integration

**Decoder**: rtl_ais, gnuais, or gr-ais — AIS (Automatic Identification System) decoders.

**RF**: 161.975 MHz (Ch A), 162.025 MHz (Ch B), 9600 baud GMSK.

**27 message types** defined in ITU-R M.1371-5. Types 1-3 (position reports) and Type 5 (static/voyage data) are most common.

**Bridge**: Pipe decoder stdout (NMEA sentences) → parse → NATS publish on `tsingou.signal.sdr.decoded.ais`.

### TSG.17.6.4 POCSAG Integration

**Decoder**: multimon-ng [MULTIMON] — multi-protocol pager/amateur radio decoder.

**RF**: Various frequencies, FSK modulation, 512/1200/2400 baud.

**Transmission structure**: Preamble (576+ bits alternating 10) → Frame Sync (0x7CD215D8) → Batches of 8 frames x 2 codewords.

**Codeword format** (32 bits): 1-bit type flag + 18-20 data bits + 10 BCH parity + 1 even parity.

**Bridge**: Pipe multimon-ng stdout → parse → NATS publish on `tsingou.signal.sdr.decoded.pocsag`.

### TSG.17.6.5 P25 / DMR Integration

**P25 decoder**: OP25 [OP25] — full Phase 1 decoder with trunking support.
**DMR decoder**: DSD/DSD+ [DSD] — multi-protocol digital voice decoder.

Both produce decoded audio and metadata. The bridge publishes:
- Voice activity indicators
- Talkgroup assignments
- Unit registrations
- Encryption status

**NATS subjects**: `tsingou.signal.sdr.decoded.p25`, `tsingou.signal.sdr.decoded.dmr`

### TSG.17.6.6 ISM Band Integration

**Decoder**: rtl_433 [RTL433] — universal 433/868/915 MHz ISM band decoder supporting 200+ device protocols.

```bash
rtl_433 -F json   # Output one JSON object per decoded message
```

**Bridge**: Pipe rtl_433 JSON stdout → NATS publish on `tsingou.signal.sdr.decoded.ism.{model}`.

### TSG.17.6.7 Bridge Message Envelope

All decoded protocol messages MUST use a common JSON envelope:

```json
{
  "protocol": "<protocol_name>",
  "decoderVersion": "<decoder/version>",
  "data": { ... },
  "frequency": <reception_frequency_hz>,
  "signalStrength": <dbfs_or_null>,
  "timestamp": <unix_seconds>,
  "rawHex": "<original_hex_or_null>"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `protocol` | string | MUST | Protocol identifier (adsb, ais, pocsag, p25, dmr, ism, acars, aprs) |
| `decoderVersion` | string | SHOULD | Decoder name and version |
| `data` | object | MUST | Protocol-specific decoded data |
| `frequency` | number | MUST | Reception frequency in Hz |
| `signalStrength` | number | MAY | Signal strength in dBFS (null if unavailable) |
| `timestamp` | number | MUST | Unix timestamp (fractional seconds) |
| `rawHex` | string | MAY | Original hex-encoded raw message |

### TSG.17.6.8 Deployment Patterns

**Systemd service unit** (recommended for Linux deployments):
```ini
[Unit]
Description=Tsingou Protocol Bridge ({protocol})
After=network.target nats-server.service

[Service]
ExecStart=/usr/local/bin/tsingou-{protocol}-bridge --nats-url nats://localhost:4222
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Docker Compose** (recommended for containerized deployments): See `research-protocol-decoders.md` Section 7.4 for complete service definitions.

---

## TSG.17.7 Example Flow Graphs

### TSG.17.7.1 FM Broadcast Receiver

**Use case**: Receive local FM radio stations (88-108 MHz), publish audio metadata and RDS data to NATS.

```
┌──────────┐   ┌─────────────────┐   ┌────────────┐   ┌──────────┐
│ soapy    │──►│ freq_xlating    │──►│ wbfm_rcv   │──►│ nats_pub │
│ _source  │   │ _fir_filter     │   │ _pll       │   │ _sink    │
│ 2.4 MSPS │   │ decim=10        │   │ stereo     │   │ fft_json │
│          │   │ channel filter  │   │ demod      │   │          │
└──────────┘   └─────────────────┘   └────┬───────┘   └──────────┘
                                          │
                                     ┌────▼───────┐
                                     │ rds_decoder│──► nats_pub_msg_sink
                                     └────────────┘    (decoded.fm_rds)
```

### TSG.17.7.2 ADS-B Receiver

**Use case**: Track aircraft in real-time using dump1090.

This flow graph uses dump1090 as the decoder (not GNU Radio DSP), with a bridge process publishing to NATS:

```
RTL-SDR (2 MSPS) ──► dump1090-fa ──► JSON HTTP API ──► Bridge ──► NATS
                                                                    │
                                                          tsingou.signal.sdr
                                                          .decoded.adsb
```

### TSG.17.7.3 Multi-Protocol Scanner

**Use case**: Simultaneously decode ADS-B, POCSAG, and ISM protocols from a single wideband source.

```
                            ┌──► freq_xlating (1090 MHz) ──► dump1090 bridge
                            │
soapy_source (20 MSPS) ────┼──► freq_xlating (157.9 MHz) ──► multimon-ng bridge
(HackRF One)                │
                            └──► freq_xlating (433.9 MHz) ──► rtl_433 bridge
```

Note: This requires a HackRF or equivalent wideband device to capture all frequencies simultaneously within one 20 MHz bandwidth. The frequency xlating FIR filter extracts each channel and decimates to the protocol's required sample rate.

### TSG.17.7.4 Wideband Spectrum Monitor

**Use case**: Continuous spectrum surveillance across the full SDR bandwidth.

```
soapy_source ──► nats_pub_sink (output_format=fft_json, fft_size=4096)
(HackRF 20 MSPS)
```

For full 1-6 GHz coverage, use HackRF sweep mode (see TSG.16.3.4) with per-segment FFT data published to NATS.

---

## TSG.17.8 GNU Radio 4.0 Migration

### TSG.17.8.1 Architectural Changes

GNU Radio 4.0 [GNURADIO4] is a clean-slate redesign with:

| Feature | 3.x | 4.0 |
|---------|-----|-----|
| Scheduler | Thread-per-block | Plugin schedulers (CPU, GPU, distributed) |
| Block API | Python classes, work() | C++20 concepts, processOne() |
| Parameters | Callback-based | Property-based (auto getter/setter) |
| Buffers | Fixed circular | Flexible (NUMA-aware, GPU-mapped) |
| GRC | Python code generation | Domain-specific graph representation |

### TSG.17.8.2 Impact on Tsingou

The GNU Radio → NATS bridge is version-agnostic because the bridge operates at the I/O boundary:

- **3.x**: Python `gr.sync_block` with `nats.py` async bridge
- **4.0**: C++20 block with `nats.c` or async framework

Both produce the same NATS messages. The ZMQ bridge pattern works with either version.

Implementations SHOULD design bridge interfaces to be GNU Radio version-independent. The NATS message format (TSG.17.4.4) is the stable contract — the implementation of the sink block is an internal detail.

---

## TSG.17.9 Normative Requirements

| Requirement | Level |
|-------------|-------|
| Support at least one bridge strategy | MUST |
| gr-nats OOT sink for production deployments | SHOULD |
| Apply window function before FFT | MUST |
| Default window function: Hann | SHOULD |
| Propagate `rx_freq` and `rx_rate` tags to NATS metadata | MUST |
| Non-blocking NATS publish from work() function | MUST |
| Common JSON envelope for all decoded protocol messages | MUST |
| Include `protocol`, `data`, `frequency`, `timestamp` in envelope | MUST |
| Bridge process auto-restart on failure | SHOULD |
| Version-independent NATS message format | SHOULD |

---

## TSG.17.10 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [GNURADIO] | GNU Radio Project, https://www.gnuradio.org/ |
| [GNURADIO4] | GNU Radio 4.0, https://github.com/gnuradio/gnuradio4 |
| [ZMQ] | ZeroMQ, https://zeromq.org/ |
| [OPPENHEIM] | Oppenheim & Schafer, "Discrete-Time Signal Processing", 3rd ed., Pearson, 2010 |
| [DUMP1090] | dump1090-fa, FlightAware, https://github.com/flightaware/dump1090 |
| [MULTIMON] | multimon-ng, https://github.com/EliasOenal/multimon-ng |
| [OP25] | OP25 decoder, https://github.com/boatbod/op25 |
| [DSD] | Digital Speech Decoder, https://github.com/szechyjs/dsd |
| [RTL433] | rtl_433, https://github.com/merbanan/rtl_433 |
| [NATS] | NATS Messaging, https://nats.io/ |
