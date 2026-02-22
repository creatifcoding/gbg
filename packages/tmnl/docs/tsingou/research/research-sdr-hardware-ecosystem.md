# Research: SDR Hardware Ecosystem

```
Research File:   SDR Hardware Ecosystem
Target Sections: TSG.16 (SDR Hardware Landscape), TSG.18 (SigMF Codec)
Author:          Val (sdr-analyst)
Created:         2026-02-18
Sources:         [RTLSDR], [HACKRF], [UHD], [SOAPYSDR], [SIGMF], vendor datasheets
```

---

## 1. RTL-SDR v4

### 1.1 Hardware Architecture

The RTL-SDR v4 is a USB DVB-T dongle repurposed for general-purpose SDR reception. It uses a two-chip architecture:

- **Tuner**: Rafael Micro R828D — wideband silicon tuner
  - Frequency range: 24 MHz to 1766 MHz
  - Intermediate frequency (IF) output to ADC
  - Integrated LNA with programmable gain stages
  - PLL synthesizer for local oscillator
  - V4 improvement: built-in upconverter for HF reception (direct sampling mode)
- **Demodulator/ADC**: Realtek RTL2832U — DVB-T demodulator IC
  - 8-bit ADC (unsigned)
  - USB 2.0 High Speed interface (480 Mbps theoretical, ~36 MB/s practical)
  - Maximum sample rate: 3.2 MSPS (unstable), 2.56 MSPS (max stable), 2.4 MSPS (recommended)
  - IQ output mode: interleaved I,Q unsigned 8-bit (CU8 format)

Block diagram:

```
Antenna → R828D Tuner → RTL2832U ADC → USB 2.0 → Host
  │         │              │
  │    ┌────┴────┐    ┌────┴────┐
  │    │ LNA     │    │ 8-bit   │
  │    │ Mixer   │    │ ADC     │
  │    │ IF Filt │    │ USB PHY │
  │    │ PLL     │    │ I2C Ctl │
  │    └─────────┘    └─────────┘
```

### 1.2 V4 Improvements Over V3

| Feature | V3 | V4 |
|---------|----|----|
| Tuner | R820T2 | R828D |
| HF reception | Requires external upconverter | Built-in (direct sampling) |
| Bias-tee | External mod required | Built-in (4.5V via software toggle) |
| Thermal | Prone to drift | Improved TCXO (0.5 PPM) |
| Case | Plastic | Metal (heat dissipation, shielding) |
| ESD | Minimal | ESD protection on antenna input |

### 1.3 librtlsdr API — Complete Function Reference

Source: https://github.com/steve-m/librtlsdr

#### Device Discovery & Lifecycle

| Function | Signature | Description |
|----------|-----------|-------------|
| `rtlsdr_get_device_count` | `uint32_t rtlsdr_get_device_count(void)` | Returns number of RTL-SDR devices attached to the system. |
| `rtlsdr_get_device_name` | `const char* rtlsdr_get_device_name(uint32_t index)` | Returns device name string for the given index (e.g., "Generic RTL2832U OEM"). |
| `rtlsdr_get_device_usb_strings` | `int rtlsdr_get_device_usb_strings(uint32_t index, char *manufact, char *product, char *serial)` | Retrieves USB descriptor strings. Serial is useful for persistent device identification. |
| `rtlsdr_get_index_by_serial` | `int rtlsdr_get_index_by_serial(const char *serial)` | Returns device index for a given serial number. Returns -1 for not found, -2 for non-unique, -3 for not available. |
| `rtlsdr_open` | `int rtlsdr_open(rtlsdr_dev_t **dev, uint32_t index)` | Opens the device at the given index. Returns 0 on success. Only one process can open a device at a time. |
| `rtlsdr_close` | `int rtlsdr_close(rtlsdr_dev_t *dev)` | Closes the device and releases resources. Returns 0 on success. |

#### Frequency Control

| Function | Signature | Description |
|----------|-----------|-------------|
| `rtlsdr_set_center_freq` | `int rtlsdr_set_center_freq(rtlsdr_dev_t *dev, uint32_t freq)` | Sets center frequency in Hz. PLL lock time is ~5-10 ms. Returns 0 on success, negative on error. |
| `rtlsdr_get_center_freq` | `uint32_t rtlsdr_get_center_freq(rtlsdr_dev_t *dev)` | Returns current center frequency in Hz. Returns 0 on error. |
| `rtlsdr_set_freq_correction` | `int rtlsdr_set_freq_correction(rtlsdr_dev_t *dev, int ppm)` | Sets frequency correction in PPM. Typical RTL-SDR drift: 1-60 PPM. V4 TCXO: <0.5 PPM. |
| `rtlsdr_get_freq_correction` | `int rtlsdr_get_freq_correction(rtlsdr_dev_t *dev)` | Returns current PPM correction value. |

#### Sample Rate Control

| Function | Signature | Description |
|----------|-----------|-------------|
| `rtlsdr_set_sample_rate` | `int rtlsdr_set_sample_rate(rtlsdr_dev_t *dev, uint32_t rate)` | Sets sample rate in Hz. Valid range: 225001-3200000 Hz. Recommended: 2400000 Hz. |
| `rtlsdr_get_sample_rate` | `uint32_t rtlsdr_get_sample_rate(rtlsdr_dev_t *dev)` | Returns configured sample rate in Hz. |

#### Gain Control

| Function | Signature | Description |
|----------|-----------|-------------|
| `rtlsdr_set_tuner_gain_mode` | `int rtlsdr_set_tuner_gain_mode(rtlsdr_dev_t *dev, int manual)` | 0 = automatic gain, 1 = manual gain. Default is automatic. |
| `rtlsdr_get_tuner_gains` | `int rtlsdr_get_tuner_gains(rtlsdr_dev_t *dev, int *gains)` | Returns available gain values in tenths of dB. Pass NULL to get count, then allocate and call again. Typical R828D: 29 gain steps from 0 to 496 (0.0 to 49.6 dB). |
| `rtlsdr_set_tuner_gain` | `int rtlsdr_set_tuner_gain(rtlsdr_dev_t *dev, int gain)` | Sets gain in tenths of dB. Value must match one returned by `rtlsdr_get_tuner_gains`. |
| `rtlsdr_get_tuner_gain` | `int rtlsdr_get_tuner_gain(rtlsdr_dev_t *dev)` | Returns current gain in tenths of dB. |
| `rtlsdr_set_agc_mode` | `int rtlsdr_set_agc_mode(rtlsdr_dev_t *dev, int on)` | Enables/disables RTL2832U internal AGC. Separate from tuner AGC. |
| `rtlsdr_set_tuner_bandwidth` | `int rtlsdr_set_tuner_bandwidth(rtlsdr_dev_t *dev, uint32_t bw)` | Sets tuner IF bandwidth in Hz. 0 = automatic. |

