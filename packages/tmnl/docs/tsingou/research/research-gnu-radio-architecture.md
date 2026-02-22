# Research: GNU Radio Architecture & DSP Foundations

```
Research File:   GNU Radio Architecture & DSP Foundations
Target Sections: TSG.17 (GNU Radio Bridge), TSG.25 (DSP Foundations cross-ref)
Author:          Val (sdr-analyst)
Created:         2026-02-18
Sources:         [GNURADIO], [GNURADIO4], [OPPENHEIM], [HARRIS], vendor docs
```

---

## 1. GNU Radio Flow Graph Model

### 1.1 Core Concepts

GNU Radio is a flow graph-based signal processing framework. A flow graph is a directed acyclic graph (DAG) of processing blocks connected by stream or message links.

```
┌────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐
│ Source  │────►│ Process  │────►│ Process  │────►│  Sink  │
│ (osm.  │     │ (FFT)    │     │ (mag²)   │     │ (NATS) │
│ source) │     │          │     │          │     │        │
└────────┘     └──────────┘     └──────────┘     └────────┘
     stream          stream          stream
   connection      connection      connection
```

Components:
- **Source blocks**: Generate or acquire samples (hardware SDR, file, signal generator)
- **Processing blocks**: Transform streams (FFT, filter, demod, resample)
- **Sink blocks**: Consume samples (file, audio, network, display)
- **Stream connections**: Continuous sample flow with typed data (complex, float, int, byte)
- **Message connections**: Asynchronous typed messages (PMT values) between blocks
- **Stream tags**: Key-value metadata attached to specific sample positions

### 1.2 Buffer Management

GNU Radio uses circular buffers between connected blocks:

```
Writer block                    Reader block
     │                               │
     ▼                               ▼
┌─────────────────────────────────────────┐
│ Circular Buffer                         │
│ ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐ │
│ │  │  │WR│  │  │  │  │  │RD│  │  │  │ │
│ └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘ │
│        ▲ write_pointer    ▲ read_pointer│
└─────────────────────────────────────────┘
```

Buffer size is negotiated between connected blocks based on:
- Output multiple (alignment requirement)
- History requirement (how many past samples a block needs)
- Max output buffer size (configurable, default varies by block)

The scheduler ensures:
- Writer never overwrites unread data
- Reader never reads beyond written data
- Thread safety via memory-mapped double-mapping (no data copy at wraparound)

### 1.3 Scheduler

GNU Radio 3.x uses a thread-pool scheduler:

1. Each block runs in its own thread (or shares a thread pool)
2. Scheduler calls `work()` or `general_work()` when input data is available
3. Block processes available input, produces output, returns number of items consumed/produced
4. Scheduler manages buffer pointers and inter-block synchronization

The work function contract:
```
work(noutput_items, input_items, output_items):
    - noutput_items: max number of output items to produce
    - input_items: list of input buffer pointers
    - output_items: list of output buffer pointers
    - Return: number of output items produced, or -1 for EOF
```

---

## 2. Block Types — Exhaustive Reference

### 2.1 gr.sync_block — Synchronous (1:1)

The simplest block type. Input-to-output ratio is exactly 1:1.

```python
import numpy as np
from gnuradio import gr

class multiply_const(gr.sync_block):
    """Multiply input by a constant."""

    def __init__(self, constant):
        gr.sync_block.__init__(
            self,
            name='multiply_const',
            in_sig=[np.complex64],    # input signature: 1 complex stream
            out_sig=[np.complex64]    # output signature: 1 complex stream
        )
        self.constant = constant

    def work(self, input_items, output_items):
        output_items[0][:] = input_items[0] * self.constant
        return len(output_items[0])
```

Characteristics:
- `work()` receives equal-length input and output buffers
- No need to call `consume()` — framework handles it
- Simplest to implement, best for element-wise operations
- Examples: multiply, add, threshold, type conversion

### 2.2 gr.decim_block — Decimation (N:1)

Produces fewer output samples than input samples. Used for sample rate reduction.

```python
class fir_decim(gr.decim_block):
    """FIR decimating filter."""

    def __init__(self, decimation, taps):
        gr.decim_block.__init__(
            self,
            name='fir_decim',
            in_sig=[np.complex64],
            out_sig=[np.complex64],
            decim=decimation
        )
        self.taps = np.array(taps, dtype=np.complex64)
        self.set_history(len(taps))  # need past samples for convolution

    def work(self, input_items, output_items):
        nout = len(output_items[0])
        for i in range(nout):
            start = i * self.decimation()
            output_items[0][i] = np.dot(
                input_items[0][start:start + len(self.taps)],
                self.taps
            )
        return nout
```

Characteristics:
- For every `decim` input items, produces 1 output item
- Framework automatically manages the N:1 relationship
- `set_history(N)` gives access to N-1 previous samples
- Examples: FIR decimator, CIC decimator, polyphase decimator

### 2.3 gr.interp_block — Interpolation (1:N)

Produces more output samples than input samples. Used for sample rate increase.

```python
class zero_interp(gr.interp_block):
    """Zero-stuffing interpolator."""

    def __init__(self, interpolation):
        gr.interp_block.__init__(
            self,
            name='zero_interp',
            in_sig=[np.complex64],
            out_sig=[np.complex64],
            interp=interpolation
        )

    def work(self, input_items, output_items):
        nout = len(output_items[0])
        L = self.interpolation()
        for i in range(len(input_items[0])):
            output_items[0][i * L] = input_items[0][i]
            for j in range(1, L):
                output_items[0][i * L + j] = 0
        return nout
```

Characteristics:
- For every 1 input item, produces `interp` output items
- Framework manages the 1:N relationship
- Examples: FIR interpolator, zero-order hold, polyphase interpolator

### 2.4 gr.basic_block — General (Arbitrary Ratio)

The most flexible block type. Arbitrary input-to-output ratio.

```python
class variable_rate(gr.basic_block):
    """Variable-rate processor (e.g., packet decoder)."""

    def __init__(self):
        gr.basic_block.__init__(
            self,
            name='variable_rate',
            in_sig=[np.complex64],
            out_sig=[np.float32]
        )

    def forecast(self, noutput_items, ninputs):
        """Tell scheduler how many input items are needed for noutput_items."""
        # Need at least 10 input items per output item (estimate)
        return [noutput_items * 10] * ninputs

    def general_work(self, input_items, output_items):
        """Process available input, produce output."""
        ninput = len(input_items[0])
        noutput = len(output_items[0])

        consumed = 0
        produced = 0

        # Variable-rate processing logic here
        while consumed < ninput and produced < noutput:
            # ... process ...
            consumed += variable_amount
            produced += 1

        # MUST call consume to tell framework how many items were used
        self.consume(0, consumed)  # consume from input port 0
        return produced
```

Characteristics:
- `forecast()` tells the scheduler how many input items are needed
- `general_work()` replaces `work()` — must manually call `consume()`
- Can consume different amounts from different inputs
- Can produce 0 items (waiting for more input)
- Examples: packet decoder, symbol synchronizer, equalizer, AGC

### 2.5 gr.tagged_stream_block — Packetized Data

Processes data in length-tagged packets rather than continuous streams.

```python
class packet_encoder(gr.tagged_stream_block):
    """Encode packets with header + CRC."""

    def __init__(self, length_tag_key='packet_len'):
        gr.tagged_stream_block.__init__(
            self,
            name='packet_encoder',
            in_sig=[np.uint8],
            out_sig=[np.uint8],
            length_tag_key=length_tag_key
        )

    def calculate_output_stream_length(self, input_length):
        """Return output length for given input length."""
        return input_length[0] + 4 + 2  # + 4-byte header + 2-byte CRC

    def work(self, input_items, output_items):
        ninput = len(input_items[0])
        # Add header
        output_items[0][0:4] = self.make_header(ninput)
        # Copy payload
        output_items[0][4:4 + ninput] = input_items[0]
        # Add CRC
        output_items[0][4 + ninput:4 + ninput + 2] = self.compute_crc(input_items[0])
        return ninput + 6
```

Characteristics:
- Input stream is segmented by length tags (key-value stream tags at packet boundaries)
- `calculate_output_stream_length()` declares output size per packet
- `work()` processes one packet at a time
- Examples: PDU encoder/decoder, framing, FEC blocks

### 2.6 gr.hier_block2 — Hierarchical Composition

Encapsulates a sub-flowgraph as a single block. Enables modular flow graph design.

```python
class wbfm_receiver(gr.hier_block2):
    """Wideband FM receiver as a hierarchical block."""

    def __init__(self, audio_rate=48000, quad_rate=240000):
        gr.hier_block2.__init__(
            self,
            name='wbfm_receiver',
            input_signature=gr.io_signature(1, 1, gr.sizeof_gr_complex),
            output_signature=gr.io_signature(1, 1, gr.sizeof_float)
        )

        # Internal blocks
        from gnuradio import analog, filter as grfilter

        quad_demod = analog.quadrature_demod_cf(quad_rate / (2 * 3.14159 * 75000))
        audio_filter = grfilter.fir_filter_fff(
            quad_rate // audio_rate,
            grfilter.firdes.low_pass(1.0, quad_rate, 15000, 1000)
        )
        deemph = analog.fm_deemph(audio_rate, 75e-6)  # 75us North America

        # Connect sub-blocks
        self.connect(self, quad_demod, audio_filter, deemph, self)
```

Characteristics:
- Appears as a single block to the parent flow graph
- Internal connections via `self.connect()`
- `self` as first/last argument connects to hier_block's external ports
- Can contain any block types, including other hier_block2
- Examples: WBFM receiver, channel filter, protocol stack

### 2.7 Message-Only Blocks

Blocks with no stream ports — communicate only via message passing.

```python
class message_processor(gr.basic_block):
    """Process messages without stream data."""

    def __init__(self):
        gr.basic_block.__init__(
            self,
            name='message_processor',
            in_sig=[],   # No stream input
            out_sig=[]   # No stream output
        )

        # Register message ports
        self.message_port_register_in(pmt.intern('in'))
        self.message_port_register_out(pmt.intern('out'))

        # Set message handler
        self.set_msg_handler(pmt.intern('in'), self.handle_msg)

    def handle_msg(self, msg):
        """Called when a message arrives on the 'in' port."""
        # Process message
        result = self.process(pmt.to_python(msg))

        # Send result to 'out' port
        self.message_port_pub(
            pmt.intern('out'),
            pmt.to_pmt(result)
        )
```

---

## 3. PMT (Polymorphic Types) System

### 3.1 Type Hierarchy

PMT is GNU Radio's universal data container for message passing and stream tags.

| PMT Type | Creation | Python Equivalent |
|----------|----------|-------------------|
| Boolean | `pmt.PMT_T`, `pmt.PMT_F` | `True`, `False` |
| Integer | `pmt.from_long(42)` | `int` |
| Float | `pmt.from_double(3.14)` | `float` |
| Complex | `pmt.from_complex(1+2j)` | `complex` |
| String (symbol) | `pmt.intern("hello")` | `str` |
| Pair | `pmt.cons(pmt.intern("key"), pmt.from_long(42))` | `tuple(key, val)` |
| Vector | `pmt.init_f32vector(N, data)` | `numpy.ndarray` |
| Dict | `pmt.make_dict()` | `dict` |
| Blob | `pmt.make_blob(data, len)` | `bytes` |
| Null | `pmt.PMT_NIL` | `None` |

### 3.2 Common Operations

```python
import pmt

# Create dict
d = pmt.make_dict()
d = pmt.dict_add(d, pmt.intern("freq"), pmt.from_double(433.92e6))
d = pmt.dict_add(d, pmt.intern("gain"), pmt.from_long(40))

# Read dict
freq = pmt.to_double(pmt.dict_ref(d, pmt.intern("freq"), pmt.PMT_NIL))

# Serialize / deserialize
serialized = pmt.serialize_str(d)
restored = pmt.deserialize_str(serialized)

# Python conversion
py_dict = pmt.to_python(d)  # → {"freq": 433920000.0, "gain": 40}
pmt_val = pmt.to_pmt(py_dict)  # Python → PMT
```