#### Direct Sampling (HF)

| Function | Signature | Description |
|----------|-----------|-------------|
| `rtlsdr_set_direct_sampling` | `int rtlsdr_set_direct_sampling(rtlsdr_dev_t *dev, int on)` | 0 = disabled, 1 = I-ADC input, 2 = Q-ADC input. For V4 HF reception. |
| `rtlsdr_get_direct_sampling` | `int rtlsdr_get_direct_sampling(rtlsdr_dev_t *dev)` | Returns current direct sampling state. |

#### Bias-Tee (V4)

| Function | Signature | Description |
|----------|-----------|-------------|
| `rtlsdr_set_bias_tee` | `int rtlsdr_set_bias_tee(rtlsdr_dev_t *dev, int on)` | Enable/disable 4.5V bias-tee on antenna connector. Powers external LNAs and active antennas. |
| `rtlsdr_set_bias_tee_gpio` | `int rtlsdr_set_bias_tee_gpio(rtlsdr_dev_t *dev, int gpio, int on)` | Control bias-tee via specific GPIO pin. |

#### Sample Reading

| Function | Signature | Description |
|----------|-----------|-------------|
| `rtlsdr_reset_buffer` | `int rtlsdr_reset_buffer(rtlsdr_dev_t *dev)` | Resets the internal buffer. Call before starting to read. |
| `rtlsdr_read_sync` | `int rtlsdr_read_sync(rtlsdr_dev_t *dev, void *buf, int len, int *n_read)` | Synchronous read. Blocks until `len` bytes are available. `buf` receives interleaved IQ CU8 samples. |
| `rtlsdr_read_async` | `int rtlsdr_read_async(rtlsdr_dev_t *dev, rtlsdr_read_async_cb_t cb, void *ctx, uint32_t buf_num, uint32_t buf_len)` | Asynchronous read. Calls `cb(buf, len, ctx)` with filled buffers. `buf_num` = number of ring buffers (default 15), `buf_len` = buffer length in bytes (default 16384 * 32 = 524288). |
| `rtlsdr_cancel_async` | `int rtlsdr_cancel_async(rtlsdr_dev_t *dev)` | Cancels pending async read. Sets internal flag; callback returns naturally. |

### 1.4 Python Wrapper — pyrtlsdr

```python
from rtlsdr import RtlSdr

sdr = RtlSdr()
sdr.sample_rate = 2.4e6     # 2.4 MSPS
sdr.center_freq = 433.92e6  # 433.92 MHz
sdr.gain = 'auto'           # or integer in dB

# Read samples (returns numpy complex64 array)
samples = sdr.read_samples(256*1024)  # ~107 ms of data

# Async read
async for samples in sdr.stream():
    process(samples)

sdr.close()
```

### 1.5 Sample Rate Stability Analysis

| Rate (MSPS) | Stability | Notes |
|-------------|-----------|-------|
| 0.225-1.0 | Excellent | Low CPU, minimal drops |
| 1.0-2.0 | Good | Standard operation |
| 2.4 | Good | Most common setting, well-tested |
| 2.56 | Fair | Maximum stable for most systems |
| 2.8 | Poor | USB frame timing issues begin |
| 3.0 | Poor | Frequent drops on USB 2.0 hubs |
| 3.2 | Unstable | Theoretical max, not recommended |

Factors affecting stability:
- USB host controller quality (Intel > Renesas > VIA)
- USB hub topology (direct connection preferred)
- CPU load (async read requires callback processing time < buffer fill time)
- Thermal (crystal drift under sustained load)

### 1.6 Known Quirks

1. **DC spike**: RTL2832U produces a spike at center frequency due to ADC DC offset. Mitigation: offset tune by ~bandwidth/4 and digitally shift, or use wideband mode and ignore center bin.
2. **Thermal drift**: Crystal frequency drifts with temperature. V4 TCXO improves this to <0.5 PPM. V3 may drift 10-50 PPM. Mitigation: software PPM correction, recalibrate periodically.
3. **USB buffer drops**: At high sample rates, USB 2.0 frame timing can cause dropped samples. Mitigation: reduce sample rate, use USB 3.0 port (backward compatible), increase ring buffer count.
4. **Intermodulation**: Strong nearby transmitters cause spurious signals. Mitigation: bandpass filters before antenna input, reduce gain.
5. **Bias-tee current limit**: V4 bias-tee supplies ~180 mA at 4.5V. Not enough for some active antennas (check current draw). External power inserter needed for higher current devices.

### 1.7 Optimal Settings Per Protocol

| Protocol | Center Freq | Sample Rate | Gain | Notes |
|----------|------------|-------------|------|-------|
| ADS-B (1090 MHz) | 1090 MHz | 2.4 MSPS | Max | dump1090 expects 2 MSPS minimum |
| FM Broadcast | 88-108 MHz | 2.4 MSPS | Auto | Decimation to 250 kHz for mono |
| POCSAG | varies | 2.4 MSPS | 40 dB | 25 kHz channel, multimon-ng |
| AIS (161.975/162.025) | 162.0 MHz | 2.4 MSPS | Auto | Captures both channels |
| ISM (433 MHz) | 433.92 MHz | 1.0 MSPS | Auto | rtl_433 recommended |
| NOAA APT (137 MHz) | 137.x MHz | 2.4 MSPS | Auto | ~40 kHz bandwidth signal |
| P25 | varies | 2.4 MSPS | 40 dB | 12.5 kHz channel |
| DMR | varies | 2.4 MSPS | 40 dB | 12.5 kHz channel |
| ACARS (VHF) | 131.55 MHz | 2.4 MSPS | Auto | Multiple frequencies |

---

## 2. HackRF One

### 2.1 Hardware Architecture

The HackRF One is a wideband SDR transceiver designed by Great Scott Gadgets (Michael Ossmann). Five-chip architecture:

- **Transceiver**: Maxim MAX2839 — 2.3-2.7 GHz wideband transceiver
  - Used as IF stage, not directly on RF
  - Provides baseband filtering and gain
- **ADC/DAC**: Maxim MAX5864 — 22 MSPS 8-bit ADC + 8-bit DAC
  - Simultaneous ADC and DAC channels
  - Interleaved IQ output (CS8 format: signed 8-bit)
- **Synthesizer**: RFFC5072 — wideband VCO + PLL
  - 85 MHz to 4200 MHz in a single sweep
  - Provides LO for mixer stages
  - Combined with MAX2837 for full frequency coverage