### 3.3 Stream Tags

Stream tags are key-value metadata attached to specific sample positions:

```python
# Writing tags (in a source or processing block)
self.add_item_tag(
    0,                           # output port
    self.nitems_written(0) + N,  # absolute sample offset
    pmt.intern("rx_freq"),       # key
    pmt.from_double(433.92e6)    # value
)

# Reading tags (in a downstream block)
tags = self.get_tags_in_window(
    0,                    # input port
    0,                    # relative start
    len(input_items[0])   # relative end
)
for tag in tags:
    key = pmt.to_python(tag.key)
    value = pmt.to_python(tag.value)
    offset = tag.offset
```

Common tag keys:
- `rx_freq` — Center frequency (set by source blocks on retune)
- `rx_rate` — Sample rate
- `rx_time` — UHD timestamp (pair of seconds + fractional seconds)
- `packet_len` — Tagged stream packet length
- `burst_start` / `burst_end` — Burst boundaries

---

## 4. GNU Radio 3.10 — Current Stable

### 4.1 OOT (Out-Of-Tree) Module Structure

```
gr-mymodule/
├── CMakeLists.txt
├── python/
│   └── mymodule/
│       ├── __init__.py
│       └── my_block.py         # Python block implementation
├── grc/
│   └── mymodule_my_block.block.yml  # GRC block descriptor (YAML)
├── lib/
│   ├── my_block_impl.cc       # C++ block implementation
│   └── my_block_impl.h
├── include/
│   └── mymodule/
│       └── my_block.h          # Public C++ header
└── swig/ or python/bindings/   # Python bindings (pybind11 in 3.10+)
```

### 4.2 gr_modtool Workflow

```bash
# Create new OOT module
gr_modtool newmod mymodule

# Add a Python sync block
cd gr-mymodule
gr_modtool add -t sync -l python my_block

# Add a C++ general block
gr_modtool add -t general -l cpp my_cpp_block

# Build and install
mkdir build && cd build
cmake ..
make -j$(nproc)
sudo make install
sudo ldconfig
```

### 4.3 GRC Block Descriptor (YAML)

Since GNU Radio 3.8, block descriptors use YAML (replacing XML):

```yaml
id: mymodule_my_block
label: My Block
category: '[My Module]'
flags: [python, cpp]

parameters:
- id: constant
  label: Constant
  dtype: float
  default: '1.0'

inputs:
- label: in
  domain: stream
  dtype: complex

outputs:
- label: out
  domain: stream
  dtype: complex

templates:
  imports: from gnuradio import mymodule
  make: mymodule.my_block(${constant})
  callbacks:
  - set_constant(${constant})

documentation: |-
  Multiplies input by a constant value.

  Parameters:
    constant: Multiplication factor

file_format: 1
```

### 4.4 Key Built-in Block Categories

#### Sources

| Block | Description | Device |
|-------|-------------|--------|
| `soapy_source` | SoapySDR source (any device) | Any SoapySDR-compatible |
| `uhd_usrp_source` | USRP source via UHD | USRP family |
| `osmosdr_source` (gr-osmosdr) | Legacy multi-device source | RTL-SDR, HackRF, Airspy |
| `file_source` | Read samples from file | N/A |
| `sig_source` | Signal generator | N/A |
| `audio_source` | Audio input | Soundcard |

#### Sinks

| Block | Description | Output |
|-------|-------------|--------|
| `file_sink` | Write samples to file | Binary file |
| `audio_sink` | Audio output | Soundcard |
| `zmq_pub_sink` | ZMQ PUB publisher | Network |
| `zmq_push_sink` | ZMQ PUSH sender | Network |
| `qtgui_*_sink` | Qt5 GUI displays | Screen |
| `null_sink` | Discard samples | /dev/null |

#### DSP / Filtering

| Block | Description | Parameters |
|-------|-------------|------------|
| `fft_vcc` | Complex FFT | fft_size, forward, window |
| `logpwrfft_x` | Log power FFT | fft_size, sample_rate, frame_rate |
| `firdes` | FIR filter design (utility) | Method, cutoff, transition, window |
| `fir_filter_xxx` | FIR filter (many type variants) | Decimation, taps |
| `iir_filter_xxx` | IIR filter | Feed-forward taps, feedback taps |
| `freq_xlating_fir_filter_xxx` | Tuning + filter + decimation | Decimation, taps, center_freq, sample_rate |
| `pfb_channelizer_ccf` | Polyphase filter bank channelizer | Channels, taps, oversample |
| `rational_resampler_xxx` | Rational resampler | Interpolation, decimation, taps |

#### Demodulation

| Block | Description | Key Parameters |
|-------|-------------|----------------|
| `analog_quadrature_demod_cf` | FM discriminator (complex→float) | gain = sample_rate / (2*pi*max_deviation) |
| `analog_wfm_rcv` | WBFM mono receiver | Quad rate, audio decimation |
| `analog_wfm_rcv_pll` | WBFM stereo receiver (PLL-based) | Quad rate, audio rate |
| `analog_nbfm_rx` | NBFM receiver | Audio rate, quad rate, max_dev |
| `analog_am_demod_cf` | AM demodulator | Channel rate, audio decimation |
| `analog_agc_cc` | Automatic gain control | Rate, reference, gain, max_gain |
| `analog_pwr_squelch_cc` | Power squelch | Threshold (dB), alpha, ramp, gate |
| `analog_ctcss_squelch_ff` | CTCSS tone squelch | Rate, frequency, level, length |

#### Digital

| Block | Description |
|-------|-------------|
| `digital_constellation_decoder_cb` | Constellation decoder |
| `digital_pfb_clock_sync_ccf` | Polyphase clock synchronizer |
| `digital_costas_loop_cc` | Costas loop carrier recovery |
| `digital_fll_band_edge_cc` | Frequency-locked loop |
| `digital_correlate_access_code_bb` | Sync word correlator |
| `digital_header_payload_demux` | Header/payload demultiplexer |

---

## 5. GNU Radio 4.0 — Future Architecture

### 5.1 Motivation for Redesign

GNU Radio 4.0 is a clean-slate redesign addressing limitations of the 3.x architecture:

| 3.x Limitation | 4.0 Solution |
|----------------|--------------|
| Thread-per-block scheduling | Scheduler-as-plugin (CPU, GPU, hybrid, distributed) |
| Fixed buffer management | Flexible buffer strategies (NUMA-aware, GPU-mapped) |
| Python-heavy block API | C++20 concepts, CRTP-based blocks |
| GRC-generated Python only | Domain-specific graph representation |
| Limited heterogeneous computing | First-class GPU, FPGA, accelerator support |

### 5.2 Key Changes

**Scheduler plugins:**
- `cpu_scheduler` — Thread pool, work stealing
- `gpu_scheduler` — CUDA/OpenCL, GPU buffer management
- `distributed_scheduler` — Multi-host, gRPC-based
- Custom schedulers can be loaded as plugins

**Block API:**
```cpp
// GNU Radio 4.0 block (C++20)
template<typename T>
struct MultiplyConst : gr::Block<MultiplyConst<T>> {
    using Description = gr::Doc<R"(Multiply input by constant)">;

    gr::PortIn<T> in;
    gr::PortOut<T> out;
    float constant = 1.0f;  // Property-based parameter (auto getter/setter)

    [[nodiscard]] constexpr T processOne(T input) const noexcept {
        return input * static_cast<T>(constant);
    }
};
```

**Property-based parameters:**
- Parameters are C++ member variables with reflection
- Auto-generated getters/setters, serialization, UI binding
- No separate callback registration

### 5.3 Migration Timeline

- GNU Radio 4.0 is in active development (2024-2026+)
- 3.10 remains the stable production release
- Migration path: 3.x OOT blocks will NOT be directly compatible
- Tsingou strategy: support both 3.x and 4.0 bridge patterns (NATS sink works with either)

### 5.4 Impact on Tsingou Integration

Both GNU Radio 3.x and 4.0 produce the same output: processed samples or decoded data. The NATS sink block pattern works with both:
- 3.x: Python `gr.sync_block` with `nats.py` async bridge
- 4.0: C++20 block with `nats.c` or custom scheduler

The ZMQ bridge pattern is version-agnostic (ZMQ blocks exist in both).

---

## 6. ZMQ Bridge Pattern

### 6.1 Available ZMQ Blocks

GNU Radio provides ZMQ blocks for inter-process communication:

**Stream blocks (continuous samples):**

| Block | Pattern | Direction | Use Case |
|-------|---------|-----------|----------|
| `zmq_pub_sink` | PUB/SUB | Send | Fan-out to multiple subscribers |
| `zmq_sub_source` | PUB/SUB | Receive | Subscribe to publisher |
| `zmq_push_sink` | PUSH/PULL | Send | Load-balanced pipeline |
| `zmq_pull_source` | PUSH/PULL | Receive | Worker in pipeline |
| `zmq_rep_sink` | REQ/REP | Send (reply) | Request-reply |
| `zmq_req_source` | REQ/REP | Receive (request) | Request-reply |

**Message blocks (PMT messages):**

| Block | Pattern | Direction |
|-------|---------|-----------|
| `zmq_pub_msg_sink` | PUB/SUB | Send |
| `zmq_sub_msg_source` | PUB/SUB | Receive |
| `zmq_push_msg_sink` | PUSH/PULL | Send |
| `zmq_pull_msg_source` | PUSH/PULL | Receive |

### 6.2 Configuration

```python
from gnuradio import zeromq

# PUB/SUB stream pattern
pub_sink = zeromq.pub_sink(
    gr.sizeof_gr_complex,  # item size
    1,                      # vector length
    "tcp://*:5555",         # address (bind)
    100,                    # timeout (ms)
    True,                   # pass_tags
    65536                   # hwm (high water mark)
)

sub_source = zeromq.sub_source(
    gr.sizeof_gr_complex,
    1,
    "tcp://localhost:5555",  # address (connect)
    100,
    True,
    65536
)
```

### 6.3 ZMQ → NATS Bridge Process

Python implementation for bridging GNU Radio ZMQ output to NATS:

```python
#!/usr/bin/env python3
"""Bridge GNU Radio ZMQ PUB output to NATS."""

import asyncio
import struct
import json
import time
import numpy as np
import zmq
import zmq.asyncio
import nats

async def zmq_to_nats_bridge(
    zmq_addr: str = "tcp://localhost:5555",
    nats_url: str = "nats://localhost:4222",
    nats_subject: str = "tsingou.signal.sdr.fft.gnuradio0",
    item_size: int = 8,  # sizeof(gr_complex) = 8 bytes
    fft_size: int = 1024,
):
    """Bridge ZMQ PUB → NATS publish."""

    # Connect to ZMQ publisher
    ctx = zmq.asyncio.Context()
    sub = ctx.socket(zmq.SUB)
    sub.connect(zmq_addr)
    sub.setsockopt(zmq.SUBSCRIBE, b"")  # Subscribe to all
    sub.setsockopt(zmq.RCVHWM, 100)

    # Connect to NATS
    nc = await nats.connect(nats_url)

    print(f"Bridge: ZMQ({zmq_addr}) → NATS({nats_subject})")

    seq = 0
    while True:
        # Receive ZMQ frame (raw complex samples)
        raw = await sub.recv()

        # Interpret as complex64 array
        samples = np.frombuffer(raw, dtype=np.complex64)

        # Compute FFT magnitude (dBFS)
        if len(samples) >= fft_size:
            window = np.hanning(fft_size)
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

    await nc.close()
    sub.close()
    ctx.term()

if __name__ == "__main__":
    asyncio.run(zmq_to_nats_bridge())
```

Rust implementation (higher performance):