- **MCU**: NXP LPC4320 — ARM Cortex-M4 + Cortex-M0 dual-core
  - USB 2.0 High Speed device
  - Controls all RF chips via SPI
  - Firmware: hackrf-firmware (open source)
- **CPLD**: Xilinx XC2C64A — CoolRunner-II
  - Glue logic between ADC/DAC and MCU
  - Clock domain crossing
  - Sample routing (RX/TX mux)

Block diagram:

```
                         RFFC5072
                        Synthesizer
                            │ LO
Antenna ──► LNA ──► Mixer ──┤
                            │
                        MAX2839
                       Transceiver
                            │ BB
                        MAX5864
                        ADC/DAC
                            │
                          CPLD
                        XC2C64A
                            │
                         LPC4320
                        Cortex-M4
                            │
                          USB 2.0
                            │
                          Host
```

### 2.2 Key Specifications

| Parameter | Value |
|-----------|-------|
| Frequency range | 1 MHz — 6 GHz |
| Sample rates | 2-20 MSPS (8, 10, 12.5, 16, 20 MHz recommended) |
| ADC/DAC resolution | 8-bit signed (CS8) |
| Duplex | Half-duplex (TX or RX, not simultaneous) |
| Bandwidth | Up to 20 MHz instantaneous |
| Interface | USB 2.0 High Speed |
| Power | ~300-500 mA from USB |
| RF amp | 14 dB (switchable) |
| LNA gain | 0-40 dB in 8 dB steps |
| VGA gain | 0-62 dB in 2 dB steps |
| TX VGA gain | 0-47 dB in 1 dB steps |
| Clock | 10 MHz TCXO, external clock input/output |
| Size | 120 x 75 x 17 mm |

### 2.3 libhackrf API — Complete Function Reference

Source: https://github.com/greatscottgadgets/hackrf

#### Library Lifecycle

| Function | Signature | Description |
|----------|-----------|-------------|
| `hackrf_init` | `int hackrf_init(void)` | Initialize libhackrf. Must be called before any other function. Returns HACKRF_SUCCESS on success. |
| `hackrf_exit` | `int hackrf_exit(void)` | Deinitialize libhackrf. Releases all libusb resources. Call after closing all devices. |

#### Device Lifecycle

| Function | Signature | Description |
|----------|-----------|-------------|
| `hackrf_device_list` | `hackrf_device_list_t* hackrf_device_list(void)` | Returns list of attached HackRF devices with serial numbers. |
| `hackrf_device_list_free` | `void hackrf_device_list_free(hackrf_device_list_t *list)` | Frees device list. |
| `hackrf_open` | `int hackrf_open(hackrf_device** device)` | Opens first available HackRF device. |
| `hackrf_open_by_serial` | `int hackrf_open_by_serial(const char* serial, hackrf_device** device)` | Opens specific device by serial number string. |
| `hackrf_close` | `int hackrf_close(hackrf_device* device)` | Closes device and releases USB handle. |

#### Frequency & Sample Rate

| Function | Signature | Description |
|----------|-----------|-------------|
| `hackrf_set_freq` | `int hackrf_set_freq(hackrf_device* device, const uint64_t freq_hz)` | Sets center frequency in Hz. Full range: 1 MHz — 6 GHz. |
| `hackrf_set_freq_explicit` | `int hackrf_set_freq_explicit(hackrf_device* device, const uint64_t if_freq_hz, const uint64_t lo_freq_hz, const enum rf_path_filter path)` | Sets IF and LO frequencies explicitly. Advanced tuning for avoiding spurs. |
| `hackrf_set_sample_rate` | `int hackrf_set_sample_rate(hackrf_device* device, const double freq_hz)` | Sets sample rate. Automatically sets baseband filter to 0.75 * sample_rate. |
| `hackrf_set_sample_rate_manual` | `int hackrf_set_sample_rate_manual(hackrf_device* device, const uint32_t freq_hz, const uint32_t divider)` | Sets sample rate with explicit clock divider. |

#### Baseband Filter

| Function | Signature | Description |
|----------|-----------|-------------|
| `hackrf_set_baseband_filter_bandwidth` | `int hackrf_set_baseband_filter_bandwidth(hackrf_device* device, const uint32_t bandwidth_hz)` | Sets analog baseband filter bandwidth in Hz. |
| `hackrf_compute_baseband_filter_bw_round_down_lt` | `uint32_t hackrf_compute_baseband_filter_bw_round_down_lt(const uint32_t bandwidth_hz)` | Computes nearest valid filter bandwidth below requested value. Valid values: 1.75, 2.5, 3.5, 5, 5.5, 6, 7, 8, 9, 10, 12, 14, 15, 20, 24, 28 MHz. |
| `hackrf_compute_baseband_filter_bw` | `uint32_t hackrf_compute_baseband_filter_bw(const uint32_t bandwidth_hz)` | Computes nearest valid filter bandwidth (rounded). |

#### Gain Control

| Function | Signature | Description |
|----------|-----------|-------------|
| `hackrf_set_lna_gain` | `int hackrf_set_lna_gain(hackrf_device* device, uint32_t value)` | Sets LNA gain: 0-40 dB in 8 dB steps (0, 8, 16, 24, 32, 40). |
| `hackrf_set_vga_gain` | `int hackrf_set_vga_gain(hackrf_device* device, uint32_t value)` | Sets RX VGA gain: 0-62 dB in 2 dB steps. |
| `hackrf_set_txvga_gain` | `int hackrf_set_txvga_gain(hackrf_device* device, uint32_t value)` | Sets TX VGA gain: 0-47 dB in 1 dB steps. |
| `hackrf_set_amp_enable` | `int hackrf_set_amp_enable(hackrf_device* device, const uint8_t value)` | Enable/disable 14 dB RF amplifier (0 = off, 1 = on). Caution: can damage with strong signals. |

#### RX/TX Control

| Function | Signature | Description |
|----------|-----------|-------------|
| `hackrf_start_rx` | `int hackrf_start_rx(hackrf_device* device, hackrf_sample_block_cb_fn callback, void* rx_ctx)` | Start receiving. Callback receives buffers of CS8 samples. |
| `hackrf_stop_rx` | `int hackrf_stop_rx(hackrf_device* device)` | Stop receiving. |
| `hackrf_start_tx` | `int hackrf_start_tx(hackrf_device* device, hackrf_sample_block_cb_fn callback, void* tx_ctx)` | Start transmitting. Callback fills buffers with CS8 samples. |
| `hackrf_stop_tx` | `int hackrf_stop_tx(hackrf_device* device)` | Stop transmitting. |
| `hackrf_is_streaming` | `int hackrf_is_streaming(hackrf_device* device)` | Returns HACKRF_TRUE if currently streaming (RX or TX). |