```rust
// Cargo.toml dependencies:
// zmq = "0.10"
// async-nats = "0.35"
// serde_json = "1"
// rustfft = "6"
// tokio = { version = "1", features = ["full"] }

use async_nats;
use rustfft::{FftPlanner, num_complex::Complex32};
use std::f32::consts::PI;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let zmq_ctx = zmq::Context::new();
    let sub = zmq_ctx.socket(zmq::SUB)?;
    sub.connect("tcp://localhost:5555")?;
    sub.set_subscribe(b"")?;

    let nc = async_nats::connect("nats://localhost:4222").await?;

    let fft_size = 1024;
    let mut planner = FftPlanner::new();
    let fft = planner.plan_fft_forward(fft_size);
    let mut buffer = vec![Complex32::new(0.0, 0.0); fft_size];

    // Hann window
    let window: Vec<f32> = (0..fft_size)
        .map(|i| 0.5 * (1.0 - (2.0 * PI * i as f32 / fft_size as f32).cos()))
        .collect();

    let mut seq: u64 = 0;
    loop {
        let raw = sub.recv_bytes(0)?;
        let samples: &[Complex32] = bytemuck::cast_slice(&raw);

        if samples.len() >= fft_size {
            // Apply window and copy to buffer
            for i in 0..fft_size {
                buffer[i] = samples[i] * Complex32::new(window[i], 0.0);
            }

            fft.process(&mut buffer);

            // FFT shift and magnitude (dBFS)
            let half = fft_size / 2;
            let magnitudes: Vec<f32> = (0..fft_size)
                .map(|i| {
                    let idx = (i + half) % fft_size;
                    20.0 * buffer[idx].norm().max(1e-12).log10()
                })
                .collect();

            let msg = serde_json::json!({
                "type": "fft",
                "magnitudes": magnitudes,
                "fftSize": fft_size,
                "timestamp": std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap().as_secs_f64(),
                "seq": seq,
            });

            nc.publish(
                "tsingou.signal.sdr.fft.gnuradio0",
                msg.to_string().into(),
            ).await?;
            seq += 1;
        }
    }
}
```

---

## 7. Custom NATS Sink Block — gr-nats OOT Module

### 7.1 Design

Two blocks in the `gr-nats` OOT module:

1. **nats_pub_sink** — Stream block: receives continuous samples, publishes to NATS as JSON (FFT) or binary (IQ)
2. **nats_pub_msg_sink** — Message block: receives PMT messages, publishes to NATS as JSON

### 7.2 nats_pub_sink Implementation

```python
#!/usr/bin/env python3
"""NATS publish sink for GNU Radio — stream data to NATS."""

import asyncio
import json
import time
import threading
import numpy as np
from gnuradio import gr
import pmt

class nats_pub_sink(gr.sync_block):
    """Publishes stream data to NATS as JSON or binary messages."""

    def __init__(
        self,
        nats_url="nats://localhost:4222",
        subject="tsingou.signal.sdr.fft.device0",
        output_format="fft_json",  # "fft_json", "iq_binary", "iq_json"
        fft_size=1024,
        window="hann",
        fft_averaging=1,
        batch_size=1,
    ):
        gr.sync_block.__init__(
            self,
            name='nats_pub_sink',
            in_sig=[np.complex64],
            out_sig=[]  # Sink — no output
        )

        self.nats_url = nats_url
        self.subject = subject
        self.output_format = output_format
        self.fft_size = fft_size
        self.window_name = window
        self.fft_averaging = fft_averaging
        self.batch_size = batch_size

        # Create FFT window
        self.window = self._make_window(window, fft_size)

        # Averaging buffer
        self.avg_buffer = np.zeros(fft_size, dtype=np.float64)
        self.avg_count = 0

        # NATS connection (async, run in background thread)
        self._nc = None
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()

        # Connect to NATS
        future = asyncio.run_coroutine_threadsafe(
            self._connect(), self._loop
        )
        future.result(timeout=5.0)

        self._seq = 0
        self._center_freq = 0.0
        self._sample_rate = 0.0

    def _run_loop(self):
        asyncio.set_event_loop(self._loop)
        self._loop.run_forever()

    async def _connect(self):
        import nats as nats_lib
        self._nc = await nats_lib.connect(self.nats_url)

    async def _publish(self, subject, data):
        if self._nc and self._nc.is_connected:
            await self._nc.publish(subject, data)

    def _make_window(self, name, size):
        windows = {
            "rectangular": np.ones(size),
            "hann": np.hanning(size),
            "hamming": np.hamming(size),
            "blackman": np.blackman(size),
            "blackman_harris": self._blackman_harris(size),
            "kaiser": np.kaiser(size, 8.6),
            "flat_top": self._flat_top(size),
        }
        return windows.get(name, np.hanning(size))

    @staticmethod
    def _blackman_harris(N):
        a0, a1, a2, a3 = 0.35875, 0.48829, 0.14128, 0.01168
        n = np.arange(N)
        return (a0 - a1*np.cos(2*np.pi*n/(N-1))
                + a2*np.cos(4*np.pi*n/(N-1))
                - a3*np.cos(6*np.pi*n/(N-1)))

    @staticmethod
    def _flat_top(N):
        a0, a1, a2, a3, a4 = 0.21557895, 0.41663158, 0.277263158, 0.083578947, 0.006947368
        n = np.arange(N)
        return (a0 - a1*np.cos(2*np.pi*n/(N-1))
                + a2*np.cos(4*np.pi*n/(N-1))
                - a3*np.cos(6*np.pi*n/(N-1))
                + a4*np.cos(8*np.pi*n/(N-1)))

    def work(self, input_items, output_items):
        samples = input_items[0]

        # Check for frequency/rate tags
        tags = self.get_tags_in_window(0, 0, len(samples))
        for tag in tags:
            key = pmt.to_python(tag.key)
            if key == "rx_freq":
                self._center_freq = pmt.to_python(tag.value)
            elif key == "rx_rate":
                self._sample_rate = pmt.to_python(tag.value)

        if self.output_format == "fft_json":
            self._process_fft(samples)
        elif self.output_format == "iq_binary":
            self._process_iq_binary(samples)
        elif self.output_format == "iq_json":
            self._process_iq_json(samples)

        return len(samples)

    def _process_fft(self, samples):
        """Compute FFT and publish as JSON."""
        offset = 0
        while offset + self.fft_size <= len(samples):
            chunk = samples[offset:offset + self.fft_size]

            # Windowed FFT
            fft_data = np.fft.fftshift(np.fft.fft(chunk * self.window))
            power = np.abs(fft_data) ** 2

            # Accumulate for averaging
            self.avg_buffer += power
            self.avg_count += 1

            if self.avg_count >= self.fft_averaging:
                avg_power = self.avg_buffer / self.avg_count
                magnitudes = 10 * np.log10(avg_power + 1e-12)  # dBFS

                msg = json.dumps({
                    "type": "fft",
                    "magnitudes": magnitudes.tolist(),
                    "centerFrequency": self._center_freq,
                    "bandwidth": self._sample_rate,
                    "fftSize": self.fft_size,
                    "windowFunction": self.window_name,
                    "averageCount": self.fft_averaging,
                    "timestamp": time.time(),
                    "seq": self._seq,
                }).encode()

                asyncio.run_coroutine_threadsafe(
                    self._publish(self.subject, msg),
                    self._loop,
                )
                self._seq += 1

                # Reset averaging
                self.avg_buffer.fill(0)
                self.avg_count = 0

            offset += self.fft_size

    def _process_iq_binary(self, samples):
        """Publish raw IQ as binary with JSON header."""
        header = json.dumps({
            "type": "iq",
            "format": "cf32",
            "centerFrequency": self._center_freq,
            "sampleRate": self._sample_rate,
            "sampleCount": len(samples),
            "timestamp": time.time(),
            "seq": self._seq,
        }).encode()

        # Frame: 4-byte header length + JSON header + binary samples
        header_len = struct.pack("<I", len(header))
        payload = header_len + header + samples.tobytes()

        asyncio.run_coroutine_threadsafe(
            self._publish(self.subject, payload),
            self._loop,
        )
        self._seq += 1

    def _process_iq_json(self, samples):
        """Publish IQ as JSON (lower throughput, easier to parse)."""
        msg = json.dumps({
            "type": "iq",
            "format": "cf32",
            "i": samples.real.tolist(),
            "q": samples.imag.tolist(),
            "centerFrequency": self._center_freq,
            "sampleRate": self._sample_rate,
            "timestamp": time.time(),
            "seq": self._seq,
        }).encode()

        asyncio.run_coroutine_threadsafe(
            self._publish(self.subject, msg),
            self._loop,
        )
        self._seq += 1

    def stop(self):
        """Clean shutdown."""
        if self._nc:
            asyncio.run_coroutine_threadsafe(
                self._nc.close(), self._loop
            ).result(timeout=2.0)
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=2.0)
        return True
```