#### Sweep Mode

| Function | Signature | Description |
|----------|-----------|-------------|
| `hackrf_init_sweep` | `int hackrf_init_sweep(hackrf_device* device, const uint16_t* frequency_list, const int num_ranges, const uint32_t num_bytes, const uint32_t step_width, const uint32_t offset, const enum sweep_style style)` | Initialize sweep mode. `frequency_list` = pairs of (start, stop) in MHz. `step_width` = Hz per step. `style` = LINEAR or INTERLEAVED. |
| `hackrf_start_rx_sweep` | `int hackrf_start_rx_sweep(hackrf_device* device, hackrf_sample_block_cb_fn callback, void* rx_ctx)` | Start sweep reception. Each callback buffer contains header with frequency info. |

hackrf_sweep performance: ~8 GHz/second sweep rate (1 MHz — 6 GHz in ~625 ms).

#### Device Info

| Function | Signature | Description |
|----------|-----------|-------------|
| `hackrf_board_id_read` | `int hackrf_board_id_read(hackrf_device* device, uint8_t* value)` | Reads board ID (BOARD_ID_HACKRF_ONE = 2). |
| `hackrf_version_string_read` | `int hackrf_version_string_read(hackrf_device* device, char* version, uint8_t length)` | Reads firmware version string. |
| `hackrf_board_partid_serialno_read` | `int hackrf_board_partid_serialno_read(hackrf_device* device, read_partid_serialno_t* read_partid_serialno)` | Reads part ID and serial number. |
| `hackrf_set_hw_sync_mode` | `int hackrf_set_hw_sync_mode(hackrf_device* device, const uint8_t value)` | Enable/disable hardware sync mode for multi-HackRF synchronization. |

### 2.4 Preferred Sample Rates

| Rate (MSPS) | Bandwidth | Data Rate (CS8) | Jitter | Recommended |
|-------------|-----------|-----------------|--------|-------------|
| 2 | 1.5 MHz | 4 MB/s | Low | Narrowband |
| 4 | 3 MHz | 8 MB/s | Low | General |
| 8 | 6 MHz | 16 MB/s | Low | Standard |
| 10 | 7.5 MHz | 20 MB/s | Low | Common |
| 12.5 | 9.375 MHz | 25 MB/s | Medium | High BW |
| 16 | 12 MHz | 32 MB/s | Medium | Very high BW |
| 20 | 15 MHz | 40 MB/s | High | Maximum |

Note: USB 2.0 High Speed = 480 Mbps = 60 MB/s theoretical. Practical limit ~36-40 MB/s. 20 MSPS CS8 = 40 MB/s is at the edge.

---

## 3. USRP B200 / B210

### 3.1 Hardware Architecture

Ettus Research (National Instruments) USRP (Universal Software Radio Peripheral) B-series uses a single-chip transceiver + FPGA architecture:

- **Transceiver**: Analog Devices AD9364 (B200) / AD9361 (B210)
  - Frequency range: 70 MHz — 6 GHz
  - Sample rates: 200 kHz — 56 MSPS (12-bit ADC/DAC)
  - Integrated LNA, mixer, baseband filters, AGC
  - AD9364: 1x1 (single channel)
  - AD9361: 2x2 MIMO (two independent channels)
- **FPGA**: Xilinx Spartan-6 XC6SLX150
  - Sample rate conversion, digital filtering
  - Timestamping, PPS synchronization
  - RFNoC (RF Network-on-Chip) blocks for FPGA-accelerated DSP
- **Interface**: USB 3.0 SuperSpeed (5 Gbps = 640 MB/s)
  - Sufficient for 56 MSPS CS16 = 224 MB/s
- **Reference**: 10 MHz internal TCXO, external 10 MHz input, GPS-disciplined oscillator option

### 3.2 B200 vs B210 Comparison

| Parameter | B200 | B210 |
|-----------|------|------|
| Transceiver | AD9364 | AD9361 |
| Channels | 1x1 (1 TX, 1 RX) | 2x2 MIMO (2 TX, 2 RX) |
| Max sample rate | 61.44 MSPS (1 ch) | 61.44 MSPS (1 ch), 30.72 MSPS (2 ch) |
| Frequency range | 70 MHz — 6 GHz | 70 MHz — 6 GHz |
| ADC/DAC | 12-bit | 12-bit |
| Bandwidth | 56 MHz | 56 MHz (1 ch), 28 MHz (2 ch) |
| Interface | USB 3.0 | USB 3.0 |
| FPGA | Spartan-6 XC6SLX75 | Spartan-6 XC6SLX150 |
| Price | ~$800 | ~$1,400 |

### 3.3 UHD API — Key Functions

Source: https://files.ettus.com/manual/

UHD (USRP Hardware Driver) is the vendor-provided C++/Python API.

#### Device Creation

```cpp
#include <uhd/usrp/multi_usrp.hpp>

// Create device handle
uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make("type=b200");

// With serial number
uhd::usrp::multi_usrp::sptr usrp = uhd::usrp::multi_usrp::make("serial=30A12B4");
```

#### Configuration

```cpp
// Sample rate
usrp->set_rx_rate(2.4e6);          // 2.4 MSPS
double actual = usrp->get_rx_rate(); // may differ slightly

// Center frequency
uhd::tune_request_t tune_req(433.92e6);
usrp->set_rx_freq(tune_req);
double actual_freq = usrp->get_rx_freq();

// Gain
usrp->set_rx_gain(30.0);           // 30 dB
double actual_gain = usrp->get_rx_gain();
uhd::gain_range_t gain_range = usrp->get_rx_gain_range(); // min/max/step

// Antenna
usrp->set_rx_antenna("TX/RX");     // or "RX2" on B210
std::vector<std::string> antennas = usrp->get_rx_antennas();

// Bandwidth
usrp->set_rx_bandwidth(2.0e6);     // 2 MHz analog bandwidth
```

#### Streaming

```cpp
// Create RX streamer
uhd::stream_args_t stream_args("fc32");  // Complex float32 output
stream_args.channels = {0};               // Channel 0
uhd::rx_streamer::sptr rx_stream = usrp->get_rx_stream(stream_args);

// Start streaming
uhd::stream_cmd_t stream_cmd(uhd::stream_cmd_t::STREAM_MODE_START_CONTINUOUS);
stream_cmd.stream_now = true;
rx_stream->issue_stream_cmd(stream_cmd);

// Receive samples
std::vector<std::complex<float>> buff(rx_stream->get_max_num_samps());
uhd::rx_metadata_t md;
size_t num_rx = rx_stream->recv(&buff.front(), buff.size(), md);

// Check for errors
if (md.error_code != uhd::rx_metadata_t::ERROR_CODE_NONE) {
    // Handle overflow, timeout, late command, etc.
}

// Stop streaming
stream_cmd.stream_mode = uhd::stream_cmd_t::STREAM_MODE_STOP_CONTINUOUS;
rx_stream->issue_stream_cmd(stream_cmd);
```

#### Synchronization

```cpp
// External 10 MHz reference
usrp->set_clock_source("external");

// GPS-disciplined oscillator
usrp->set_clock_source("gpsdo");
usrp->set_time_source("gpsdo");

// PPS time synchronization
usrp->set_time_next_pps(uhd::time_spec_t(0.0));
```

### 3.4 Python API (uhd module)

```python
import uhd
import numpy as np

usrp = uhd.usrp.MultiUSRP("type=b200")
usrp.set_rx_rate(2.4e6)
usrp.set_rx_freq(uhd.libpyuhd.types.tune_request(433.92e6))
usrp.set_rx_gain(30)

# Create streamer
st_args = uhd.usrp.StreamArgs("fc32", "sc16")
st_args.channels = [0]
rx_streamer = usrp.get_rx_stream(st_args)

# Receive
recv_buffer = np.zeros(rx_streamer.get_max_num_samps(), dtype=np.complex64)
metadata = uhd.types.RXMetadata()
rx_streamer.recv(recv_buffer, metadata)
```

### 3.5 RFNoC (RF Network-on-Chip)

RFNoC provides FPGA-accelerated signal processing blocks:

| Block | Function |
|-------|----------|
| DDC | Digital Down Converter (mix + decimate) |
| DUC | Digital Up Converter (interpolate + mix) |
| FFT | Fast Fourier Transform |
| FIR Filter | Programmable FIR filter |
| Replay | Record/replay samples from FPGA memory |
| SigGen | Signal generator |
| Window | Windowing function for FFT |

RFNoC blocks process data in the FPGA before it reaches the host, reducing USB bandwidth and CPU load.

---

## 4. LimeSDR

### 4.1 Key Specifications

| Parameter | LimeSDR USB | LimeSDR Mini |
|-----------|-------------|--------------|
| Transceiver | LMS7002M | LMS7002M |
| Frequency | 100 kHz — 3.8 GHz | 10 MHz — 3.5 GHz |
| Channels | 2x2 MIMO | 1x1 |
| ADC/DAC | 12-bit | 12-bit |
| Sample rate | Up to 61.44 MSPS | Up to 30.72 MSPS |
| Bandwidth | 61.44 MHz | 30.72 MHz |
| Interface | USB 3.0 | USB 3.0 |
| Full-duplex | Yes | Yes |
| Price | ~$300 | ~$150 |
| FPGA | Altera Cyclone IV EP4CE40F23 | MAX 10 (10M16SAU169C8G) |

### 4.2 LimeSuite Software Stack

- **LimeSuite**: GUI + API for LimeSDR configuration
- **SoapyLMS7**: SoapySDR driver module
- **gr-limesdr**: GNU Radio source/sink blocks
- Direct API: LMS_Open(), LMS_SetSampleRate(), LMS_SetLOFrequency(), LMS_Calibrate()

---

## 5. ADALM-Pluto (PlutoSDR)

### 5.1 Key Specifications

| Parameter | Value |
|-----------|-------|
| Transceiver | AD9364 (same chip as USRP B200) |
| Frequency | 325 MHz — 3.8 GHz (hackable to 70 MHz — 6 GHz) |
| Channels | 1x1 |
| ADC/DAC | 12-bit |
| Sample rate | Up to 61.44 MSPS |
| Bandwidth | 20 MHz |
| Interface | USB 2.0 (OTG) |
| Full-duplex | Yes |
| Price | ~$150 |
| FPGA | Xilinx Zynq Z-7010 (ARM Cortex-A9 + FPGA) |

### 5.2 Driver Stack

- **libiio**: Industrial I/O framework (Linux kernel subsystem)
- **SoapyPlutoSDR**: SoapySDR driver
- **gr-iio**: GNU Radio blocks for IIO devices
- Network mode: libiio supports network access (iio_context_create_network)

### 5.3 Frequency Range Extension

The AD9364 supports 70 MHz — 6 GHz, but Pluto firmware restricts to 325 MHz — 3.8 GHz. Community firmware patch:

```bash
# SSH into Pluto (default: root/analog)
fw_setenv attr_name compatible
fw_setenv attr_val ad9361
fw_setenv compatible ad9361
fw_setenv mode 2r2t
reboot
```

This changes the device tree compatible string from ad9364 to ad9361, unlocking the full frequency range and enabling 2x2 MIMO emulation (time-division).

---

## 6. SoapySDR — Universal Abstraction Layer

### 6.1 Architecture

SoapySDR is a vendor-neutral SDR API that provides a common interface across all SDR hardware. It uses a plugin architecture with dynamically loaded driver modules.

```
Application
    │
    ▼
SoapySDR API (C/C++/Python/...)
    │
    ▼
Driver Modules (loaded at runtime)
    │
    ├── SoapyRTLSDR ─── librtlsdr ─── RTL-SDR hardware
    ├── SoapyHackRF ─── libhackrf ─── HackRF hardware
    ├── SoapyUHD ────── libuhd ────── USRP hardware
    ├── SoapyLMS7 ───── LimeSuite ─── LimeSDR hardware
    ├── SoapyPlutoSDR ── libiio ────── PlutoSDR hardware
    ├── SoapyAirspy ─── libairspy ─── Airspy hardware
    ├── SoapyAirspyHF ── libairspyhf ── Airspy HF+ hardware
    └── SoapyRemote ─── network ───── Remote SDR (any)
```

### 6.2 API Reference

#### Device Discovery

```cpp
#include <SoapySDR/Device.hpp>

// Enumerate all devices
SoapySDR::KwargsList results = SoapySDR::Device::enumerate();
for (auto &kwargs : results) {
    for (auto &pair : kwargs) {
        std::cout << pair.first << "=" << pair.second << std::endl;
    }
}

// Enumerate specific type
SoapySDR::KwargsList results = SoapySDR::Device::enumerate("driver=rtlsdr");
```

#### Device Lifecycle