### 7.3 nats_pub_msg_sink Implementation

```python
class nats_pub_msg_sink(gr.basic_block):
    """Publishes PMT messages to NATS as JSON."""

    def __init__(
        self,
        nats_url="nats://localhost:4222",
        subject="tsingou.signal.sdr.decoded.generic",
    ):
        gr.basic_block.__init__(
            self,
            name='nats_pub_msg_sink',
            in_sig=[],
            out_sig=[]
        )
        self.nats_url = nats_url
        self.subject = subject

        self.message_port_register_in(pmt.intern('in'))
        self.set_msg_handler(pmt.intern('in'), self.handle_msg)

        # NATS connection (same async pattern)
        self._nc = None
        self._loop = asyncio.new_event_loop()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        asyncio.run_coroutine_threadsafe(
            self._connect(), self._loop
        ).result(timeout=5.0)

    # ... _run_loop, _connect, _publish same as above ...

    def handle_msg(self, msg):
        """Convert PMT message to JSON and publish to NATS."""
        py_msg = pmt.to_python(msg)

        payload = json.dumps({
            "type": "decoded",
            "data": py_msg,
            "timestamp": time.time(),
        }).encode()

        asyncio.run_coroutine_threadsafe(
            self._publish(self.subject, payload),
            self._loop,
        )

    def stop(self):
        if self._nc:
            asyncio.run_coroutine_threadsafe(
                self._nc.close(), self._loop
            ).result(timeout=2.0)
        self._loop.call_soon_threadsafe(self._loop.stop)
        self._thread.join(timeout=2.0)
        return True
```

### 7.4 GRC Block Descriptor — nats_pub_sink.block.yml

```yaml
id: nats_nats_pub_sink
label: NATS Publish Sink
category: '[NATS]'
flags: [python]

parameters:
- id: nats_url
  label: NATS URL
  dtype: string
  default: 'nats://localhost:4222'

- id: subject
  label: NATS Subject
  dtype: string
  default: 'tsingou.signal.sdr.fft.device0'

- id: output_format
  label: Output Format
  dtype: enum
  options: ['fft_json', 'iq_binary', 'iq_json']
  option_labels: ['FFT (JSON)', 'IQ (Binary)', 'IQ (JSON)']
  default: 'fft_json'

- id: fft_size
  label: FFT Size
  dtype: int
  default: '1024'
  hide: ${ 'all' if output_format != 'fft_json' else 'none' }

- id: window
  label: Window Function
  dtype: enum
  options: ['hann', 'hamming', 'blackman', 'blackman_harris', 'kaiser', 'flat_top', 'rectangular']
  option_labels: ['Hann', 'Hamming', 'Blackman', 'Blackman-Harris', 'Kaiser', 'Flat-Top', 'Rectangular']
  default: 'hann'
  hide: ${ 'all' if output_format != 'fft_json' else 'none' }

- id: fft_averaging
  label: FFT Averaging
  dtype: int
  default: '1'
  hide: ${ 'all' if output_format != 'fft_json' else 'none' }

inputs:
- label: in
  domain: stream
  dtype: complex

templates:
  imports: from gnuradio import nats as gr_nats
  make: gr_nats.nats_pub_sink(${nats_url}, ${subject}, ${output_format}, ${fft_size}, ${window}, ${fft_averaging})

documentation: |-
  Publishes GNU Radio stream data to NATS for consumption by Tsingou.

  Output Formats:
    fft_json: Computes FFT with windowing and publishes magnitude array as JSON.
    iq_binary: Publishes raw IQ samples as binary with JSON header.
    iq_json: Publishes IQ samples as JSON arrays (lower throughput).

file_format: 1
```