```cpp
// Create device
SoapySDR::Device *sdr = SoapySDR::Device::make("driver=rtlsdr");

// Configure
sdr->setSampleRate(SOAPY_SDR_RX, 0, 2.4e6);
sdr->setFrequency(SOAPY_SDR_RX, 0, 433.92e6);
sdr->setGain(SOAPY_SDR_RX, 0, 40.0);
sdr->setBandwidth(SOAPY_SDR_RX, 0, 2.0e6);

// Setup stream
SoapySDR::Stream *rxStream = sdr->setupStream(SOAPY_SDR_RX, SOAPY_SDR_CF32);
sdr->activateStream(rxStream);

// Read samples
std::complex<float> buff[1024];
void *buffs[] = {buff};
int flags;
long long timeNs;
int ret = sdr->readStream(rxStream, buffs, 1024, flags, timeNs);

// Cleanup
sdr->deactivateStream(rxStream);
sdr->closeStream(rxStream);
SoapySDR::Device::unmake(sdr);
```

#### Python API

```python
import SoapySDR
import numpy as np

# Enumerate
results = SoapySDR.Device.enumerate()

# Create
sdr = SoapySDR.Device(dict(driver="rtlsdr"))

# Configure
sdr.setSampleRate(SoapySDR.SOAPY_SDR_RX, 0, 2.4e6)
sdr.setFrequency(SoapySDR.SOAPY_SDR_RX, 0, 433.92e6)
sdr.setGain(SoapySDR.SOAPY_SDR_RX, 0, 40.0)

# Stream
rxStream = sdr.setupStream(SoapySDR.SOAPY_SDR_RX, SoapySDR.SOAPY_SDR_CF32)
sdr.activateStream(rxStream)

buff = np.array([0]*1024, np.complex64)
sr = sdr.readStream(rxStream, [buff], len(buff))

sdr.deactivateStream(rxStream)
sdr.closeStream(rxStream)
```

### 6.3 Driver Module Support Matrix

| Module | Hardware | Status | Notes |
|--------|----------|--------|-------|
| SoapyRTLSDR | RTL-SDR v3/v4 | Stable | RX only |
| SoapyHackRF | HackRF One | Stable | TX/RX |
| SoapyUHD | USRP B200/B210/X310/etc | Stable | Full UHD feature set |
| SoapyLMS7 | LimeSDR, LimeSDR Mini | Stable | Full-duplex MIMO |
| SoapyPlutoSDR | ADALM-Pluto | Stable | Full-duplex |
| SoapyAirspy | Airspy R2, Airspy Mini | Stable | RX only, 10 MSPS |
| SoapyAirspyHF | Airspy HF+ Discovery | Stable | RX only, HF+VHF |
| SoapyBladeRF | BladeRF x40/x115/2.0 | Stable | Full-duplex |
| SoapyRedPitaya | Red Pitaya | Beta | Network mode |
| SoapyRemote | Any (network bridge) | Stable | Bridges any SoapySDR device over network |

### 6.4 SoapyRemote

SoapyRemote enables network-attached SDR operation:

```
┌─────────────┐              ┌──────────────┐
│ Client      │   Network    │ Server       │
│ Application │◄────────────►│ SoapyRemote  │
│ (SoapySDR)  │   TCP/UDP    │ Server       │
└─────────────┘              │      │       │
                             │ ┌────▼─────┐ │
                             │ │ SoapySDR │ │
                             │ │ + Driver │ │
                             │ └────┬─────┘ │
                             │      │       │
                             │ ┌────▼─────┐ │
                             │ │ SDR HW   │ │
                             │ └──────────┘ │
                             └──────────────┘
```

Server: `SoapySDRServer --bind=0.0.0.0:55132`
Client: `SoapySDR::Device::make("driver=remote,remote=192.168.1.100:55132")`

Latency overhead: ~1-5 ms per control command. Sample streaming adds network jitter.

### 6.5 GNU Radio Integration

GNU Radio `gr-soapy` module provides SoapySDR-based source and sink blocks:

```python
# In GNU Radio flow graph
import gnuradio.soapy as soapy

source = soapy.source(
    "driver=rtlsdr",
    "fc32",
    1,           # 1 channel
    "",          # device args
    "",          # stream args
    [""],        # tune args per channel
    [soapy.range_t(0, 0, 0)]  # settings
)
source.set_sample_rate(0, 2.4e6)
source.set_frequency(0, 433.92e6)
source.set_gain(0, 40)
```

---

## 7. IQ Sample Formats

### 7.1 Mathematical Foundation

An SDR receiver converts an analog RF signal to a digital baseband representation using In-phase (I) and Quadrature (Q) components:

```
RF signal: s(t) = A(t) cos(2πf_c t + φ(t))

Baseband:  I(t) = A(t) cos(φ(t))    ← In-phase (real part)
           Q(t) = A(t) sin(φ(t))    ← Quadrature (imaginary part)

Complex:   z(t) = I(t) + jQ(t) = A(t) e^(jφ(t))
```

This complex representation preserves both amplitude A(t) and phase φ(t) information, enabling:
- Frequency discrimination (positive vs negative offsets from center)
- Phase-sensitive demodulation (PSK, QAM)
- Full bandwidth utilization (Nyquist rate applies to bandwidth, not carrier frequency)

### 7.2 Format Reference Table

| Format | Full Name | Bits/Value | Bits/Sample (I+Q) | Bytes/Sample | Value Range | SigMF Datatype | Native To |
|--------|-----------|-----------|-------------------|-------------|-------------|----------------|-----------|
| CU8 | Complex Unsigned 8-bit | 8 | 16 | 2 | I,Q: 0-255 | `cu8` | RTL-SDR |
| CS8 | Complex Signed 8-bit | 8 | 16 | 2 | I,Q: -128 to 127 | `ci8` | HackRF |
| CU12 | Complex Unsigned 12-bit | 12 | 24 | 3 | I,Q: 0-4095 | `cu12_le` | Airspy |
| CS12 | Complex Signed 12-bit | 12 | 24 | 3 | I,Q: -2048 to 2047 | `ci12_le` | Airspy |
| CU16 | Complex Unsigned 16-bit | 16 | 32 | 4 | I,Q: 0-65535 | `cu16_le` | — |
| CS16 | Complex Signed 16-bit | 16 | 32 | 4 | I,Q: -32768 to 32767 | `ci16_le` | USRP, PlutoSDR |
| CF32 | Complex Float 32-bit | 32 | 64 | 8 | I,Q: +-3.4e38 | `cf32_le` | GNU Radio |
| CF64 | Complex Float 64-bit | 64 | 128 | 16 | I,Q: +-1.8e308 | `cf64_le` | MATLAB, SciPy |

### 7.3 Memory Layout Diagrams

CU8 (RTL-SDR native):
```
Byte:  [I0] [Q0] [I1] [Q1] [I2] [Q2] ...
Value:  u8   u8   u8   u8   u8   u8
Offset: 0    1    2    3    4    5
```

CS16 (USRP native, little-endian):
```
Byte:  [I0_lo] [I0_hi] [Q0_lo] [Q0_hi] [I1_lo] [I1_hi] [Q1_lo] [Q1_hi] ...
Value:   ----s16----     ----s16----      ----s16----      ----s16----
Offset:  0       1       2       3        4       5        6       7
```

CF32 (GNU Radio native, little-endian):
```
Byte:  [------- I0 float32 -------] [------- Q0 float32 -------] ...
Value:     IEEE 754 single             IEEE 754 single
Offset: 0  1  2  3                    4  5  6  7
```

### 7.4 Conversion Formulas

**CU8 → CF32** (RTL-SDR to processing):
```
I_f32 = (I_u8 - 127.4) / 128.0
Q_f32 = (Q_u8 - 127.4) / 128.0
```
Note: 127.4 (not 127.5) is the empirically determined DC offset for RTL2832U.

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

**CF32 → CS16** (processing to recording):
```
I_s16 = clamp(round(I_f32 * 32767), -32768, 32767)
Q_s16 = clamp(round(Q_f32 * 32767), -32768, 32767)
```

**CF32 → CU8** (processing to RTL-SDR format):
```
I_u8 = clamp(round(I_f32 * 128.0 + 127.4), 0, 255)
Q_u8 = clamp(round(Q_f32 * 128.0 + 127.4), 0, 255)
```

### 7.5 Dynamic Range Comparison

| Format | Bits | Dynamic Range | Quantization Noise Floor | ENOB |
|--------|------|--------------|-------------------------|------|
| CU8/CS8 | 8 | 48.16 dB | -48.16 dB | ~6.5 |
| CS12 | 12 | 72.25 dB | -72.25 dB | ~10.5 |
| CS16 | 16 | 96.33 dB | -96.33 dB | ~14 |
| CF32 | 23 (mantissa) | 138.5 dB | -138.5 dB | ~23 |

Formula: Dynamic Range = 6.02 * N + 1.76 dB (where N = effective bits)

### 7.6 Bandwidth & Data Rate Calculations

| Device | Sample Rate | Format | Bytes/Sample | Data Rate | MB/s | Gb/hour |
|--------|------------|--------|-------------|-----------|------|---------|
| RTL-SDR | 2.4 MSPS | CU8 | 2 | 4,800,000 B/s | 4.58 | 16.5 |
| RTL-SDR | 2.4 MSPS | CF32 | 8 | 19,200,000 B/s | 18.31 | 65.9 |
| HackRF | 8 MSPS | CS8 | 2 | 16,000,000 B/s | 15.26 | 54.9 |
| HackRF | 10 MSPS | CS8 | 2 | 20,000,000 B/s | 19.07 | 68.7 |
| HackRF | 20 MSPS | CS8 | 2 | 40,000,000 B/s | 38.15 | 137.3 |
| USRP B200 | 10 MSPS | CS16 | 4 | 40,000,000 B/s | 38.15 | 137.3 |
| USRP B200 | 56 MSPS | CS16 | 4 | 224,000,000 B/s | 213.6 | 769.0 |
| USRP B200 | 56 MSPS | CF32 | 8 | 448,000,000 B/s | 427.2 | 1538.1 |

### 7.7 Storage Requirements (1 hour recording)

| Device | Rate | Format | 1 min | 10 min | 1 hour |
|--------|------|--------|-------|--------|--------|
| RTL-SDR | 2.4 MSPS | CU8 | 275 MB | 2.7 GB | 16.5 GB |
| HackRF | 8 MSPS | CS8 | 916 MB | 9.2 GB | 54.9 GB |
| HackRF | 20 MSPS | CS8 | 2.3 GB | 22.9 GB | 137.3 GB |
| USRP | 10 MSPS | CS16 | 2.3 GB | 22.9 GB | 137.3 GB |
| USRP | 56 MSPS | CS16 | 12.8 GB | 128.2 GB | 769.0 GB |

---

## 8. Device Comparison Matrix

| Feature | RTL-SDR v4 | HackRF One | USRP B200 | USRP B210 | LimeSDR USB | LimeSDR Mini | ADALM-Pluto |
|---------|-----------|------------|-----------|-----------|-------------|-------------|-------------|
| **Price** | ~$30 | ~$350 | ~$800 | ~$1,400 | ~$300 | ~$150 | ~$150 |
| **Freq (MHz)** | 24-1766 | 1-6000 | 70-6000 | 70-6000 | 0.1-3800 | 10-3500 | 325-3800* |
| **Bandwidth** | 2.56 MHz | 20 MHz | 56 MHz | 56 MHz | 61.44 MHz | 30.72 MHz | 20 MHz |
| **Max Rate** | 3.2 MSPS | 20 MSPS | 61.44 MSPS | 61.44 MSPS | 61.44 MSPS | 30.72 MSPS | 61.44 MSPS |
| **ADC Bits** | 8 | 8 | 12 | 12 | 12 | 12 | 12 |
| **TX** | No | Yes | Yes | Yes | Yes | Yes | Yes |
| **Duplex** | N/A | Half | Full | Full | Full | Full | Full |
| **MIMO** | No | No | No | 2x2 | 2x2 | No | No |
| **Interface** | USB 2.0 | USB 2.0 | USB 3.0 | USB 3.0 | USB 3.0 | USB 3.0 | USB 2.0 |
| **FPGA** | None | None | Spartan-6 | Spartan-6 | Cyclone IV | MAX 10 | Zynq 7010 |
| **Clock** | TCXO | TCXO | TCXO/ext | TCXO/ext | VCTCXO | VCTCXO | TCXO |
| **HF** | V4: Yes | Yes | No** | No** | Yes | No | No |
| **Open HW** | Partial | Full | No | No | Full | Full | No |
| **Driver** | librtlsdr | libhackrf | UHD | UHD | LimeSuite | LimeSuite | libiio |
| **SoapySDR** | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| **GNU Radio** | osmocom | osmocom | UHD | UHD | gr-limesdr | gr-limesdr | gr-iio |
| **Best For** | Hobbyist, ADS-B, FM | Wideband, TX, sweep | Professional RX | Professional MIMO | Dev, research | Budget MIMO | Education |

\* Hackable to 70-6000 MHz
\** UHD supports some HF with BasicRX/BasicTX daughterboards on N/X series, not B series

### 8.1 Decision Tree: Which SDR?