---

## 8. DSP Foundations

### 8.1 FFT (Fast Fourier Transform)

**DFT formula:**
```
X[k] = sum_{n=0}^{N-1} x[n] * e^(-j2pi*k*n/N)    for k = 0, 1, ..., N-1
```

**Inverse DFT:**
```
x[n] = (1/N) * sum_{k=0}^{N-1} X[k] * e^(j2pi*k*n/N)
```

**FFT** is the efficient computation of DFT via the Cooley-Tukey algorithm (divide-and-conquer), reducing complexity from O(N^2) to O(N log N).

**Frequency resolution:**
```
delta_f = sample_rate / fft_size
```

**FFT size trade-off table:**

| FFT Size | Resolution @ 2.4 MSPS | Resolution @ 20 MSPS | Update Rate (50% overlap @ 2.4 MSPS) | Points |
|----------|----------------------|----------------------|--------------------------------------|--------|
| 128 | 18,750 Hz | 156,250 Hz | 37,500 Hz | 128 |
| 256 | 9,375 Hz | 78,125 Hz | 18,750 Hz | 256 |
| 512 | 4,688 Hz | 39,063 Hz | 9,375 Hz | 512 |
| 1024 | 2,344 Hz | 19,531 Hz | 4,688 Hz | 1024 |
| 2048 | 1,172 Hz | 9,766 Hz | 2,344 Hz | 2048 |
| 4096 | 586 Hz | 4,883 Hz | 1,172 Hz | 4096 |
| 8192 | 293 Hz | 2,441 Hz | 586 Hz | 8192 |
| 16384 | 146 Hz | 1,221 Hz | 293 Hz | 16384 |

**Power spectral density:**
```
PSD[k] = |X[k]|^2 / (N * sample_rate)    [W/Hz or V^2/Hz]
```

**dBFS conversion:**
```
dBFS[k] = 20 * log10(|X[k]| / N)         [relative to full scale]
```

Or equivalently with power:
```
dBFS[k] = 10 * log10(|X[k]|^2 / N^2)
```

### 8.2 Windowing Functions