```
Budget?
├─ <$50 ──────► RTL-SDR v4 (receive-only, narrowband, excellent value)
├─ $100-$200 ─┬► ADALM-Pluto (full-duplex, education, hackable)
│             └► LimeSDR Mini (wider bandwidth, MIMO disabled)
├─ $200-$400 ─┬► HackRF One (widest freq range, TX, sweep mode)
│             └► LimeSDR USB (MIMO, full-duplex, wide bandwidth)
└─ $800+ ─────┬► USRP B200 (professional, GPS sync, RFNoC)
              └► USRP B210 (professional + MIMO)

Need TX?
├─ No ────────► RTL-SDR v4 (cheapest, simplest)
└─ Yes ───────► HackRF (budget), USRP/LimeSDR (professional)

Need MIMO?
├─ No ────────► Any single-channel device
└─ Yes ───────► USRP B210, LimeSDR USB

Need >6 GHz?
├─ No ────────► Any device above
└─ Yes ───────► USRP X310 + WBX/UBX daughterboard (not covered here)

Need GPS sync?
├─ No ────────► Any device
└─ Yes ───────► USRP (GPSDO option)
```

---

## 9. USB Bandwidth Analysis

### 9.1 Interface Limits

| USB Version | Theoretical | Practical | Overhead |
|-------------|------------|-----------|----------|
| USB 2.0 HS | 480 Mbps (60 MB/s) | 36-40 MB/s | Protocol, polling |
| USB 3.0 SS | 5 Gbps (640 MB/s) | 400-500 MB/s | Protocol, encoding |
| USB 3.1 Gen 2 | 10 Gbps (1.25 GB/s) | 800-1000 MB/s | Protocol, encoding |

### 9.2 Per-Device Analysis

| Device | Interface | Max Data Rate | % USB Capacity | Margin |
|--------|-----------|--------------|----------------|--------|
| RTL-SDR @ 2.4 MSPS | USB 2.0 | 4.58 MB/s | 12.7% | Large |
| RTL-SDR @ 3.2 MSPS | USB 2.0 | 6.1 MB/s | 16.9% | Large |
| HackRF @ 20 MSPS | USB 2.0 | 38.15 MB/s | ~100% | None |
| USRP B200 @ 56 MSPS CF32 | USB 3.0 | 427.2 MB/s | 85-100% | Marginal |
| USRP B200 @ 56 MSPS CS16 | USB 3.0 | 213.6 MB/s | 43-53% | Adequate |

### 9.3 Multi-Device Considerations

Multiple USB SDR devices share host controller bandwidth:

```
USB 2.0 Hub:
  RTL-SDR #1 (4.58 MB/s)
  RTL-SDR #2 (4.58 MB/s)
  RTL-SDR #3 (4.58 MB/s)
  RTL-SDR #4 (4.58 MB/s)
  ─────────────────────
  Total: 18.32 MB/s (50.9% of 36 MB/s practical) → OK

USB 2.0 Hub:
  HackRF #1 (38.15 MB/s)
  RTL-SDR #1 (4.58 MB/s)
  ─────────────────────
  Total: 42.73 MB/s (>100%) → WILL DROP SAMPLES
```

Best practice: Use separate USB host controllers for high-bandwidth devices.

---

## 10. Thermal Drift and PPM Correction

### 10.1 Crystal Oscillator Types

| Type | Typical Stability | Temperature Sensitivity |
|------|------------------|------------------------|
| Standard XO | +-25 PPM | +-0.5 PPM/degC |
| TCXO (V4) | +-0.5 PPM | +-0.05 PPM/degC |
| OCXO | +-0.01 PPM | +-0.001 PPM/degC |
| GPSDO | +-0.001 PPM | N/A (GPS locked) |

### 10.2 Frequency Error at Different PPM

At 433.92 MHz center frequency:

| PPM Error | Frequency Error | Impact |
|-----------|----------------|--------|
| 0.5 PPM | 217 Hz | Negligible for most protocols |
| 1 PPM | 434 Hz | Acceptable for FM, POCSAG |
| 5 PPM | 2.17 kHz | May affect narrowband digital |
| 10 PPM | 4.34 kHz | Audible drift in FM reception |
| 50 PPM | 21.7 kHz | Signal may leave passband |

At 1090 MHz (ADS-B):

| PPM Error | Frequency Error | Impact |
|-----------|----------------|--------|
| 0.5 PPM | 545 Hz | Negligible |
| 1 PPM | 1.09 kHz | Acceptable |
| 10 PPM | 10.9 kHz | Still within ADS-B bandwidth |
| 50 PPM | 54.5 kHz | Near edge of channel |

### 10.3 PPM Calibration Methods

1. **Known signal reference**: Tune to a known-frequency transmitter (e.g., GSM base station, NOAA weather broadcast), measure offset, compute PPM
2. **GPS comparison**: Use GPS PPS (pulse per second) to measure actual crystal frequency
3. **kalibrate-rtl**: Automated tool that uses GSM base stations as frequency references
4. **rtl_test -p**: Built-in PPM measurement mode (requires ~30 seconds warm-up)

---

## 11. Citations

| Key | Reference |
|-----|-----------|
| [RTLSDR] | steve-m/librtlsdr, https://github.com/steve-m/librtlsdr |
| [RTLSDR-V4] | RTL-SDR Blog V4 Specifications, https://www.rtl-sdr.com/rtl-sdr-blog-v4/ |
| [HACKRF] | Great Scott Gadgets HackRF, https://github.com/greatscottgadgets/hackrf |
| [UHD] | Ettus Research UHD, https://files.ettus.com/manual/ |
| [SOAPYSDR] | SoapySDR Project, https://github.com/pothosware/SoapySDR |
| [LIMESDR] | MyriadRF LimeSDR, https://limemicro.com/products/boards/limesdr/ |
| [PLUTO] | Analog Devices ADALM-Pluto, https://wiki.analog.com/university/tools/pluto |
| [SIGMF] | SigMF Specification, https://github.com/sigmf/SigMF |
| [PYRTLSDR] | pyrtlsdr Python wrapper, https://github.com/roger-/pyrtlsdr |
| [AIRSPY] | Airspy SDR, https://airspy.com/ |
| [R828D] | Rafael Micro R828D datasheet |
| [RTL2832U] | Realtek RTL2832U datasheet |
| [AD9361] | Analog Devices AD9361 datasheet |
| [AD9364] | Analog Devices AD9364 datasheet |
| [MAX2839] | Maxim MAX2839 datasheet |
| [MAX5864] | Maxim MAX5864 datasheet |
| [LMS7002M] | Lime Microsystems LMS7002M datasheet |