**Why windowing:** The DFT assumes the input signal is periodic with period N. For real-world signals, truncating to N samples causes discontinuities at the edges, producing spectral leakage (energy spreading from a signal's true frequency into adjacent bins). Windowing tapers the edges to reduce leakage.

| Window | Formula | Highest Sidelobe (dB) | 3-dB Mainlobe Width (bins) | Sidelobe Decay (dB/oct) | Coherent Gain |
|--------|---------|-----------------------|---------------------------|------------------------|---------------|
| Rectangular | w[n] = 1 | -13.3 | 0.89 | 6 | 1.000 |
| Hann | 0.5 - 0.5*cos(2*pi*n/(N-1)) | -31.5 | 1.44 | 18 | 0.500 |
| Hamming | 0.54 - 0.46*cos(2*pi*n/(N-1)) | -42.7 | 1.30 | 6 | 0.540 |
| Blackman | 0.42 - 0.50*cos(2*pi*n/(N-1)) + 0.08*cos(4*pi*n/(N-1)) | -58.1 | 1.68 | 18 | 0.420 |
| Blackman-Harris (4-term) | a0 - a1*cos + a2*cos(2x) - a3*cos(3x) | -92.0 | 1.90 | 6 | 0.359 |
| Kaiser (beta=8.6) | I0(beta*sqrt(1-(2n/(N-1)-1)^2)) / I0(beta) | -90.0 | ~1.8 | — | ~0.36 |
| Flat-Top (5-term) | a0 - a1*cos + a2*cos(2x) - a3*cos(3x) + a4*cos(4x) | -93.6 | 3.72 | 11 | 0.216 |

Blackman-Harris coefficients: a0=0.35875, a1=0.48829, a2=0.14128, a3=0.01168

Flat-Top coefficients: a0=0.21557895, a1=0.41663158, a2=0.277263158, a3=0.083578947, a4=0.006947368

**Selection guide:**
```
What matters most?
├─ Frequency resolution ──► Rectangular (narrowest mainlobe, worst leakage)
├─ General purpose ────────► Hann (good balance)
├─ Two close signals ──────► Hamming (moderate leakage, narrow mainlobe)
├─ Weak signals near strong ► Blackman-Harris (very low sidelobes)
├─ Amplitude accuracy ─────► Flat-Top (best amplitude, worst resolution)
└─ Tunable trade-off ──────► Kaiser (adjust beta for sidelobe/mainlobe trade)
```

### 8.3 Demodulation

#### AM Demodulation

**Envelope detection (standard AM):**
```
output[n] = |z[n]| = sqrt(I[n]^2 + Q[n]^2)
```

Where z[n] = I[n] + jQ[n] is the complex baseband sample.

DC removal (for AM-SC: suppressed carrier):
```
output[n] = |z[n]| - mean(|z[n]|)
```

#### FM Demodulation (Quadrature Discriminator)

The instantaneous frequency is the rate of change of phase:
```
phi[n] = atan2(Q[n], I[n])
freq[n] = (phi[n] - phi[n-1]) / (2*pi) * sample_rate
```

More efficient computation using the conjugate product:
```
diff[n] = z[n] * conj(z[n-1])
output[n] = atan2(imag(diff[n]), real(diff[n]))
```

The output is proportional to instantaneous frequency deviation.

GNU Radio gain parameter:
```
gain = sample_rate / (2 * pi * max_deviation)
```

For WBFM (75 kHz deviation): `gain = 240000 / (2*pi*75000) = 0.509`
For NBFM (5 kHz deviation): `gain = 48000 / (2*pi*5000) = 1.528`

**WBFM stereo multiplex:**
```
Baseband:
  0-15 kHz   : L+R mono audio
  19 kHz     : Pilot tone (stereo indicator)
  23-53 kHz  : L-R stereo difference (DSB-SC on 38 kHz subcarrier)
  57 kHz     : RDS/RBDS data subcarrier (1187.5 bps)

Recovery:
  L = (L+R + L-R) / 2
  R = (L+R - L-R) / 2
```

**De-emphasis filter:**
```
H(s) = 1 / (1 + s*tau)
```
Where tau = 75 microseconds (North America, South Korea) or 50 microseconds (Europe, Japan, Australia).

#### SSB Demodulation

**Phasing method:**
```
USB = I + Hilbert(Q)    # Upper sideband
LSB = I - Hilbert(Q)    # Lower sideband
```

**Weaver method** (two-stage complex mixing): more practical for SDR:
1. Mix signal to place desired sideband centered at DC
2. Low-pass filter to select desired sideband
3. Mix back to audio frequency

#### Digital Demodulation

| Modulation | Bits/Symbol | Constellation Points | Decision Method |
|------------|-------------|---------------------|-----------------|
| BPSK | 1 | 2 (on real axis) | sign(I) |
| QPSK | 2 | 4 (on unit circle, 45/135/225/315 deg) | quadrant |
| 8PSK | 3 | 8 (on unit circle, 45 deg spacing) | nearest point |
| 16QAM | 4 | 16 (4x4 grid) | nearest point |
| 64QAM | 6 | 64 (8x8 grid) | nearest point |
| 256QAM | 8 | 256 (16x16 grid) | nearest point |
| GMSK | 1 | N/A (continuous phase) | Viterbi/Laurent decomposition |

### 8.4 Filtering

#### FIR Filter

```
y[n] = sum_{k=0}^{M} h[k] * x[n-k]
```

Where h[k] are the filter taps (impulse response), M is the filter order.

**GNU Radio FIR design:**
```python
from gnuradio.filter import firdes

# Low-pass: passes below cutoff
taps = firdes.low_pass(
    1.0,        # gain
    2400000,    # sample_rate
    100000,     # cutoff_freq
    10000,      # transition_width
    firdes.WIN_HAMMING  # window
)

# Band-pass: passes between low_cutoff and high_cutoff
taps = firdes.band_pass(
    1.0,        # gain
    2400000,    # sample_rate
    100000,     # low_cutoff
    200000,     # high_cutoff
    10000,      # transition_width
    firdes.WIN_HAMMING
)

# High-pass: passes above cutoff
taps = firdes.high_pass(
    1.0,
    2400000,
    100000,
    10000,
    firdes.WIN_HAMMING
)
```

#### IIR Filter

```
y[n] = sum_{k=0}^{M} b[k]*x[n-k] - sum_{k=1}^{N} a[k]*y[n-k]
```

Standard IIR types:

| Type | Passband | Stopband | Phase | Order |
|------|----------|----------|-------|-------|
| Butterworth | Maximally flat | Moderate roll-off | Non-linear | Higher |
| Chebyshev Type I | Ripple | Steep roll-off | Non-linear | Lower |
| Chebyshev Type II | Flat | Ripple, steep | Non-linear | Lower |
| Elliptic (Cauer) | Ripple | Ripple, steepest | Non-linear | Lowest |
| Bessel | Flat | Gentle roll-off | Nearly linear | Highest |

#### Frequency Xlating FIR Filter

The most important block for SDR channelization. Combines:
1. Frequency translation (mix signal to baseband)
2. Low-pass filtering (select channel)
3. Decimation (reduce sample rate)

In a single, computationally efficient operation:

```python
from gnuradio import filter as grfilter

xlating_fir = grfilter.freq_xlating_fir_filter_ccc(
    decimation,     # decimation factor
    taps,           # FIR filter taps
    center_freq,    # frequency to translate to DC
    sample_rate     # input sample rate
)
```

This is equivalent to:
```
1. Multiply input by e^(-j*2*pi*center_freq*n/sample_rate)  (shift channel to DC)
2. Apply FIR filter (select channel, remove others)
3. Decimate by factor (reduce sample rate)
```

But 3-5x more efficient than doing these as separate blocks.

#### Polyphase Filter Banks

Efficient multi-rate processing by decomposing a filter into sub-filters:

```
Original FIR: h[0], h[1], h[2], ..., h[L*M-1]

Polyphase decomposition (L phases):
  Phase 0: h[0], h[L], h[2L], ...
  Phase 1: h[1], h[L+1], h[2L+1], ...
  Phase 2: h[2], h[L+2], h[2L+2], ...
  ...
  Phase L-1: h[L-1], h[2L-1], h[3L-1], ...
```

Each sub-filter operates at the decimated rate (1/L of original), reducing total computation by factor L.

GNU Radio polyphase channelizer:
```python
pfb = filter.pfb_channelizer_ccf(
    num_channels,   # number of output channels
    taps,           # prototype low-pass filter taps
    oversample_rate # 1.0 for critically sampled, 2.0 for oversampled
)
```

This splits a wideband input into N narrowband channels simultaneously — essential for multi-protocol SDR monitoring.

---

## 9. Citations

| Key | Reference |
|-----|-----------|
| [GNURADIO] | GNU Radio Project, https://www.gnuradio.org/ |
| [GNURADIO4] | GNU Radio 4.0 Development, https://github.com/gnuradio/gnuradio4 |
| [ZMQ] | ZeroMQ, https://zeromq.org/ |
| [OPPENHEIM] | Oppenheim & Schafer, "Discrete-Time Signal Processing", 3rd ed., Pearson, 2010 |
| [HARRIS] | Harris, "Multirate Signal Processing for Communication Systems", 2nd ed., 2021 |
| [FFTW] | FFTW Library, https://www.fftw.org/ |
| [RUSTFFT] | rustfft crate, https://crates.io/crates/rustfft |
| [NATS] | NATS Messaging, https://nats.io/ |
| [NATSPY] | nats.py Python client, https://github.com/nats-io/nats.py |
| [ASYNCNATS] | async-nats Rust client, https://github.com/nats-io/nats.rs |
| [PYBIND11] | pybind11 C++ bindings, https://pybind11.readthedocs.io/ |
| [GRMODTOOL] | gr_modtool documentation, https://wiki.gnuradio.org/index.php/OutOfTreeModules |
